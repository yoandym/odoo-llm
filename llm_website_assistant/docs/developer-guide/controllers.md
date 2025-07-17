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
        +get_or_create_thread(channel_id, assistant_id)
        +post_website_message(thread_id, message)
        +stream_llm_response(thread_id)
        -_stream_generator(thread_id)
    }
    
    LivechatController <|-- LlmLivechatController : extends
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

### Additional LLM Endpoints in LlmLivechatController

The main controller now includes dedicated endpoints for LLM chat functionality:

#### Methods

##### `get_or_create_thread(channel_id, assistant_id=None)`

```python
@http.route("/im_livechat/llm/thread", type="json", auth="public", website=True)
def get_or_create_thread(self, channel_id, assistant_id=None, **kwargs):
    """Create or retrieve an LLM thread for a livechat channel"""
```

**Endpoint:** `/im_livechat/llm/thread`

**Parameters:**
- `channel_id` (int): ID of the discussion channel
- `assistant_id` (int, optional): Specific assistant to use

**Process:**
1. Validates channel existence
2. If no assistant configured, selects default or available assistant
3. Configures channel with LLM model and provider
4. Returns thread information

**Response:**
```javascript
{
    "success": true,
    "thread_id": 123,
    "has_assistant": true
}
```

##### `post_website_message(thread_id, channel_id=None, message=None)`

```python
@http.route("/chatbot/llm/post", type="json", auth="public", website=True)
def post_website_message(self, thread_id, channel_id=None, message=None, **kwargs):
    """Post a message to an LLM thread from website"""
```

**Endpoint:** `/chatbot/llm/post`

**Parameters:**
- `thread_id` (int): Thread/channel ID (same in new architecture)
- `message` (str): User's message content
- `channel_id` (int, optional): Legacy parameter for compatibility

**Response:**
```javascript
{
    "success": true,
    "message_id": 456,
    "thread_id": 123
}
```

##### `stream_llm_response(thread_id, channel_id=None)`

```python
@http.route("/chatbot/llm/stream", type="http", auth="public", website=True)
def stream_llm_response(self, thread_id, channel_id=None, **kwargs):
    """Stream LLM responses via Server-Sent Events (SSE)"""
```

**Endpoint:** `/chatbot/llm/stream`

**Parameters:**
- `thread_id` (int): Thread/channel ID to stream responses for

**SSE Events:**
```javascript
// Content chunk
data: {"type": "content", "content": "AI response text..."}

// Error event
data: {"type": "error", "error": "Error message"}

// Completion event
data: {"type": "done"}
```

**Headers:**
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `X-Accel-Buffering: no` (for nginx compatibility)

## Integration Points

### Authentication

- All endpoints use `auth="public"` for website visitor access
- Operations use `sudo()` with proper security checks
- Channel ID/UUID validation prevents unauthorized access

### Implementation Notes

- The controller consolidates all LLM functionality in one place
- SSE streaming is handled directly without a separate service
- Missing `json` import in the controller should be added for the `_stream_generator` method

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