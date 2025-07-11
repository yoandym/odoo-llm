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

## LLM-Specific Architecture

### 1. Conversation Flow with LLM

```{mermaid}
sequenceDiagram
    participant V as Visitor
    participant CS as ChatbotService
    participant LCC as LlmChatbotController
    participant LA as LLM Assistant
    participant T as LLM Tools
    participant DC as discuss.channel

    V->>CS: Send message
    CS->>LCC: /chatbot/step/process
    LCC->>LA: Generate response
    LA->>T: Invoke tools if needed
    T-->>LA: Tool results + flow_action
    LA-->>LCC: Response + metadata
    LCC->>DC: Post message
    LCC-->>CS: Format response
    CS-->>V: Display message
```

### 2. Tool-Driven Flow Actions

The module implements a dynamic dispatch pattern that bridges LLM tool responses with native Odoo actions:

```python
# Tool response format
{
    "message": "I'll connect you with an operator.",
    "flow_action": "forward_to_operator",
    "data": {...}
}

# Dynamic method dispatch
method_name = f"_process_flow_action_{flow_action}"
if hasattr(self, method_name):
    return getattr(self, method_name)(response_data)
```

**Supported Flow Actions:**
- `forward_to_operator`: Leverages native operator handover
- `phone_callback`: Uses existing phone step type
- `create_ticket`: Integrates with helpdesk if available
- `collect_email`: Reuses email validation logic

### 3. LLM Tools Integration

The module provides specialized tools that understand livechat context:

#### LivechatHandoverTool
```python
class LivechatHandoverTool(models.Model):
    _name = "llm.tool.livechat.handover"
    
    def _run(self, thread_id):
        # Check operator availability
        # Return appropriate flow action
        # Maintain conversation context
```

#### PhoneHandoverTool
```python
class PhoneHandoverTool(models.Model):
    _name = "llm.tool.phone.handover"
    
    def _run(self, thread_id, phone_number):
        # Validate phone number
        # Create callback request
        # Trigger appropriate workflow
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

## Security Considerations

### 1. Public Access Control
```python
# Only website-visible assistants
domain="[('is_website_visible', '=', True)]"

# Restricted knowledge access
if collection_id not in assistant.allowed_knowledge_collections:
    raise AccessError()
```

### 2. Session Isolation
- Each visitor gets isolated thread
- No cross-session data leakage
- Proper sudo usage for public operations

## Migration Path

For existing chatbot scripts:
1. Enable LLM on existing script
2. Select appropriate assistant
3. Run `action_create_llm_steps()`
4. Configure tool permissions
5. Test with existing rules

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