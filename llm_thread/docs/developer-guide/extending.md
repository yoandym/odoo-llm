
# Extending

This guide provides comprehensive information on extending the Easy AI Chat module, including creating custom tools, integrating with other modules, and building on top of the AI chat framework.

## Extension Points

The module provides several extension points for customization:

1. **Custom Tools**: Add new AI capabilities via the tool system
2. **Message Hooks**: Pre/post-processing of messages
3. **UI Components**: Override or extend frontend components
4. **Provider Integration**: Add new AI providers through the base module

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

## Message Hooks

### Preprocessing Messages

Override `_get_prepend_messages` to add context:

```python
class LLMThreadCustom(models.Model):
    _inherit = 'llm.thread'
    
    def _get_prepend_messages(self):
        """Add system context to conversations"""
        messages = super()._get_prepend_messages()
        
        # Add context based on linked record
        if self.model == 'sale.order' and self.res_id:
            order = self.env['sale.order'].browse(self.res_id)
            messages.append({
                'role': 'system',
                'content': f'You are helping with sales order {order.name}. '
                          f'Customer: {order.partner_id.name}. '
                          f'Total: {order.amount_total} {order.currency_id.name}.'
            })
        
        return messages
```

### Post-Processing Responses

```python
def generate(self, user_message_body, **kwargs):
    """Override to add post-processing"""
    for event in super().generate(user_message_body, **kwargs):
        # Post-process events
        if event.get('type') == 'message_update':
            # Custom processing
            self._process_ai_response(event['message'])
        yield event
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

## JavaScript Extensions

### Extending Components

```javascript
/** @odoo-module **/
import { LLMChatContainer } from "@llm_thread/components/llm_chat_container/llm_chat_container";
import { patch } from "@web/core/utils/patch";

patch(LLMChatContainer.prototype, {
    setup() {
        super.setup();
        // Add custom setup
    },
    
    async sendMessage() {
        // Pre-send hook
        console.log("Sending message:", this.state.currentMessage);
        
        // Call parent
        await super.sendMessage();
        
        // Post-send hook
        this.customPostSend();
    },
    
    customPostSend() {
        // Custom logic
    }
});
```

### Creating Custom Services

```javascript
/** @odoo-module **/
import { registry } from "@web/core/registry";

export const customLLMService = {
    dependencies: ["llm_chat", "notification"],
    
    start(env, { llm_chat, notification }) {
        return {
            async analyzeThread(threadId) {
                try {
                    const messages = await llm_chat.getMessages(threadId);
                    // Custom analysis logic
                    return this._performAnalysis(messages);
                } catch (error) {
                    notification.add("Analysis failed", { type: 'danger' });
                }
            },
            
            _performAnalysis(messages) {
                // Implementation
            }
        };
    }
};

registry.category("services").add("custom_llm", customLLMService);
```

## API Extensions

### Custom Endpoints

```python
from odoo import http
from odoo.http import request

class LLMThreadExtension(http.Controller):
    
    @http.route('/llm/thread/analyze', type='json', auth='user')
    def analyze_thread(self, thread_id, **kwargs):
        """Custom analysis endpoint"""
        thread = request.env['llm.thread'].browse(thread_id)
        thread.check_access_rights('read')
        thread.check_access_rule('read')
        
        # Perform analysis
        analysis = {
            'message_count': len(thread.message_ids),
            'tool_usage': self._analyze_tool_usage(thread),
            'sentiment': self._analyze_sentiment(thread),
        }
        
        return {'success': True, 'analysis': analysis}
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

### Performance Optimization

```python
from odoo.tools import ormcache

class LLMThreadOptimized(models.Model):
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

## Testing Extensions

### Unit Tests

```python
from odoo.tests import TransactionCase

class TestLLMThreadExtension(TransactionCase):
    
    def test_custom_tool(self):
        """Test custom tool execution"""
        tool = self.env.ref('my_module.tool_search_partners')
        result = tool.execute({
            'search_term': 'Azure',
            'thread_id': self.thread.id,
        })
        
        self.assertTrue(result['success'])
        self.assertIn('data', result)
```

## Best Practices

1. **Always call super()** when overriding methods
2. **Use proper error handling** in tool implementations
3. **Cache expensive computations** using `@ormcache`
4. **Document your extensions** with clear docstrings
5. **Test your extensions** thoroughly
6. **Follow Odoo coding standards** for consistency
7. **Use background jobs** for long-running operations
8. **Implement proper security** checks in custom endpoints