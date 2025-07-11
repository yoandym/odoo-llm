# Controllers Documentation

The module extends existing `im_livechat` controllers to add LLM functionality while maintaining full compatibility with the standard livechat system.

## Controller Architecture

```{mermaid}
classDiagram
    class LivechatController {
        +livechat_init(channel_id)
    }
    
    class LlmLivechatController {
        +livechat_init(channel_id)
        -_get_matching_rule(channel_id)
    }
    
    class LivechatChatbotScriptController {
        +chatbot_process_step(channel_uuid, step_id, user_input)
    }
    
    class LlmChatbotController {
        +chatbot_process_step(channel_uuid, step_id, user_input)
    }
    
    LivechatController <|-- LlmLivechatController : extends
    LivechatChatbotScriptController <|-- LlmChatbotController : extends
```

## Main Controllers

### LlmLivechatController

**Inherits:** `im_livechat.controllers.main.LivechatController`

**Purpose:** Extends the livechat initialization to include LLM assistant information.

#### Methods

##### `livechat_init(channel_id)`

```python
@http.route()
def livechat_init(self, channel_id):
    """Override to add LLM assistant data to initialization"""
```

**Endpoint:** `/im_livechat/init` (inherited)

**Process:**
1. Calls parent implementation to get standard data
2. Finds matching channel rule
3. Checks if rule has LLM-enabled chatbot script
4. Adds LLM-specific attributes to result:
   - `isLlmEnabled`: Boolean flag
   - `llmAssistantId`: Assistant record ID
   - `llmAssistantName`: Assistant display name

**Response Enhancement:**
```javascript
{
    "rule": {
        "chatbot": {
            // Standard chatbot data...
            "isLlmEnabled": true,
            "llmAssistantId": 5,
            "llmAssistantName": "Customer Support AI"
        }
    }
}
```

### LlmChatbotController

**Inherits:** `im_livechat.controllers.chatbot.LivechatChatbotScriptController`

**Purpose:** Handles LLM-powered chatbot step processing.

#### Methods

##### `chatbot_process_step(channel_uuid, step_id, user_input)`

```python
@http.route('/chatbot/step/process', type="json", auth="public", cors="*")
def chatbot_process_step(self, channel_uuid, step_id, user_input):
    """Process user input for LLM-enabled chatbot steps"""
```

**Endpoint:** `/chatbot/step/process`

**Parameters:**
- `channel_uuid` (str): UUID of the discussion channel
- `step_id` (int): Current chatbot step ID
- `user_input` (str): User's message text

**Process:**
1. Validates channel and step existence
2. Checks if script is LLM-enabled
3. Calls `process_llm_step()` on the step
4. Formats response for frontend consumption

**Response Format:**
```javascript
{
    "chatbot_posted_message": {
        "id": 123,
        "body": "<p>AI response here...</p>",
        "author_id": [45, "AI Assistant"],
        // Standard message fields...
    },
    "chatbot_step": {
        "id": 67,
        "type": "llm_processed_input",
        "isLlmStep": true,
        "operatorFound": false,
        "isLast": false,
        "message": "How can I help you?",
        "answers": []
    }
}
```

## Integration Points

### Authentication

- Both controllers use `auth="public"` for website visitor access
- Operations use `sudo()` with proper security checks
- Channel UUID validation prevents unauthorized access

### Language Support

```python
chatbot_language = self._get_chatbot_language()
discuss_channel = request.env['discuss.channel']\
    .with_context(lang=chatbot_language)\
    .sudo().search([('uuid', '=', channel_uuid)], limit=1)
```

### Error Handling

```python
try:
    result = current_step.process_llm_step(discuss_channel, user_input)
    # Process result...
except Exception as e:
    _logger.exception("Error processing LLM chatbot step: %s", e)
    return None
```

## Request/Response Flow

```{mermaid}
sequenceDiagram
    participant B as Browser
    participant LC as LlmLivechatController
    participant CBC as LlmChatbotController
    participant M as Models
    participant AI as AI Services
    
    B->>LC: GET /im_livechat/init
    LC->>M: Get channel & rules
    M-->>LC: Channel data
    LC->>LC: Check LLM config
    LC-->>B: Init data + LLM info
    
    Note over B: User starts chat
    
    B->>CBC: POST /chatbot/step/process
    CBC->>M: Get channel & step
    M-->>CBC: Validation OK
    CBC->>M: process_llm_step()
    M->>AI: Generate response
    AI-->>M: AI response
    M-->>CBC: Message + next step
    CBC-->>B: Formatted response
```

## Security Considerations

### Channel Validation

```python
discuss_channel = request.env['discuss.channel']\
    .sudo().search([('uuid', '=', channel_uuid)], limit=1)

if not discuss_channel or not discuss_channel.chatbot_current_step_id:
    return None
```

### Script Validation

```python
current_step = request.env['chatbot.script.step'].sudo().browse(step_id)
if not current_step.exists() or not current_step.chatbot_script_id.is_llm_enabled:
    return None
```

### CORS Support

The chatbot endpoint includes `cors="*"` to support cross-origin requests from embedded chat widgets.

## Best Practices

1. **Always validate channel UUID** to prevent unauthorized access
2. **Check LLM enablement** before processing
3. **Handle exceptions gracefully** - return None or error response
4. **Use language context** for multilingual support
5. **Format responses consistently** for frontend compatibility
6. **Log errors** for debugging while avoiding sensitive data exposure