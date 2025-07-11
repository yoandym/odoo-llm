# LLM Website Assistant Architecture

The LLM Website Assistant module extends Odoo's native `im_livechat` functionality with AI-powered chatbot capabilities. Rather than reimplementing chat infrastructure, it leverages and enhances the existing livechat architecture to provide intelligent, context-aware conversations.

## Core Design Principles

1. **Extend, Don't Replace**: Build upon im_livechat's proven infrastructure
2. **Seamless Integration**: Maintain compatibility with existing livechat features
3. **Progressive Enhancement**: Add LLM capabilities without breaking standard chatbot functionality
4. **Tool-Driven Actions**: Use LLM tools to trigger native Odoo workflows

## How It Extends im_livechat

### 1. Model Extensions

#### chatbot.script (Extended)
```python
class ChatbotScript(models.Model):
    _inherit = "chatbot.script"
    
    # New fields for LLM integration
    llm_assistant_id = fields.Many2one("llm.assistant", 
        domain="[('is_website_visible', '=', True)]")
    is_llm_enabled = fields.Boolean()
```

**Key Changes:**
- Links chatbot scripts to LLM assistants
- Maintains backward compatibility with standard scripts
- Auto-generates LLM-compatible step structure via `action_create_llm_steps()`

#### chatbot.script.step (Extended)
```python
class ChatbotScriptStep(models.Model):
    _inherit = "chatbot.script.step"
    
    # New step type for continuous LLM conversation
    step_type = fields.Selection(
        selection_add=[("llm_processed_input", "LLM Processed Input")]
    )
```

**Key Features:**
- New `llm_processed_input` step type that doesn't advance automatically
- Dynamic flow action dispatch pattern for tool responses
- Maintains conversation context across messages

#### llm.assistant (Extended)
```python
class LlmAssistant(models.Model):
    _inherit = "llm.assistant"
    
    is_website_visible = fields.Boolean()
    allowed_knowledge_collections = fields.Many2many()
```

**Additions:**
- Website visibility control for public access
- Knowledge collection restrictions for security
- Usage statistics tracking

#### llm.thread (Extended)
```python
class LlmThread(models.Model):
    _inherit = "llm.thread"
    
    source = fields.Selection(
        selection_add=[("website_livechat", "Website Livechat")]
    )
```

**Integration:**
- Tracks livechat as a thread source
- Auto-configures from assistant settings
- Links to discuss.channel for conversation history

### 2. Controller Enhancements

#### LlmLivechatController
Extends `LivechatController` to include LLM data:

```python
@http.route()
def livechat_init(self, channel_id):
    result = super().livechat_init(channel_id)
    
    # Add LLM-specific attributes if enabled
    if matching_rule.chatbot_script_id.is_llm_enabled:
        result["rule"]["chatbot"].update({
            "isLlmEnabled": True,
            "llmAssistantId": assistant_id,
            "llmAssistantName": assistant_name,
        })
```

#### LlmChatbotController
New controller for LLM step processing:

```python
@http.route("/chatbot/step/process", type="json", auth="public")
def chatbot_process_step(self, ...):
    # Process LLM responses
    # Handle tool invocations
    # Manage flow actions
```

### 3. JavaScript Extensions

The module patches existing JavaScript services rather than replacing them:

```javascript
// llm_chatbot_service.js
patch(ChatbotService.prototype, {
    async _triggerStep() {
        if (this.currentStep.isLlmStep) {
            return this._processLlmStep();
        }
        return super._triggerStep();
    }
});
```

## Data Flow

### 1. Initialization Sequence (LLM)

```
1. Visitor loads website page
2. LivechatService calls /im_livechat/init
3. Server checks matching rules (URL, country, etc.)
4. Returns channel configuration if rule matches
5. Frontend displays chat button based on settings
6. Creates discuss.channel when chat starts
7. Frontend calls /chatbot/post_welcome_steps to post initial bot message(s)
```

```{mermaid}
sequenceDiagram
    participant V as Visitor
    participant F as Frontend
    participant S as Server
    participant DC as discuss.channel
    V->>F: Load website page
    F->>S: /im_livechat/init
    S->>S: Check matching rules
    S-->>F: Return channel config
    F->>V: Display chat button
    V->>F: Start chat
    F->>S: Create discuss.channel
    S->>DC: Create channel
    F->>S: /chatbot/post_welcome_steps
    S->>DC: Post welcome steps
```

### 2. Message Flow (LLM)

```
1. User sends message via frontend
2. ChatbotService calls /chatbot/step/process
3. LlmChatbotController processes message and invokes LLM assistant
4. LLM assistant may invoke tools if needed
5. LLM assistant returns response and flow actions
6. Controller posts message to discuss.channel
7. Frontend updates conversation display
```

```{mermaid}
:zoom:
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant CS as ChatbotService
    participant LCC as LlmChatbotController
    participant LA as LLM Assistant
    participant T as LLM Tools
    participant DC as discuss.channel
    U->>F: Send message
    F->>CS: Process message
    CS->>LCC: /chatbot/step/process
    LCC->>LA: Generate response
    LA->>T: Invoke tools if needed
    T-->>LA: Tool results + flow_action
    LA-->>LCC: Response + metadata
    LCC->>DC: Post message
    LCC-->>CS: Format response
    CS-->>F: Update conversation
    F->>U: Display message
```

### 3. Chatbot Processing (LLM)

```
1. User input triggers /chatbot/step/process
2. LlmChatbotController validates input and current step
3. LLM assistant generates response and may invoke tools
4. Controller processes flow actions and determines next step
5. Posts bot message for next step
6. Updates conversation state
7. Handles special actions (operator handover, etc.)
```

```{mermaid}
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant CS as ChatbotService
    participant LCC as LlmChatbotController
    participant LA as LLM Assistant
    participant T as LLM Tools
    participant DC as discuss.channel
    U->>F: Input message
    F->>CS: Process input
    CS->>LCC: /chatbot/step/process
    LCC->>LA: Generate response
    LA->>T: Invoke tools if needed
    T-->>LA: Tool results + flow_action
    LA-->>LCC: Response + flow_action
    LCC->>DC: Post bot message
    LCC-->>CS: Format next step
    CS-->>F: Update state
    LCC->>LCC: Handle special actions
```


## Data Flow Comparison

### Standard Chatbot Flow (Native)
```
User Input → Script Step → Fixed Response → Next Step
```

### LLM-Enhanced Flow
```
User Input → LLM Processing → Dynamic Response → Tool Action → Flow Dispatch
                     ↑                                              ↓
                     ←─────────── Stays on Same Step ←──────────────
```

## Key Integration Points

### 1. Session Management
- Reuses `website.visitor` for tracking
- Maintains `discuss.channel` for history
- Creates `llm.thread` for AI context

### 2. Message Handling
- Posts to existing `discuss.channel`
- Creates `chatbot.message` records
- Preserves full conversation history

### 3. Operator Handover
- Uses native `_process_step_forward_operator()`
- Maintains operator availability checks
- Preserves conversation context during transfer

### 4. Security Model
- Inherits im_livechat access controls
- Adds LLM-specific visibility rules
- Maintains session isolation


## Performance Optimizations

### 1. Selective Enhancement
- Only processes LLM steps when needed
- Falls back to native handling for standard steps
- Lazy loads LLM components

### 2. Caching Strategy
- Caches assistant configurations
- Reuses tool definitions
- Minimizes API calls

### 3. Async Processing
- Non-blocking LLM API calls
- Shows typing indicators during processing
- Handles timeouts gracefully


## Extension Examples

### Adding New Flow Actions
```python
def _process_flow_action_schedule_demo(self, response_data):
    """Custom flow action for demo scheduling"""
    # Implementation
    return next_step, params
```

### Custom Tool Integration
```python
class CustomBusinessTool(models.Model):
    _inherit = "llm.tool"
    
    def _run(self, **kwargs):
        # Business logic
        return {
            "message": "Action completed",
            "flow_action": "custom_action"
        }
```

## Benefits of This Architecture

1. **Leverages Existing Infrastructure**: No need to reimplement chat functionality
2. **Maintains Compatibility**: Works with existing operator workflows, rules, and integrations
3. **Progressive Enhancement**: Can be enabled/disabled without breaking standard chatbots
4. **Unified Experience**: Operators see LLM chats in familiar interface
5. **Tool Ecosystem**: LLM tools can trigger any native Odoo workflow

This architecture ensures that AI capabilities enhance rather than replace Odoo's proven livechat infrastructure, providing a smooth upgrade path for existing implementations while enabling powerful new conversational experiences.