# Controllers

The LLM Thread module provides HTTP controllers for real-time streaming chat functionality and message operations.

## LLMThreadController

Main controller handling chat operations and streaming responses.

```python
class LLMThreadController(http.Controller):
    """Controller for LLM thread operations and streaming chat"""
```

## Endpoints

### Thread Generation (Streaming)

```python
@http.route("/llm/thread/generate", type="http", auth="user", csrf=True)
def llm_thread_generate(self, thread_id, message=None, **kwargs):
    """
    Streams AI responses using Server-Sent Events (SSE).
    
    Args:
        thread_id: ID of the thread to generate in
        message: Optional user message to send
        
    Returns:
        Response: SSE stream with real-time updates
    """
```

**Request Example**:
```javascript
const eventSource = new EventSource(
    `/llm/thread/generate?thread_id=${threadId}&message=${encodeURIComponent(userMessage)}`
);
```

**Response Format** (Server-Sent Events):
```
data: {"type": "message_create", "message": {...}}

data: {"type": "message_chunk", "message": {"body": "Partial response..."}}

data: {"type": "message_update", "message": {...}}

data: {"type": "done"}
```

### Thread Update

```python
@http.route("/llm/thread/<int:thread_id>/update", type="json", auth="user", 
            methods=["POST"], csrf=True)
def llm_thread_update(self, thread_id, **kwargs):
    """
    Updates thread attributes.
    
    Args:
        thread_id: Thread ID to update
        **kwargs: Fields to update
        
    Returns:
        dict: {"status": "success"} or {"status": "error", "error": "..."}
    """
```

**Request Example**:
```javascript
await fetch('/llm/thread/123/update', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
            name: "Updated Thread Name",
            tool_ids: [[6, 0, [1, 2, 3]]]
        }
    })
});
```

### Message Voting

```python
@http.route("/llm/message/vote", type="json", auth="user", methods=["POST"])
def llm_message_vote(self, message_id, vote_value):
    """
    Updates user vote on an AI message.
    
    Args:
        message_id: Message ID to vote on
        vote_value: 1 (upvote), -1 (downvote), or 0 (clear)
        
    Returns:
        dict: {"success": true} or {"error": "..."}
    """
```

**Request Example**:
```javascript
await fetch('/llm/message/vote', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
            message_id: 456,
            vote_value: 1  // Upvote
        }
    })
});
```

## Streaming Architecture

### Server-Sent Events (SSE) Flow

```{mermaid}
sequenceDiagram
    participant Browser
    participant Controller
    participant Thread
    participant AI Provider
    
    Browser->>Controller: GET /llm/thread/generate
    Controller->>Controller: Set SSE Headers
    Controller->>Thread: generate(message)
    
    loop Streaming Response
        Thread->>AI Provider: Request chunk
        AI Provider-->>Thread: Response chunk
        Thread-->>Controller: Yield event
        Controller-->>Browser: data: {event}\n\n
    end
    
    Controller-->>Browser: data: {"type": "done"}\n\n
    Browser->>Browser: Close connection
```

### Response Headers

The streaming endpoint sets specific headers for SSE:

```python
headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",  # Disable nginx buffering
}
```

## Error Handling

### Connection Management

The controller handles various connection scenarios:

```python
def _safe_yield(self, data_to_yield):
    """
    Safely yields data, handling disconnections.
    
    Returns:
        bool: True if successful, False if client disconnected
    """
    try:
        yield data_to_yield
        return True
    except BrokenPipeError:
        # Client disconnected
        return False
```

### Error Events

Errors are sent as SSE events:

```python
# Error event format
yield f'data: {{"type": "error", "error": "Error message"}}\n\n'.encode()
```

### Thread Locking

The controller ensures proper cleanup of thread locks:

```python
try:
    for response in llmThread.generate(user_message_body):
        # Stream responses...
except GeneratorExit:
    # Client disconnected - unlock thread
    if llmThread.exists() and llmThread._read_is_locked_decorated():
        llmThread._unlock()
```

## Event Types

### Message Events

| Event Type | Description | Data Structure |
|------------|-------------|----------------|
| `message_create` | New message created | `{type, message: {id, body, author_id, ...}}` |
| `message_chunk` | Streaming content update | `{type, message: {id, body, ...}}` |
| `message_update` | Final message update | `{type, message: {id, body, tool_calls, ...}}` |
| `error` | Error occurred | `{type, error: "Error description"}` |
| `done` | Generation complete | `{type: "done"}` |

## Frontend Integration

### EventSource Usage

```javascript
class LLMChatService {
    streamMessage(threadId, message) {
        const eventSource = new EventSource(
            `/llm/thread/generate?thread_id=${threadId}&message=${encodeURIComponent(message)}`
        );
        
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch(data.type) {
                case 'message_create':
                    this.handleNewMessage(data.message);
                    break;
                case 'message_chunk':
                    this.updateMessageContent(data.message);
                    break;
                case 'message_update':
                    this.finalizeMessage(data.message);
                    break;
                case 'error':
                    this.handleError(data.error);
                    break;
                case 'done':
                    eventSource.close();
                    break;
            }
        };
        
        eventSource.onerror = (error) => {
            console.error('SSE Error:', error);
            eventSource.close();
        };
        
        return eventSource;
    }
}
```

### JSON-RPC Integration

For non-streaming operations:

```javascript
async updateThread(threadId, data) {
    const response = await this.rpc('/llm/thread/' + threadId + '/update', data);
    if (response.status === 'error') {
        throw new Error(response.error);
    }
    return response;
}
```

## Security Considerations

1. **Authentication**: All endpoints require user authentication (`auth="user"`)
2. **CSRF Protection**: JSON and form endpoints have CSRF protection enabled
3. **Thread Access**: Controllers verify user has access to the thread
4. **Input Validation**: Message IDs and vote values are validated

## Performance Optimizations

### Streaming Efficiency

- Uses generators to minimize memory usage
- Implements connection detection to avoid wasting resources
- Direct passthrough response for minimal buffering

### Database Connection Management

```python
def _llm_thread_generate(self, dbname, env, thread_id, user_message_body, **kwargs):
    """Uses separate cursor for long-running operations"""
    with registry(dbname).cursor() as cr:
        env = api.Environment(cr, env.uid, env.context)
        # Process with isolated cursor...
```

## Error Response Examples

### Missing Thread
```json
{
    "type": "error",
    "error": "LLM Thread not found."
}
```

### Invalid Vote
```json
{
    "error": "Invalid message ID or vote value format."
}
```

### Generation Error
```json
{
    "type": "error",
    "error": "Failed to connect to AI provider"
}
```

## Best Practices

1. **Always handle connection errors** in frontend EventSource implementations
2. **Implement reconnection logic** for dropped SSE connections
3. **Validate all inputs** before processing
4. **Use proper error messages** that are user-friendly
5. **Clean up resources** (unlock threads) on disconnection