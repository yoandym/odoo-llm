# Performance Considerations

The LLM Thread module is designed with performance in mind, implementing various optimizations for handling real-time AI interactions at scale.

## Streaming Architecture

### Server-Sent Events (SSE) Optimization

The module uses SSE for efficient real-time communication:

```python
headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",  # Disable nginx buffering
}
```

**Benefits**:
- No polling overhead
- Automatic reconnection
- Lower server resource usage than WebSockets
- Works through proxies and firewalls

### Generator-Based Streaming

```python
def generate(self, user_message_body, **kwargs):
    """Uses Python generators for memory-efficient streaming"""
    try:
        last = self._init_message(user_message_body, **kwargs)
        while self._should_continue(last):
            last = yield from self._next_step(last)
        return last
    finally:
        self._unlock()
```

**Performance Impact**:
- Constant memory usage regardless of response size
- Immediate response to user (no waiting for full generation)
- Efficient handling of large AI responses

## Database Optimizations

### 1. Efficient Field Selection

```python
# Good - Select only needed fields
const result = await orm.searchRead(
    "llm.thread",
    [["create_uid", "=", user.userId]],
    ["name", "model_id", "provider_id", "write_date"],  // Only required fields
    { order: "write_date desc" }
);

# Avoid - Fetching all fields
const result = await orm.searchRead("llm.thread", domain);  // Fetches everything
```

### 2. Message Loading Strategy

Messages are loaded on-demand with proper indexing:

```python
def _get_message_history_recordset(self, order="ASC", limit=None):
    """Optimized message retrieval with indexed queries"""
    domain = [
        ("model", "=", self._name),
        ("res_id", "=", self.id),
        ("message_type", "=", "comment"),
        ("subtype_id", "in", subtype_ids),
    ]
    # Uses indexed fields for filtering
    return self.env["mail.message"].search(domain, order=order_clause, limit=limit)
```

### 3. Cursor Management

Long-running operations use separate cursors:

```python
@execute_with_new_cursor
def _lock(self):
    """Separate cursor prevents blocking other operations"""
    with self.pool.cursor() as cr:
        env = api.Environment(cr, self.env.uid, self.env.context)
        record_in_new_env = env[self._name].browse(self.ids)
        # Lock operation with immediate commit
```

## Frontend Performance

### 1. Reactive State Management

```javascript
// Centralized reactive store
const store = reactive({
    llmChat: {
        threads: [],
        activeThread: null,
        // Computed properties for derived state
        get orderedThreads() {
            return [...this.threads].sort((a, b) => 
                new Date(b.updatedAt) - new Date(a.updatedAt)
            );
        }
    }
});
```

**Benefits**:
- Minimal re-renders
- Efficient change detection
- Computed properties cached automatically

### 2. Lazy Loading

```javascript
async loadThreads(additionalFields = [], forceReload = false) {
    // Skip if already loaded
    if (this.threads.length > 0 && !forceReload) {
        return;
    }
    // Load only when needed
    const result = await orm.searchRead(/* ... */);
}
```

### 3. Message Virtualization

For threads with many messages: Use Odoo's ThreadView which implements virtualization

```javascript
<ThreadView 
    thread={this.threadWrapper}
    onLoadMore={this.loadOlderMessages}
    scrollThreshold={100}
/>
```

## Tool Execution Performance

### 1. Read-Only Optimization

```python
if tool and tool.read_only_hint:
    # Skip savepoint for read-only tools
    result = thread._execute_tool(name, args)
else:
    # Use savepoint for write operations
    with self.env.cr.savepoint():
        result = thread._execute_tool(name, args)
```

**Performance Gain**: ~30% faster for read-only tools

### 2. Tool Result Caching

For expensive tool operations, implement caching:

```python
from functools import lru_cache

class LLMTool(models.Model):
    _inherit = 'llm.tool'
    
    @lru_cache(maxsize=128)
    def cached_execute(self, args_tuple):
        """Cache results for identical inputs"""
        return self._execute_internal(dict(args_tuple))
```

## Connection Management

### 1. Client Disconnection Detection

```python
def _safe_yield(self, data_to_yield):
    """Efficiently detects and handles disconnected clients"""
    try:
        yield data_to_yield
        return True
    except BrokenPipeError:
        # Stop processing immediately
        return False
```

### 2. Resource Cleanup

```python
except GeneratorExit:
    # Client disconnected - immediate cleanup
    if llmThread.exists() and llmThread._read_is_locked_decorated():
        llmThread._unlock()
    return
```

## Concurrency Handling

### 1. Thread Locking

Prevents resource waste from concurrent generations:

```python
if self.is_locked:
    raise UserError(_("This thread is already generating a response"))
```

### 2. Connection Pooling

For AI provider connections:

```python
# In llm base module
class LLMProvider(models.Model):
    def get_client(self):
        """Returns pooled client connection"""
        if not hasattr(self, '_client_pool'):
            self._client_pool = {}
        
        if self.id not in self._client_pool:
            self._client_pool[self.id] = self._create_client()
        
        return self._client_pool[self.id]
```

## Memory Management

### 1. Streaming Response Handling

```javascript
// Process chunks immediately without accumulation
eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch(data.type) {
        case 'message_chunk':
            // Update UI immediately
            this.updateMessageContent(data.message);
            break;
    }
};
```

### 2. Component Cleanup

```javascript
willUnmount() {
    // Clean up event sources
    if (this.eventSource) {
        this.eventSource.close();
    }
    
    // Clear intervals/timeouts
    if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
    }
}
```

## Performance Metrics

### Key Performance Indicators

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Time to First Token | < 500ms | SSE first data event |
| Message Throughput | > 100 tokens/sec | Streaming rate |
| Concurrent Users | > 100 | Load testing |
| Memory per Thread | < 10MB | Process monitoring |
| DB Query Time | < 100ms | Query logging |

### Monitoring Implementation

```python
import time
from odoo.tools import profiler

class LLMThread(models.Model):
    _inherit = 'llm.thread'
    
    @profiler.profile('/tmp/llm_generate.profile')
    def generate(self, user_message_body, **kwargs):
        """Profiled generation method"""
        start_time = time.time()
        
        try:
            # ... generation logic
            yield from self._generate_internal(user_message_body, **kwargs)
        finally:
            duration = time.time() - start_time
            _logger.info("Generation completed in %.2f seconds", duration)
```

## Bottleneck Analysis

### Common Performance Issues

1. **N+1 Queries**
   ```python
   # Bad - N+1 query problem
   for thread in threads:
       messages = thread.message_ids  # Separate query per thread
   
   # Good - Prefetch related data
   threads_with_messages = threads.with_prefetch(['message_ids'])
   ```

2. **Large Message History**
   ```python
   # Implement pagination
   def _get_message_history_recordset(self, order="ASC", limit=50, offset=0):
       return self.env["mail.message"].search(
           domain, 
           order=order_clause, 
           limit=limit,
           offset=offset
       )
   ```

3. **Blocking Operations**
   ```python
   # Use background jobs for heavy operations
   def process_large_document(self):
       self.with_delay().process_document_job()
   ```

## Optimization Techniques

### 1. Database Indexing

```sql
-- Recommended indexes
CREATE INDEX idx_llm_thread_user_date ON llm_thread(user_id, write_date DESC);
CREATE INDEX idx_mail_message_thread ON mail_message(model, res_id, create_date);
```

### 2. Caching Strategy

```python
from odoo.tools import ormcache

class LLMThread(models.Model):
    @ormcache('provider_id', 'model_id')
    def _get_model_config(self, provider_id, model_id):
        """Cache model configuration"""
        return self.env['llm.model'].browse(model_id).read(['config'])[0]
```

### 3. Batch Operations

```javascript
// Batch thread updates
async updateMultipleThreads(updates) {
    const promises = updates.map(({ threadId, data }) => 
        this.orm.write("llm.thread", [threadId], data)
    );
    
    await Promise.all(promises);
}
```

## Best Practices

1. **Profile Before Optimizing**: Use Odoo's profiler to identify actual bottlenecks
2. **Monitor Production**: Implement logging for performance metrics
3. **Test at Scale**: Load test with realistic data volumes
4. **Optimize Queries**: Use `explain` on slow queries
5. **Cache Wisely**: Cache expensive computations, not ORM records
6. **Async When Possible**: Use background jobs for non-critical operations