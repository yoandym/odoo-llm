# Extending the Module

This guide explains how to extend the LLM Integration Base module to add new providers, customize models, or enhance functionality.

## Extension Points

### 1. Adding a New Provider Service

To add support for a new LLM provider, you need to:

1. **Register the service in _selection_service()**

```python
class LLMProvider(models.Model):
    _inherit = 'llm.provider'
    
    @api.model
    def _selection_service(self):
        selection = super()._selection_service()
        selection.append(('myprovider', 'My Provider'))
        return selection
```

2. **Implement service-specific methods**

Follow the naming pattern `{service}_{method}`:

```python
class LLMProvider(models.Model):
    _inherit = 'llm.provider'
    
    def myprovider_get_client(self):
        """Return configured client for My Provider"""
        from myprovider import Client
        return Client(
            api_key=self.api_key,
            base_url=self.api_base or 'https://api.myprovider.com'
        )
    
    def myprovider_chat(self, messages, model=None, stream=False, **kwargs):
        """Implement chat functionality"""
        client = self.client
        model = self.get_model(model, 'chat')
        
        # Format messages for your provider
        formatted_messages = self.myprovider_format_messages(messages)
        
        # Make API call
        response = client.chat.completions.create(
            model=model.name,
            messages=formatted_messages,
            stream=stream,
            **kwargs
        )
        return response
    
    def myprovider_embedding(self, texts, model=None):
        """Implement embedding functionality"""
        client = self.client
        model = self.get_model(model, 'embedding')
        
        response = client.embeddings.create(
            model=model.name,
            input=texts
        )
        return response
    
    def myprovider_models(self, model_id=None):
        """List available models from provider"""
        client = self.client
        
        if model_id:
            # Fetch specific model
            model_data = client.models.retrieve(model_id)
            return [self._format_model_data(model_data)]
        else:
            # List all models
            models = client.models.list()
            return [self._format_model_data(m) for m in models]
    
    def myprovider_format_messages(self, messages, system_prompt=None):
        """Format messages for provider-specific requirements"""
        formatted = []
        
        if system_prompt:
            formatted.append({
                'role': 'system',
                'content': system_prompt
            })
        
        for msg in messages:
            formatted.append({
                'role': msg.get('role', 'user'),
                'content': msg.get('content', '')
            })
        
        return formatted
    
    def _format_model_data(self, model):
        """Convert provider model data to standard format"""
        return {
            'name': model.id,
            'details': {
                'id': model.id,
                'created': model.created,
                'owned_by': model.owned_by,
                'capabilities': self._determine_capabilities(model)
            },
            'model_info': {
                'description': getattr(model, 'description', ''),
                'context_length': getattr(model, 'context_length', 4096),
                # Add more metadata as needed
            }
        }
```

### 2. Extending Models

#### Adding Fields to Existing Models

```python
class LLMModel(models.Model):
    _inherit = 'llm.model'
    
    # Add new fields
    supports_function_calling = fields.Boolean(
        string="Supports Function Calling",
        default=False,
        help="Whether this model supports function/tool calling"
    )
    
    cost_per_1k_tokens = fields.Float(
        string="Cost per 1K Tokens",
        digits=(10, 6),
        help="Cost in USD per 1000 tokens"
    )
    
    # Override methods
    @api.model_create_multi
    def create(self, vals_list):
        # Add custom logic before creation
        for vals in vals_list:
            if vals.get('name'):
                # Custom validation or processing
                self._validate_model_name(vals['name'])
        
        return super().create(vals_list)
```

#### Adding Computed Fields

```python
class LLMModel(models.Model):
    _inherit = 'llm.model'
    
    estimated_monthly_cost = fields.Float(
        compute='_compute_estimated_cost',
        string="Estimated Monthly Cost"
    )
    
    @api.depends('cost_per_1k_tokens')
    def _compute_estimated_cost(self):
        for record in self:
            # Example calculation based on usage
            avg_tokens_per_month = 1000000  # 1M tokens
            record.estimated_monthly_cost = (
                record.cost_per_1k_tokens * avg_tokens_per_month / 1000
            )
```

### 3. Extending Views

#### Adding Fields to Forms

```xml
<odoo>
    <!-- Extend Provider Form -->
    <record id="llm_provider_form_myprovider" model="ir.ui.view">
        <field name="name">llm.provider.form.myprovider</field>
        <field name="model">llm.provider</field>
        <field name="inherit_id" ref="llm.llm_provider_view_form"/>
        <field name="arch" type="xml">
            <!-- Add field after api_base -->
            <field name="api_base" position="after">
                <field name="api_region" 
                       invisible="service != 'myprovider'"
                       placeholder="us-west-2"/>
            </field>
            
            <!-- Add new notebook page -->
            <notebook position="inside">
                <page string="My Provider Settings" 
                      invisible="service != 'myprovider'">
                    <group>
                        <field name="my_custom_setting"/>
                    </group>
                </page>
            </notebook>
        </field>
    </record>
    
    <!-- Extend Model Form -->
    <record id="llm_model_form_extended" model="ir.ui.view">
        <field name="name">llm.model.form.extended</field>
        <field name="model">llm.model</field>
        <field name="inherit_id" ref="llm.llm_model_view_form"/>
        <field name="arch" type="xml">
            <!-- Add to general information -->
            <field name="default" position="after">
                <field name="supports_function_calling"/>
                <field name="cost_per_1k_tokens"/>
            </field>
        </field>
    </record>
</odoo>
```

### 4. Adding Actions and Wizards

#### Custom Wizard Example

```python
class LLMTestWizard(models.TransientModel):
    _name = 'llm.test.wizard'
    _description = 'Test LLM Model'
    
    model_id = fields.Many2one(
        'llm.model',
        string='Model',
        required=True,
        domain=[('model_use', '=', 'chat')]
    )
    prompt = fields.Text(
        string='Test Prompt',
        required=True,
        default='Hello, can you help me test this connection?'
    )
    response = fields.Text(
        string='Response',
        readonly=True
    )
    
    def action_test(self):
        """Test the selected model"""
        self.ensure_one()
        
        try:
            response = self.model_id.chat([
                {'role': 'user', 'content': self.prompt}
            ])
            
            self.response = response.choices[0].message.content
            
            # Return wizard to show response
            return {
                'type': 'ir.actions.act_window',
                'res_model': 'llm.test.wizard',
                'view_mode': 'form',
                'res_id': self.id,
                'target': 'new',
            }
        except Exception as e:
            raise UserError(_("Test failed: %s") % str(e))
```

### 5. Security Extensions

```python
class LLMProvider(models.Model):
    _inherit = 'llm.provider'
    
    @api.model
    def create(self, vals):
        """Add security checks on creation"""
        # Check if user can create providers for the company
        if vals.get('company_id'):
            company = self.env['res.company'].browse(vals['company_id'])
            if not self.env.user.has_group('llm.group_llm_manager'):
                raise AccessError(
                    _("Only LLM Managers can create providers")
                )
        
        return super().create(vals)
```

### 6. Adding Provider-Specific Features

```python
class LLMProvider(models.Model):
    _inherit = 'llm.provider'
    
    # Provider-specific fields
    myprovider_workspace_id = fields.Char(
        string="Workspace ID",
        help="My Provider workspace identifier"
    )
    
    myprovider_rate_limit = fields.Integer(
        string="Rate Limit (req/min)",
        default=60,
        help="Maximum requests per minute"
    )
    
    def myprovider_check_rate_limit(self):
        """Implement rate limiting logic"""
        # Check against rate limit
        # Raise exception if exceeded
        pass
```

## Best Practices

### 1. Naming Conventions
- Service methods: `{service}_{method}`
- Module names: `llm_{feature}` (e.g., `llm_myprovider`)
- Model names: Use clear, descriptive names

### 2. Error Handling
```python
def myprovider_chat(self, messages, model=None, **kwargs):
    try:
        # Implementation
        pass
    except ConnectionError as e:
        raise UserError(
            _("Failed to connect to My Provider: %s") % str(e)
        )
    except Exception as e:
        _logger.exception("Unexpected error in My Provider chat")
        raise UserError(
            _("An error occurred: %s") % str(e)
        )
```

### 3. Configuration Management
```python
@api.model
def get_myprovider_config(self):
    """Get provider-specific configuration"""
    ICP = self.env['ir.config_parameter'].sudo()
    return {
        'timeout': int(ICP.get_param('llm.myprovider.timeout', 30)),
        'max_retries': int(ICP.get_param('llm.myprovider.retries', 3)),
    }
```

### 4. Testing
```python
class TestMyProvider(TransactionCase):
    
    def setUp(self):
        super().setUp()
        self.provider = self.env['llm.provider'].create({
            'name': 'Test My Provider',
            'service': 'myprovider',
            'api_key': 'test-key',
        })
    
    def test_chat_functionality(self):
        """Test chat implementation"""
        with self.assertRaises(UserError):
            # Should fail with test key
            self.provider.chat([{'role': 'user', 'content': 'test'}])
```

---

For more examples, see:
- Dependent modules in the odoo-llm repository
- Odoo's official documentation on inheritance
- The `llm_ollama` module for a complete provider implementation