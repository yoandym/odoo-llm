# Testing and Debugging

This guide covers testing strategies and debugging techniques for the LLM Thread module.

## Testing

### Unit Tests

```python
from odoo.tests import TransactionCase

class TestLLMThread(TransactionCase):
    
    def setUp(self):
        super().setUp()
        self.provider = self.env['llm.provider'].create({
            'name': 'Test Provider',
            'provider_type': 'openai',
        })
        self.model = self.env['llm.model'].create({
            'name': 'Test Model',
            'provider_id': self.provider.id,
            'model_use': 'chat',
        })
    
    def test_thread_creation(self):
        thread = self.env['llm.thread'].create({
            'name': 'Test Thread',
            'provider_id': self.provider.id,
            'model_id': self.model.id,
        })
        self.assertEqual(thread.name, 'Test Thread')
        self.assertFalse(thread.is_locked)
    
    def test_message_sending(self):
        thread = self.env['llm.thread'].create({
            'name': 'Test Thread',
            'provider_id': self.provider.id,
            'model_id': self.model.id,
        })
        result = thread.send_message("Test message")
        self.assertTrue(result['success'])
```

### Integration Tests

```python
from odoo.tests import HttpCase

class TestLLMThreadHTTP(HttpCase):
    
    def test_streaming_endpoint(self):
        # Create thread
        thread = self.env['llm.thread'].create({
            'name': 'Stream Test',
            'provider_id': self.provider_id,
            'model_id': self.model_id,
        })
        
        # Test streaming
        response = self.url_open(
            '/llm/thread/generate',
            data={'thread_id': thread.id, 'message': 'Hello'},
            timeout=30
        )
        self.assertEqual(response.status_code, 200)
```

### Testing Tools

```python
class TestCustomTool(TransactionCase):
    
    def test_tool_execution(self):
        """Test custom tool execution"""
        tool = self.env.ref('llm_thread.tool_example')
        
        # Test successful execution
        result = tool.execute({
            'query': 'test query',
            'thread_id': self.thread.id,
        })
        
        self.assertTrue(result['success'])
        self.assertIn('data', result)
        
    def test_tool_error_handling(self):
        """Test tool error handling"""
        tool = self.env.ref('llm_thread.tool_example')
        
        # Test with invalid arguments
        with self.assertRaises(ValidationError):
            tool.execute({})
```

### JavaScript Testing

```javascript
/** @odoo-module **/
import { describe, test, expect, beforeEach } from "@odoo/hoot";
import { mountWithCleanup } from "@web/../tests/helpers/utils";
import { LLMChatContainer } from "@llm_thread/components/llm_chat_container/llm_chat_container";

describe("LLMChatContainer", () => {
    let target;
    
    beforeEach(() => {
        target = getFixture();
    });
    
    test("renders chat interface", async () => {
        await mountWithCleanup(LLMChatContainer, target, {
            props: {
                threadId: 1,
                initialMessages: [],
            },
        });
        
        expect(".llm-chat-container").toHaveCount(1);
        expect(".message-input").toHaveCount(1);
    });
    
    test("sends message on button click", async () => {
        const component = await mountWithCleanup(LLMChatContainer, target, {
            props: {
                threadId: 1,
                initialMessages: [],
            },
        });
        
        // Type message
        await editInput(target, ".message-input", "Test message");
        
        // Click send
        await click(target, ".send-button");
        
        // Verify message sent
        expect(component.state.currentMessage).toBe("");
    });
});
```

## Debugging

### Enable Debug Logging

```python
import logging
_logger = logging.getLogger(__name__)

# In your code
_logger.debug("Thread %s starting generation", self.id)
_logger.info("Tool %s executed with args: %s", tool_name, arguments)
_logger.warning("Rate limit approaching: %s/%s", current, limit)
_logger.error("API call failed: %s", error)
```

### Browser DevTools

```javascript
// Enable verbose logging
window.odooDebug = true;

// Log service calls
console.log('LLM Service:', this.env.services.llm_chat);

// Trace component lifecycle
console.trace('Component mounted');

// Log streaming events
this.llmService.on('message_chunk', (data) => {
    console.log('Chunk received:', data);
});
```

### SQL Query Debugging

```python
# Enable SQL logging
import logging
logging.getLogger('odoo.sql_db').setLevel(logging.DEBUG)

# Profile queries
from odoo.tools.profiler import profile

@profile
def _get_message_history_recordset(self):
    """Profile SQL queries in this method"""
    return self.message_ids.filtered(
        lambda m: m.is_llm_message()
    )
```

### Stream Debugging

```python
def generate(self, user_message_body, **kwargs):
    """Debug streaming generation"""
    _logger.info("=== Starting generation for thread %s ===", self.id)
    
    try:
        for event in super().generate(user_message_body, **kwargs):
            _logger.debug("Event: %s", event)
            yield event
    except Exception as e:
        _logger.exception("Generation failed")
        raise
    finally:
        _logger.info("=== Generation complete ===")
```

### Common Issues

#### 1. Thread Locking Issues

```python
# Debug locking
def _lock(self):
    _logger.info("Attempting to lock thread %s", self.id)
    if self.is_locked:
        _logger.warning("Thread %s already locked!", self.id)
    super()._lock()
    _logger.info("Thread %s locked successfully", self.id)
```

#### 2. Streaming Connection Drops

```javascript
// Add reconnection debugging
this.eventSource.onerror = (error) => {
    console.error('SSE Error:', error);
    console.log('ReadyState:', this.eventSource.readyState);
    console.log('Attempting reconnection...');
};
```

#### 3. Tool Execution Failures

```python
def _process_tool_calls(self, assistant_msg):
    """Debug tool execution"""
    for tool_call in tool_calls:
        _logger.info("Executing tool: %s", tool_call['name'])
        _logger.debug("Arguments: %s", tool_call['arguments'])
        
        try:
            result = tool.execute(arguments)
            _logger.info("Tool result: %s", result)
        except Exception as e:
            _logger.exception("Tool execution failed")
            # Log full traceback
            import traceback
            _logger.error(traceback.format_exc())
```

### Performance Debugging

```python
import time
from contextlib import contextmanager

@contextmanager
def timer(name):
    """Time code execution"""
    start = time.time()
    yield
    end = time.time()
    _logger.info("%s took %.2f seconds", name, end - start)

# Usage
with timer("Message generation"):
    response = self._generate_ai_response(messages)
```

### Memory Profiling

```python
import tracemalloc

# Start tracing
tracemalloc.start()

# Your code here
thread.generate("Large conversation test")

# Get memory usage
current, peak = tracemalloc.get_traced_memory()
_logger.info(f"Current memory: {current / 10**6:.1f} MB")
_logger.info(f"Peak memory: {peak / 10**6:.1f} MB")
tracemalloc.stop()
```

## Test Data Fixtures

```xml
<!-- test_llm_thread.xml -->
<odoo>
    <record id="test_provider" model="llm.provider">
        <field name="name">Test Provider</field>
        <field name="provider_type">openai</field>
        <field name="api_key">test-key</field>
    </record>
    
    <record id="test_model" model="llm.model">
        <field name="name">Test Model</field>
        <field name="provider_id" ref="test_provider"/>
        <field name="model_use">chat</field>
        <field name="model_name">gpt-4</field>
    </record>
    
    <record id="test_thread" model="llm.thread">
        <field name="name">Test Thread</field>
        <field name="provider_id" ref="test_provider"/>
        <field name="model_id" ref="test_model"/>
    </record>
</odoo>
```

## Continuous Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Python
      uses: actions/setup-python@v2
      with:
        python-version: '3.10'
    
    - name: Install dependencies
      run: |
        pip install -r requirements.txt
        pip install -r requirements-dev.txt
    
    - name: Run tests
      run: |
        python -m pytest tests/
        
    - name: Run coverage
      run: |
        coverage run -m pytest tests/
        coverage report
```

## Best Practices

1. **Write tests first** - TDD approach for new features
2. **Mock external services** - Don't call real APIs in tests
3. **Use transactions** - Ensure test isolation
4. **Test edge cases** - Empty data, large data, invalid input
5. **Profile performance** - Identify bottlenecks early
6. **Log strategically** - Not too much, not too little
7. **Use debugging tools** - Odoo shell, pdb, browser devtools
8. **Document test scenarios** - Explain what and why you're testing
