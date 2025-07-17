# JavaScript Components Documentation

This module uses a patching approach to extend the existing `im_livechat` JavaScript components rather than creating new ones. This ensures seamless integration with the native chatbot functionality.

## Architecture Overview

```{mermaid}
graph TB
    subgraph "Native im_livechat Components"
        CB[Chatbot Model]
        CBS[ChatbotService]
        CSM[ChatbotStep Model]
    end
    
    subgraph "LLM Patches"
        LCB[llm_chatbot_model.js<br/>Patches Chatbot]
        LCBS[llm_chatbot_service.js<br/>Patches ChatbotService]
        LCSM[llm_chatbot_step_model.js<br/>Patches ChatbotStep]
    end
    
    LCB -.->|extends| CB
    LCBS -.->|extends| CBS
    LCSM -.->|extends| CSM
    
    classDef native fill:#e3f2fd,stroke:#1976d2
    classDef patch fill:#f3e5f5,stroke:#7b1fa2
    
    class CB,CBS,CSM native
    class LCB,LCBS,LCSM patch
```

## Component Patches

### llm_chatbot_model.js

**Patches:** `@im_livechat/embed/common/chatbot/chatbot_model`

**Purpose:** Extends the Chatbot model to handle LLM-specific properties.

#### Implementation

```javascript
patch(Chatbot, {
    parse(data) {
        const chatbot = this._super(...arguments);
        
        // Add LLM-specific properties
        chatbot.isLlmEnabled = data.isLlmEnabled || false;
        chatbot.llmAssistantId = data.llmAssistantId || false;
        chatbot.llmAssistantName = data.llmAssistantName || '';
        
        return chatbot;
    },
});
```

**Added Properties:**
- `isLlmEnabled`: Boolean flag indicating LLM support
- `llmAssistantId`: ID of the associated LLM assistant
- `llmAssistantName`: Display name of the assistant

### llm_chatbot_service.js

**Patches:** `@im_livechat/embed/common/chatbot/chatbot_service`

**Purpose:** Handles LLM-specific step processing and conversation flow.

#### Key Method Overrides

##### `_getNextStep()`

```javascript
async _getNextStep() {
    // For LLM steps that expect answer, stay on same step
    if (this.currentStep?.isLlmStep && this.currentStep?.expectAnswer) {
        return { step: this.currentStep };
    }
    
    // Call parent and mark LLM steps
    const result = await super._getNextStep(...arguments);
    
    if (result?.step?.type === 'llm_processed_input') {
        result.step.isLlmStep = true;
    }
    
    return result;
}
```

**Behavior:**
- Keeps conversation on the same LLM step for continuity
- Identifies and marks LLM steps based on type

##### `_processUserAnswer(message)`

```javascript
async _processUserAnswer(message) {
    // Check conditions for processing
    if (!this.active || 
        message.originThread.localId !== this.livechatService.thread?.localId ||
        !this.currentStep?.expectAnswer) {
        return;
    }
    
    const isLlmStep = this.currentStep?.isLlmStep || 
                      this.currentStep?.type === 'llm_processed_input';
    
    if (isLlmStep) {
        this.isTyping = true;
        this.currentStep.hasAnswer = true;
        
        try {
            // Use the standard trigger endpoint for LLM processing
            const nextStepData = await this.rpc("/chatbot/step/trigger", {
                channel_uuid: this.livechatService.thread.uuid,
                chatbot_script_id: this.chatbot.scriptId,
            });
            
            // Handle chatbot message and next step
            const { chatbot_posted_message, chatbot_step } = nextStepData ?? {};
            
            if (chatbot_posted_message) {
                this.livechatService.thread?.messages.add({
                    ...chatbot_posted_message,
                    body: markup(chatbot_posted_message.body),
                });
            }
            
            if (chatbot_step) {
                this.currentStep = new ChatbotStep(chatbot_step);
                if (this.currentStep.type === 'llm_processed_input') {
                    this.currentStep.isLlmStep = true;
                    this.currentStep.expectAnswer = true;
                }
            }
            
            this.save();
        } catch (error) {
            console.error("[LLM Debug] Error processing LLM answer:", error);
        } finally {
            this.isTyping = false;
        }
    } else {
        return super._processUserAnswer(message);
    }
}
```

**Features:**
- Shows typing indicator during AI processing
- Uses standard `/chatbot/step/trigger` endpoint
- Properly marks step as answered
- Maintains conversation state on same LLM step
- Falls back to standard behavior for non-LLM steps

##### `_triggerNextStep()`

```javascript
_triggerNextStep() {
    if (this.completed) {
        return;
    }
    this.isTyping = !this.isRestoringSavedState;
    this.nextStepTimeout = browser.setTimeout(async () => {
        const { step, stepMessage } = await this._getNextStep();
        if (!this.active) {
            return;
        }
        this.isTyping = false;
        if (!step && this.currentStep) {
            this.currentStep.isLast = true;
            return;
        }
        // Only post messages with non-empty body
        if (stepMessage && stepMessage.body) {
            this.livechatService.thread?.messages.add({
                ...stepMessage,
                body: markup(stepMessage.body),
            });
        }
        this.currentStep = step;
        // ... rest of method
    }, this.messageDelay);
}
```

**Improvement:**
- Prevents posting empty messages (important for LLM steps)

### llm_chatbot_step_model.js

**Patches:** `@im_livechat/embed/common/chatbot/chatbot_step_model`

**Purpose:** Extends ChatbotStep to recognize LLM steps as expecting user input.

#### Key Overrides

##### `expectAnswer` getter

```javascript
get expectAnswer() {
    const expectAnswerTypes = [
        "question", "email", "phone", 
        "free_input_multi", "free_input_single", 
        "llm_processed_input"  // Added for LLM
    ];
    return expectAnswerTypes.includes(this.type);
}
```

##### `parse()` static method

```javascript
parse(data) {
    const step = this._super(...arguments);
    
    // Add LLM-specific properties
    step.isLlmStep = data.is_llm_step || 
                     data.type === 'llm_processed_input';
    
    return step;
}
```

## Integration Flow

```{mermaid}
sequenceDiagram
    participant U as User
    participant CS as ChatbotService
    participant CSM as ChatbotStep
    participant API as Backend API
    participant AI as AI Service
    
    U->>CS: Type message
    CS->>CS: Check if LLM step
    CS->>CS: Show typing indicator
    CS->>API: POST /chatbot/step/process
    API->>AI: Process with LLM
    AI-->>API: AI response
    API-->>CS: Response + next step
    CS->>CSM: Update current step
    CS->>U: Display AI message
```

## Debug Logging

The components include comprehensive debug logging:

```javascript
console.log("[LLM Debug] _getNextStep called", {
    currentStep: this.currentStep,
    isLlmStep: this.currentStep?.isLlmStep,
    expectAnswer: this.currentStep?.expectAnswer,
    type: this.currentStep?.type
});
```

**Debug Points:**
- Step transitions
- Answer processing
- API calls
- Error conditions

## Additional Components

### LivechatButton Extension

**File:** `/static/src/js/livechat_button_extension.js`

**Purpose:** Extends the livechat button to handle LLM streaming messages.

#### Key Methods

- `_handleLLMStreamingMessage()`: Processes SSE events for AI responses
- `_updateMessage()`: Updates message content during streaming
- Manages typing indicators during AI response generation

## Asset Registration

The JavaScript files are registered in the manifest:

```python
"assets": {
    "web.assets_frontend": [
        "llm_website_assistant/static/src/embed/common/chatbot/llm_chatbot_model.js",
        "llm_website_assistant/static/src/embed/common/chatbot/llm_chatbot_step_model.js",
        "llm_website_assistant/static/src/embed/common/chatbot/llm_chatbot_service.js",
        "llm_website_assistant/static/src/js/livechat_button_extension.js",
    ],
}
```

## Best Practices

1. **Use Patching Sparingly**: Only override what's necessary
2. **Call Super Methods**: Always call `_super()` for parent functionality
3. **Handle Edge Cases**: Check for undefined values and null states
4. **Debug Logging**: Use console.log with [LLM Debug] prefix
5. **Type Checking**: Verify step types before LLM processing
6. **Error Recovery**: Gracefully fall back to standard behavior

## Common Issues and Solutions

### Issue: Step not recognized as LLM
**Solution:** Check both `isLlmStep` and `type === 'llm_processed_input'`

### Issue: Conversation doesn't continue
**Solution:** Ensure step stays the same for LLM conversations

### Issue: No typing indicator
**Solution:** Set `this.isTyping = true` before API calls

### Issue: Channel UUID missing
**Solution:** Try multiple sources:
```javascript
const channelUuid = this.livechatService?.thread?.uuid || 
                    this.livechatService?.thread?.id;
```