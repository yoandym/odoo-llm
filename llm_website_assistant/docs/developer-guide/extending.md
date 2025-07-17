
# Extending the LLM Website Assistant

This module is designed to be extensible, allowing developers to add custom functionality without modifying the core code.

## Extension Points

### 1. Adding New Flow Actions

The module uses a dynamic dispatch pattern for handling flow actions from LLM tools.

#### Step 1: Define Your Flow Action

In your custom module that depends on `llm_website_assistant`:

```python
# In your_module/models/llm_tool_response_schema.py
from odoo.addons.llm_tool.models.llm_tool_response_schema import FlowAction

# Add your action to the FlowAction enum
FlowAction.SCHEDULE_APPOINTMENT = "schedule_appointment"
```

#### Step 2: Implement the Handler

```python
# In your_module/models/chatbot_script_step.py
from odoo import models

class ChatbotScriptStep(models.Model):
    _inherit = "chatbot.script.step"
    
    def _process_flow_action_schedule_appointment(self, response_data):
        """Handle appointment scheduling flow"""
        # Extract data from the response
        appointment_data = response_data.get('flow_params', {})
        
        # Find or create the appropriate next step
        appointment_step = self.chatbot_script_id.script_step_ids.filtered(
            lambda s: s.step_type == 'question_selection' and 
                     'appointment' in s.message.lower()
        )
        
        if not appointment_step:
            # Create a new step if needed
            appointment_step = self.env['chatbot.script.step'].create({
                'chatbot_script_id': self.chatbot_script_id.id,
                'step_type': 'question_selection',
                'message': 'Would you like to schedule an appointment?'
            })
        
        return appointment_step, appointment_data
```

### 2. Creating Custom LLM Tools

Add specialized tools that can trigger your custom flow actions:

```python
# In your_module/models/llm_tool_appointment.py
from odoo import models, api
from odoo.addons.llm_tool.models.llm_tool_response_schema import (
    StandardToolResponse, FlowAction
)

class LLMToolAppointment(models.Model):
    _inherit = "llm.tool"
    
    @api.model
    def _get_available_implementations(self):
        implementations = super()._get_available_implementations()
        return implementations + [
            ("appointment_scheduler", "Appointment Scheduler")
        ]
    
    def appointment_scheduler_execute(
        self,
        service_type: str,
        preferred_date: str = "",
        preferred_time: str = "",
        customer_name: str = "",
        thread_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Schedule an appointment with the customer"""
        
        message = f"I'll help you schedule a {service_type} appointment."
        if preferred_date:
            message += f" You prefer {preferred_date}"
        if preferred_time:
            message += f" at {preferred_time}."
        
        return StandardToolResponse.create_flow_control_response(
            flow_action=FlowAction.SCHEDULE_APPOINTMENT,
            message=message,
            flow_params={
                "service_type": service_type,
                "preferred_date": preferred_date,
                "preferred_time": preferred_time,
                "customer_name": customer_name,
                "thread_id": thread_id,
            },
        )
```

### 3. Extending JavaScript Components

#### Adding Custom Message Handling

```javascript
/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { ChatBotService } from "@im_livechat/embed/common/chatbot/chatbot_service";

patch(ChatBotService.prototype, {
    async _processUserAnswer(message) {
        // Add custom pre-processing
        if (this._shouldHandleCustomFlow(message)) {
            return this._handleCustomFlow(message);
        }
        
        // Call parent implementation
        return super._processUserAnswer(message);
    },
    
    _shouldHandleCustomFlow(message) {
        // Your custom logic
        return message.body.includes("#custom");
    },
    
    async _handleCustomFlow(message) {
        // Your custom implementation
        console.log("Handling custom flow", message);
        // ...
    }
});
```

#### Adding Custom UI Elements

```javascript
/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { LivechatButton } from "@im_livechat/embed/common/livechat_button";

patch(LivechatButton.prototype, {
    setup() {
        super.setup();
        // Add custom state
        this.customFeatureEnabled = true;
    },
    
    // Override template rendering if needed
    get templateContext() {
        const context = super.templateContext;
        return {
            ...context,
            customFeatureEnabled: this.customFeatureEnabled,
        };
    }
});
```

### 4. Extending Models

#### Adding Fields to LLM Assistant

```python
class LLMAssistant(models.Model):
    _inherit = "llm.assistant"
    
    # Add custom fields
    max_conversation_length = fields.Integer(
        string="Max Conversation Length",
        default=50,
        help="Maximum number of messages before suggesting human handover"
    )
    
    custom_greeting = fields.Text(
        string="Custom Greeting",
        help="Custom greeting message for this assistant"
    )
    
    @api.model
    def get_greeting_message(self):
        """Get custom or default greeting"""
        if self.custom_greeting:
            return self.custom_greeting
        return super().get_greeting_message()
```

#### Adding Methods to Chatbot Script

```python
class ChatbotScript(models.Model):
    _inherit = "chatbot.script"
    
    def action_generate_custom_steps(self):
        """Generate custom chatbot steps for specific use case"""
        self.ensure_one()
        
        # Your custom step generation logic
        steps_data = [
            {
                'chatbot_script_id': self.id,
                'step_type': 'text',
                'message': 'Welcome to our custom flow!',
            },
            # ... more steps
        ]
        
        self.env['chatbot.script.step'].create(steps_data)
        
        return {
            'type': 'ir.actions.client',
            'tag': 'reload',
        }
```

## Best Practices for Extensions

### 1. Dependency Management

Always declare proper dependencies in your `__manifest__.py`:

```python
{
    'name': 'Your Custom Module',
    'depends': [
        'llm_website_assistant',
        'your_other_dependencies',
    ],
    # ...
}
```

### 2. Use Proper Inheritance

- Use `_inherit` for extending existing models
- Call `super()` when overriding methods
- Don't break existing functionality

### 3. Follow Naming Conventions

- Flow action handlers: `_process_flow_action_{action_name}`
- Tool implementations: `{tool_name}_execute`
- JavaScript patches: Use clear, descriptive names

### 4. Handle Errors Gracefully

```python
def _process_flow_action_custom(self, response_data):
    try:
        # Your implementation
        return next_step, params
    except Exception as e:
        _logger.exception("Error in custom flow action: %s", e)
        # Fall back to standard flow
        return self._get_discuss_channel_step(), {}
```

### 5. Document Your Extensions

- Add docstrings to all methods
- Document expected parameters and return values
- Provide examples in your module's README

## Common Extension Scenarios

### Integrating with External Services

```python
class ChatbotScriptStep(models.Model):
    _inherit = "chatbot.script.step"
    
    def _process_flow_action_external_api(self, response_data):
        """Integrate with external API"""
        api_params = response_data.get('flow_params', {})
        
        # Call your external service
        external_service = self.env['your.external.service']
        result = external_service.process_request(api_params)
        
        # Create appropriate response step
        if result.get('success'):
            next_step = self._get_success_step()
        else:
            next_step = self._get_error_step()
        
        return next_step, {'api_result': result}
```

### Adding Analytics

```python
class LLMThread(models.Model):
    _inherit = "llm.thread"
    
    @api.model
    def create(self, vals):
        thread = super().create(vals)
        
        # Track thread creation
        if thread.source == 'website_livechat':
            self.env['your.analytics.model'].track_event(
                'llm_chat_started',
                {
                    'assistant_id': thread.assistant_id.id,
                    'timestamp': fields.Datetime.now(),
                }
            )
        
        return thread
```

### Custom Validation

```python
class ChatbotScript(models.Model):
    _inherit = "chatbot.script"
    
    @api.constrains('llm_assistant_id', 'custom_field')
    def _check_custom_configuration(self):
        for script in self:
            if script.llm_assistant_id and script.custom_field:
                # Your validation logic
                if not self._is_valid_configuration():
                    raise ValidationError(
                        _("Invalid configuration for LLM assistant")
                    )
```