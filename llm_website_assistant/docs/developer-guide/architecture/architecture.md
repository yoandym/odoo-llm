# LLM Website Assistant Architecture

The LLM Website Assistant module extends Odoo's native `im_livechat` functionality with AI-powered chatbot capabilities. Rather than reimplementing chat infrastructure, it leverages and enhances the existing livechat architecture to provide intelligent, context-aware conversations.

**Architecture Update**: The module has been refactored to follow a clean separation of concerns pattern. The refactoring introduces a coordinator service to orchestrate complex LLM interactions, moves all network/threading operations to LivechatService, keeps ChatbotService focused on script flow, and simplifies UI components to handle only presentation logic. This creates a more maintainable and testable architecture while preserving all functionality.

## Module Dependencies

This module requires the following Odoo modules to function:

- **mail**: Provides core messaging and channel infrastructure, enabling threaded conversations and notifications.
- **im_livechat**: Supplies the website live chat backend, including visitor chat sessions, operator handover, and chat channel management.
- **website_livechat**: (This module) Integrates live chat functionality with LLM Assistants.
- **llm_assistant**: Manages LLM assistant records, configuration, and API integration for AI-powered responses.
- **llm_knowledge**: Handles knowledge collections and retrieval, allowing assistants to access and use structured information during conversations.
- **llm_thread**: Tracks conversation threads for LLM-powered chats, ensuring continuity and proper message flow.

Each dependency is essential for bridging Odoo's live chat system with LLM-based AI assistants, enabling enhanced chatbot capabilities, knowledge-driven responses, and seamless website integration.

## Key Features

The LLM Website Assistant module extends Odoo's website live chat with the following capabilities:

- **LLM-Powered Chatbot Integration**: Enables website visitors to interact with AI assistants (LLMs) directly in live chat, providing dynamic, context-aware responses.
- **Configurable Assistant Selection**: Allows administrators to assign specific LLM assistants to live chat channels and rules, with visibility controls for public website use.
- **Knowledge Collection Restrictions**: Lets you restrict which knowledge collections each assistant can access, improving security and relevance of responses.
- **Enhanced Chatbot Script Steps**: Adds new step types for LLM-processed input, supporting continuous conversation and dynamic flow actions.
- **Automatic and Manual Handover**: Supports seamless handover from AI to human operators (chat or phone), including fallback mechanisms when no operators are available.
- **Streaming**: Patches native livechat frontend components to support real-time streaming of responses via Server-Sent Events (SSE).
- **Tool-Driven Flow Actions**: Integrates with Odoo's LLM tool framework, allowing assistants to trigger business actions (e.g., demo scheduling, lead creation) during chat.
- **Usage Statistics and Monitoring**: Tracks website chat sessions and assistant usage for reporting and optimization.

These features enable advanced, AI-driven website chat experiences while maintaining compatibility with Odoo's standard livechat infrastructure.

## High-Level Architecture

```{mermaid}
:zoom:
graph TB
    subgraph "Frontend Layer"
        WV[Website Visitor]
        LCB[LiveChat Button]:::extended
        LCW[LiveChat Window]
        CBS[ChatbotService]:::extended
        LCS[LivechatService]:::extended
    end
    
    subgraph "Controller Layer"
        LCBC[ChatbotScriptController]
        LLC[LlmLivechatController]:::added
    end
    
    subgraph "Model Layer"
        LCC[im_livechat.channel]
        LCCR[im_livechat.channel.rule]
        CS[chatbot.script]:::extended
        CSS[chatbot.script.step]:::extended
        LA[llm.assistant]:::extended
        DC[discuss.channel]:::extended
        KC[llm.knowledge.collection]
        LT[llm.tool]:::extended
    end
    
    subgraph "Tools"
        LTH[Livechat Handover Tool]:::added
        PTH[Phone Handover Tool]:::added
    end
    
    subgraph "External Services"
        LLM[LLM Provider<br/>OpenAI/Anthropic]
    end
    
    %% Native Odoo connections
    WV -->|Opens Chat| LCB
    LCB -->|Opens| LCW
    LCW -->|Uses| CBS
    LCW -->|Uses| LCS
    
    %% Service layer connections        
    LCB -->|Extended Init| LLC
    CBS -->|Process Steps| LCBC
    
    LLC -->|Creates/Manages| DC
    LLC -->|Follows| LCCR
    LCCR -->|Belongs To| LCC
    LCCR -->|References| CS
    CS -->|Contains| CSS
    
    %% LLM-specific connections
    LLC -->|Configure| CS
    CS -->|Execute| CSS
    CSS -->|Process| LA
    LA -->|Generate Response| DC
    LA -->|Access| KC
    LA -->|Use| LT
    DC -->|Stores| LA
    
    %% Service to backend connections
    LCS -->|SSE Stream| LLC
    
    %% Tool connections
    LT -->|Implements| LTH
    LT -->|Implements| PTH
    LTH -->|Trigger| DC
    PTH -->|Trigger| DC
    
    %% External service connection
    LA -->|API| LLM
    
    classDef frontend fill:#e3f2fd,stroke:#1976d2
    classDef controller fill:#f3e5f5,stroke:#7b1fa2
    classDef model fill:#e8f5e9,stroke:#388e3c
    classDef tools fill:#e1f5fe,stroke:#0288d1
    classDef external fill:#fff3e0,stroke:#f57c00
    
    classDef added fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef extended fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,stroke-dasharray: 5 5
    
    class WV,LCB,LCW,CBS,LCS frontend
    class LCBC,LLC controller
    class LCC,LCCR,CS,CSS,LA,DC,KC,LT model
    class LTH,PTH tools
    class LLM external
```


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

### 3. Frontend Extensions

The module uses a clean separation of concerns with patched services and a new coordinator:

#### Service Architecture

```javascript
// llm_livechat_service.js - Handles all network/thread operations
patch(LivechatService.prototype, {
    // Thread management
    async getOrCreateLLMThread(channelId, assistantId) { },
    async startLLMStreaming(threadId, message) { },
    async processLLMMessage(message, assistantId) { },
    cleanupLLMResources(channelId) { }
});

// llm_chatbot_service.js - Focuses only on script flow
patch(ChatbotService.prototype, {
    async _processUserAnswer(message) {
        if (this._isLLMStep()) {
            // Processes LLM step directly
            return this.processLLMStep({...});
        }
        return super._processUserAnswer(message);
    }
});

// Note: LLM Coordinator Service has been removed, with its functionality moved to:
// - ChatBotService (processLLMStep)
// - LivechatService (handleStreamingMessage)
            cleanup(channelId) { }
        };
    }
};

// livechat_button_extension.js - Pure UI component
patch(LivechatButton.prototype, {
    // Only visual state management
    state: {
        isLLMEnabled: false,
        showTypingIndicator: false
    },
    // Delegates all logic to coordinator
    onMessage(ev) {
        if (this.state.isLLMEnabled) {
            this.livechatService.handleStreamingMessage({...});
        }
    }
});
```

#### Key Design Principles

1. **LivechatService Extension**: Handles all thread management, network communication, and SSE streaming
2. **ChatbotService Extension**: Handles script flow, step processing, and LLM interactions
3. **UI Components**: Simplified to handle only visual state and user interactions

## Relevant Sequences

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

### 2. Message Flow with Refactored Architecture (LLM)

```
1. User sends message via frontend button
2. LivechatButton delegates to LivechatService
3. Coordinator orchestrates between ChatbotService and LivechatService
4. LivechatService handles thread creation and SSE streaming
5. ChatbotService manages script flow and step transitions
6. Backend processes LLM request and streams response
7. Coordinator handles stream events and updates UI
```

```{mermaid}
:zoom:
sequenceDiagram
    participant U as User
    participant LCB as LivechatButton
    participant LCS as LivechatService
    participant LCS as LivechatService
    participant CBS as ChatbotService
    participant LLC as LlmLivechatController
    participant LA as LLM Assistant
    
    U->>LCB: Send message
    LCB->>LLMC: handleStreamingMessage()
    
    LLMC->>LCS: processLLMMessage()
    LCS->>LCS: getOrCreateLLMThread()
    LCS->>LLC: /chatbot/llm/post
    
    LCS->>LLC: startLLMStreaming()
    LLC-->>LCS: EventSource
    
    LLMC->>CBS: processLLMStep()
    CBS->>LLC: /chatbot/step/trigger
    
    LLC->>LA: Generate response
    LA-->>LLC: Stream response
    
    LLC-->>LCS: SSE events
    LCS-->>LLMC: Stream updates
    LLMC-->>LCB: UI updates
    LCB-->>U: Display response
```

### 3. Chatbot Processing (LLM)

```
1. ChatbotService processes LLM step
2. Backend prepares thread with pending message in context
3. Returns streaming indicator to frontend
4. Frontend initiates SSE connection
5. Backend posts message and generates response
6. Stream events update UI in real-time
7. Handles flow actions if tools are invoked
```

```{mermaid}
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant CS as ChatbotService
    participant LLC as LlmLivechatController
    participant LT as LLM Thread
    participant T as LLM Tools
    U->>F: Input message
    F->>CS: Process input
    CS->>LLC: /chatbot/step/trigger
    LLC->>LLC: Store in context
    LLC-->>CS: {is_llm_streaming: true}
    CS->>LLC: SSE Connect
    LLC->>LT: generate()
    LT->>T: Invoke tools if needed
    T-->>LT: Tool results
    LT-->>LLC: Stream responses
    LLC-->>CS: SSE events
    CS-->>F: Update UI
```


### Data Flow Comparison

#### Standard Chatbot Flow (Native)
```
User Input → Script Step → Fixed Response → Next Step
```

#### LLM-Enhanced Flow (Original)
```
User Input → LLM Processing → Dynamic Response → Tool Action → Flow Dispatch
                     ↑                                              ↓
                     ←─────────── Stays on Same Step ←──────────────
```

#### LLM-Enhanced Flow (Current Architecture)
```
User Input → UI Component → ChatbotService → Backend Controller
                                                     ↓
                                           Store in Context → Return Stream Flag
                                                     ↓
                                           Frontend SSE Connect
                                                     ↓
                                           LLM Thread generate() → Stream Response
                                                     ↓
                                           Real-time UI Updates
```

### Service Responsibilities

#### LivechatService (Extended)
- **Thread Management**: Create, cache, and cleanup LLM threads
- **Network Operations**: Handle RPC calls for thread creation
- **SSE Management**: Manage EventSource connections for streaming
- **Resource Cleanup**: Proper cleanup on session end

#### ChatbotService (Extended)
- **Script Flow**: Process chatbot steps and transitions
- **LLM Detection**: Identify LLM steps and streaming responses
- **Stream Coordination**: Initiate SSE connections when needed
- **Flow Actions**: Handle tool-driven flow actions

#### Backend Integration
- **Context Usage**: Uses Odoo's context to pass data between requests
- **Reuses Infrastructure**: Leverages existing llm_thread generate() method
- **Streaming**: Standard SSE pattern with existing response format
- **No Duplication**: Avoids reimplementing existing functionality

## Security Considerations

### 1. Thread Isolation
- Each livechat session has its own LLM thread
- Thread access is validated through session tokens
- Proper cleanup ensures no data leakage between sessions

### 2. Service Layer Security
- All LLM operations go through authenticated RPC calls
- SSE streams use existing thread security
- Context data is session-scoped
- No persistent storage of temporary data

### 3. Knowledge Access Control
- Assistant visibility controls for public access
- Knowledge collection restrictions per assistant
- Tool permissions validated at execution time

## Integration Points

### 1. Backend Endpoints
- `/chatbot/step/trigger` - Step processing (detects LLM steps)
- `/chatbot/llm/stream` - SSE streaming (reuses llm_thread generate)
- `/im_livechat/llm/thread` - Thread management
- `/im_livechat/init` - Enhanced initialization with LLM data

### 2. Key Concepts
- **Context-based Communication**: Uses Odoo context to pass data
- **Stream Flag**: Backend returns `stream: true` for async processing
- **Pending Messages**: Stored in context until SSE connection
- **Reuses llm_thread**: No duplicate streaming implementation

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


## Performance Considerations

### 1. Selective Enhancement
- Only processes LLM steps when needed
- Falls back to native handling for standard steps
- Minimal overhead for non-LLM conversations

### 2. Efficient Streaming
- Reuses existing llm_thread generate() method
- No duplicate implementation of streaming logic
- Context-based message passing avoids extra DB writes

### 3. Resource Management
- Automatic cleanup of SSE connections
- Proper error handling and fallbacks
- Memory-efficient stream handling

### 4. Architecture Benefits
- Leverages existing infrastructure
- Avoids code duplication
- Maintains OOP principles
- Clean separation of concerns
