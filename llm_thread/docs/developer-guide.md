# Developer Guide

## Overview

This guide provides comprehensive information for developers working with the Easy AI Chat module. Learn how to extend functionality, create custom tools, integrate with other modules, and build on top of the AI chat framework.

## Architecture

### Module Structure

```
llm_thread/
├── __init__.py              # Module initialization
├── __manifest__.py          # Module manifest
├── models/
│   ├── __init__.py
│   ├── llm_thread.py       # Main thread model
│   └── mail_message.py     # Message extensions
├── controllers/
│   ├── __init__.py
│   └── llm_thread.py       # HTTP endpoints
├── static/src/
│   ├── components/         # React components
│   ├── services/           # JavaScript services
│   └── core/               # Core patches
├── views/
│   ├── llm_thread_views.xml
│   └── menu.xml
├── security/
│   ├── ir.model.access.csv
│   └── llm_thread_security.xml
└── docs/                   # Documentation
```

### Core Components

1. **LLMThread Model**: Manages conversation threads
2. **Message Extensions**: Enhances mail.message for AI
3. **Streaming Controller**: Handles real-time responses
4. **JavaScript Components**: React-based UI
5. **Tool Integration**: Extensible tool system

## Development Setup

### Prerequisites

```bash
# Development dependencies
pip install -r requirements-dev.txt

# Install pre-commit hooks
pre-commit install

# JavaScript dependencies
npm install
```

### Development Environment

1. **Enable Developer Mode** in Odoo
2. **Install developer tools**:
   ```bash
   pip install pytest pytest-odoo coverage
   ```
3. **Configure IDE** for Odoo development

## Key Models and APIs

### LLMThread Model

The main model managing AI conversations:

```python
from odoo import api, fields, models

class LLMThread(models.Model):
    _name = 'llm.thread'
    _inherit = ['mail.thread']
    
    # Key methods
    def generate(self, user_message_body, **kwargs):
        """Generate AI response with streaming"""
        
    def _process_tool_calls(self, assistant_msg):
        """Process and execute tool calls"""
        
    def send_message(self, message_content):
        """Send a message and trigger AI response"""
```

### Message Extensions

Enhances mail.message for AI-specific features:

```python
class MailMessage(models.Model):
    _inherit = 'mail.message'
    
    # AI-specific fields
    tool_calls = fields.Text("Tool Calls JSON")
    tool_call_id = fields.Char("Tool Call ID")
    tool_call_result = fields.Text("Tool Result")
    
    # Methods
    def is_llm_assistant_message(self):
        """Check if message is from AI assistant"""
    
    def is_llm_user_message(self):
        """Check if message is from user"""
```

## Creating Custom Tools

### Tool Structure

Create a new tool by extending `llm.tool`:

```python
from odoo import api, fields, models
import json

class MyCustomTool(models.Model):
    _inherit = 'llm.tool'
    
    @api.model
    def my_tool_execute(self, arguments):
        """Execute custom tool logic
        
        Args:
            arguments (dict): Tool arguments from AI
            
        Returns:
            dict: Tool execution result
        """
        # Parse arguments
        search_term = arguments.get('search_term', '')
        
        # Execute tool logic
        records = self.env['res.partner'].search([
            ('name', 'ilike', search_term)
        ])
        
        # Return result
        return {
            'success': True,
            'data': [{
                'id': r.id,
                'name': r.name,
                'email': r.email
            } for r in records[:5]]
        }
```

### Tool Registration

Register your tool in data XML:

```xml
<odoo>
    <record id="tool_search_partners" model="llm.tool">
        <field name="name">search_partners</field>
        <field name="description">Search for partners by name</field>
        <field name="implementation">my_tool</field>
        <field name="schema">{
            "type": "object",
            "properties": {
                "search_term": {
                    "type": "string",
                    "description": "Name to search for"
                }
            },
            "required": ["search_term"]
        }</field>
        <field name="active">True</field>
        <field name="default">False</field>
    </record>
</odoo>
```

### Thread-Aware Tools

Tools can access the current thread context:

```python
def context_aware_tool_execute(self, arguments):
    """Tool that uses thread context"""
    # Get thread from arguments (auto-injected)
    thread_id = arguments.get('thread_id')
    thread = self.env['llm.thread'].browse(thread_id)
    
    # Access linked record
    if thread.model and thread.res_id:
        linked_record = thread.get_related_record()
        # Use linked record in tool logic
```

## JavaScript Development

### Component Structure

Create React components for UI:

```javascript
/** @odoo-module **/
import { Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class LLMChatCustom extends Component {
    static template = "llm_thread.ChatCustom";
    static props = {
        threadId: Number,
        // ... other props
    };
    
    setup() {
        this.llmService = useService("llm_chat");
        this.notification = useService("notification");
    }
    
    async sendMessage() {
        try {
            await this.llmService.sendMessage(
                this.props.threadId,
                this.state.message
            );
        } catch (error) {
            this.notification.add(error.message, { type: 'danger' });
        }
    }
}
```

### Service Development

Create services for business logic:

```javascript
/** @odoo-module **/
import { registry } from "@web/core/registry";

export const llmChatService = {
    dependencies: ["rpc", "bus_service"],
    
    start(env, { rpc, bus_service }) {
        // Service implementation
        return {
            async sendMessage(threadId, message) {
                // Implementation
            },
            
            subscribeToThread(threadId, callback) {
                // Real-time subscription
            }
        };
    }
};

registry.category("services").add("llm_chat_custom", llmChatService);
```

## Integration Examples

### Integrating with Sales Module

```python
class SaleOrder(models.Model):
    _inherit = 'sale.order'
    
    def action_open_ai_assistant(self):
        """Open AI chat for this sale order"""
        thread = self.env['llm.thread'].create({
            'name': f'Assistant for {self.name}',
            'model': 'sale.order',
            'res_id': self.id,
            'provider_id': self._get_default_provider_id(),
            'model_id': self._get_default_model_id(),
        })
        
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'llm.thread',
            'res_id': thread.id,
            'view_mode': 'form',
            'target': 'current',
        }
```

### Creating a Wizard

```python
class LLMThreadWizard(models.TransientModel):
    _name = 'llm.thread.wizard'
    _description = 'AI Thread Creation Wizard'
    
    name = fields.Char(required=True)
    provider_id = fields.Many2one('llm.provider', required=True)
    model_id = fields.Many2one('llm.model', required=True)
    initial_message = fields.Text('Initial Message')
    
    def action_create_thread(self):
        thread = self.env['llm.thread'].create({
            'name': self.name,
            'provider_id': self.provider_id.id,
            'model_id': self.model_id.id,
        })
        
        if self.initial_message:
            thread.send_message(self.initial_message)
        
        return thread.get_formview_action()
```

## API Endpoints

### Streaming Endpoint

```python
@http.route('/llm/thread/generate', type='http', auth='user', csrf=True)
def llm_thread_generate(self, thread_id, message=None, **kwargs):
    """Stream AI responses using Server-Sent Events"""
    headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
    }
    
    return Response(
        self._llm_thread_generate(
            request.cr.dbname, 
            request.env, 
            thread_id, 
            message
        ),
        direct_passthrough=True,
        headers=headers,
    )
```

### REST API Usage

```python
# External API usage example
import requests

# Send message
response = requests.post(
    'https://odoo.example.com/llm/thread/generate',
    headers={'Cookie': session_cookie},
    data={
        'thread_id': 123,
        'message': 'Hello AI'
    },
    stream=True
)

# Process streaming response
for line in response.iter_lines():
    if line:
        data = json.loads(line.decode('utf-8').replace('data: ', ''))
        print(data)
```

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

## Performance Optimization

### Database Queries

```python
# Optimize message fetching
def _get_message_history_optimized(self):
    """Fetch messages with prefetching"""
    messages = self._get_message_history_recordset()
    # Prefetch related fields
    messages.mapped('author_id.name')
    messages.mapped('subtype_id.name')
    return messages
```

### Caching

```python
from odoo.tools import ormcache

class LLMThread(models.Model):
    _inherit = 'llm.thread'
    
    @ormcache('provider_id')
    def _get_provider_config(self):
        """Cache provider configuration"""
        return {
            'api_key': self.provider_id.api_key,
            'api_url': self.provider_id.api_url,
            'timeout': self.provider_id.timeout,
        }
```

## Security Considerations

### Input Validation

```python
def _validate_message_content(self, content):
    """Validate and sanitize user input"""
    if not content or not content.strip():
        raise ValidationError(_("Message cannot be empty"))
    
    # Limit message length
    if len(content) > 10000:
        raise ValidationError(_("Message too long"))
    
    # Additional validation as needed
    return content.strip()
```

### Access Control

```python
def _check_thread_access(self):
    """Ensure user has access to thread"""
    if not self.env.user.has_group('llm_thread.group_llm_user'):
        raise AccessError(_("Insufficient privileges"))
    
    # Additional checks for thread ownership, etc.
```

## Debugging

### Enable Debug Logging

```python
import logging
_logger = logging.getLogger(__name__)

# In your code
_logger.debug("Thread %s starting generation", self.id)
_logger.info("Tool %s executed with args: %s", tool_name, arguments)
```

### Browser DevTools

```javascript
// Enable verbose logging
window.odooDebug = true;

// Log service calls
console.log('LLM Service:', this.env.services.llm_chat);
```

## Common Patterns

### Async Processing

```python
def process_async(self):
    """Process in background job"""
    self.with_delay().generate_response()
    
@job
def generate_response(self):
    """Background job for AI generation"""
    # Long-running AI generation
```

### Event Handling

```python
@api.model
def _register_hook(self):
    """Register event hooks"""
    super()._register_hook()
    
    # Subscribe to events
    self.env['bus.bus']._subscribe_to_channel(
        'llm.thread',
        self._handle_thread_event
    )
```

## Deployment

### Production Checklist

- [ ] Configure production AI API keys
- [ ] Set appropriate timeouts
- [ ] Enable response caching
- [ ] Configure rate limiting
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Test scaling scenarios

### Environment Variables

```bash
# Production settings
export LLM_THREAD_TIMEOUT=300
export LLM_THREAD_MAX_TOKENS=4000
export LLM_THREAD_CACHE_TTL=3600
```

## Contributing

### Code Style

Follow Odoo coding guidelines:
- PEP 8 for Python
- ESLint for JavaScript
- Use type hints where appropriate

### Pull Request Process

1. Fork the repository
2. Create feature branch
3. Write tests
4. Update documentation
5. Submit PR with description

## Resources

- [Odoo Development Docs](https://www.odoo.com/documentation/17.0/developer.html)
- [OWL Documentation](https://github.com/odoo/owl)
- [AI Provider APIs](https://platform.openai.com/docs)
- [Module Repository](https://github.com/apexive/odoo-llm)
