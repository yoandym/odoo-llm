# Developer Guide for LLM Tool

## Architecture

The LLM Tool module follows a modular architecture designed for extensibility and maintainability.

### High-Level Design

```
┌─────────────────────┐     ┌──────────────────┐
│   LLM/AI Service    │────▶│   Tool Manager   │
└─────────────────────┘     └──────────────────┘
                                     │
                            ┌────────┴────────┐
                            ▼                 ▼
                    ┌───────────────┐ ┌───────────────┐
                    │ Tool Registry │ │ Schema Engine │
                    └───────────────┘ └───────────────┘
                            │                 │
                            ▼                 ▼
                    ┌───────────────┐ ┌───────────────┐
                    │Implementation │ │   Pydantic    │
                    │   Classes     │ │  Validation   │
                    └───────────────┘ └───────────────┘
```

### Key Components

1. **Tool Manager** (`llm.tool`): Core model managing tool definitions
2. **Implementation Registry**: Dynamic registration of tool implementations
3. **Schema Engine**: Automatic schema generation from Python signatures
4. **Response Handler**: Standardized response format management
5. **Consent Manager**: User consent configuration and validation

### Data Flow

1. LLM requests available tools via `get_tool_definition()`
2. Tool definitions include schemas generated from implementations
3. LLM calls tool with parameters
4. Parameters are validated against schema
5. Implementation executes with validated parameters
6. Response follows standardized format

## Models

### Core Models

```python
class LLMTool(models.Model):
    """Core tool management model"""
    _name = "llm.tool"
    _description = "LLM Tool"
    _inherit = ["mail.thread"]
    
    # Tool identification
    name = fields.Char(required=True, tracking=True)
    description = fields.Text(required=True, tracking=True)
    user_description = fields.Text()
    
    # Implementation
    implementation = fields.Selection(
        selection=lambda self: self._selection_implementation()
    )
    
    # Schema
    input_schema = fields.Text(
        compute='_compute_input_schema',
        store=True
    )
    
    # Behavior hints
    read_only_hint = fields.Boolean(default=False)
    idempotent_hint = fields.Boolean(default=False)
    destructive_hint = fields.Boolean(default=True)
    open_world_hint = fields.Boolean(default=True)
    
    # Configuration
    requires_user_consent = fields.Boolean(default=False)
    default = fields.Boolean(default=False)
```

```python
class LLMToolConsentConfig(models.Model):
    """Consent configuration model"""
    _name = "llm.tool.consent.config"
    _description = "LLM Tool Consent Configuration"
    
    name = fields.Char(required=True)
    active = fields.Boolean(default=False)
    tool_description_message = fields.Text()
    system_message_template = fields.Text()
```

### Response Schema Model

```python
class StandardToolResponse:
    """Reference implementation for tool responses"""
    
    @staticmethod
    def create_response(
        status: str = "success",
        message: str = "",
        data: dict = None,
        flow_action: str = None,
        flow_params: dict = None
    ) -> dict:
        """Create standardized response"""
        return {
            "status": status,
            "message": message,
            "data": data or {},
            "flow_action": flow_action,
            "flow_params": flow_params or {}
        }
```

## Creating Custom Tool Implementations

### Step 1: Create Implementation Class

```python
from odoo import api, models
import logging

_logger = logging.getLogger(__name__)

class MyCustomTool(models.Model):
    _inherit = "llm.tool"
    
    @api.model
    def _get_available_implementations(self):
        """Register your implementation"""
        implementations = super()._get_available_implementations()
        return implementations + [
            ("my_custom_tool", "My Custom Tool")
        ]
    
    def my_custom_tool_execute(
        self,
        param1: str,
        param2: int = 10,
        optional_param: str = None
    ) -> dict:
        """
        Execute my custom tool.
        
        Parameters:
            param1: Required string parameter
            param2: Integer with default value
            optional_param: Optional string parameter
        """
        _logger.info(f"Executing with: {param1}, {param2}, {optional_param}")
        
        try:
            # Your implementation logic here
            result = self._do_something(param1, param2)
            
            # Return standardized response
            return {
                "status": "success",
                "message": f"Successfully processed {param1}",
                "data": {
                    "result": result,
                    "param2_used": param2
                }
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
                "data": {}
            }
```

### Step 2: Schema Customization

The schema is automatically generated from your method signature. Use type hints and docstrings:

```python
def advanced_tool_execute(
    self,
    model_name: str,
    filters: list[dict] = None,
    options: dict = None
) -> dict:
    """
    Advanced tool with complex parameters.
    
    Parameters:
        model_name: The Odoo model to work with
        filters: List of filter dictionaries with 'field', 'operator', 'value'
        options: Additional options like 'limit', 'order', 'fields'
    """
    # Implementation
```

### Step 3: Implementing Flow Control

Tools can request flow control actions:

```python
from odoo.addons.llm_tool.models.llm_tool_response_schema import (
    StandardToolResponse, FlowAction
)

def handover_tool_execute(self, reason: str = "") -> dict:
    """Tool that hands over to human operator"""
    
    # Perform any necessary actions
    self._log_handover_request(reason)
    
    # Return with flow control
    return StandardToolResponse.create_flow_control_response(
        flow_action=FlowAction.FORWARD_TO_OPERATOR,
        message="I'll connect you with a human operator.",
        flow_params={"reason": reason}
    )
```

## Schema Generation

### How It Works

1. **Signature Inspection**: Uses Python's `inspect` module
2. **Type Hints**: Extracts parameter types from annotations
3. **Pydantic Models**: Dynamically creates models for validation
4. **Docstring Parsing**: Extracts parameter descriptions

### Supported Types

```python
# Basic types
param: str
param: int
param: float
param: bool

# Optional types
param: Optional[str] = None
param: Union[str, int] = None

# Collections
param: list[str] = []
param: dict[str, Any] = {}

# With defaults
param: int = 10
param: str = "default"
```

### Custom Schema Override

For complex schemas, override the `get_input_schema` method:

```python
def get_input_schema(self, method="execute"):
    """Override for custom schema"""
    if self.implementation == "my_complex_tool":
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["create", "update", "delete"],
                    "description": "Action to perform"
                },
                "data": {
                    "type": "object",
                    "additionalProperties": True
                }
            },
            "required": ["action", "data"]
        }
    return super().get_input_schema(method)
```

## Testing

### Unit Testing

```python
from odoo.tests import TransactionCase

class TestLLMTool(TransactionCase):
    
    def setUp(self):
        super().setUp()
        self.tool = self.env['llm.tool'].create({
            'name': 'test_tool',
            'description': 'Test tool',
            'implementation': 'my_custom_tool',
        })
    
    def test_tool_execution(self):
        """Test tool executes correctly"""
        result = self.tool.execute({
            'param1': 'test',
            'param2': 20
        })
        
        self.assertEqual(result['status'], 'success')
        self.assertIn('result', result['data'])
    
    def test_schema_generation(self):
        """Test schema is generated correctly"""
        schema = self.tool.get_input_schema()
        
        self.assertIn('properties', schema)
        self.assertIn('param1', schema['properties'])
        self.assertEqual(
            schema['properties']['param1']['type'], 
            'string'
        )
```

### Integration Testing

```python
def test_with_llm_integration(self):
    """Test tool works with LLM"""
    # Get tool definition
    tool_def = self.tool.get_tool_definition()
    
    # Simulate LLM call
    llm_params = {
        "param1": "test input",
        "param2": 15
    }
    
    # Validate against schema
    from pydantic import create_model
    schema = tool_def['inputSchema']
    # ... validation logic
    
    # Execute
    result = self.tool.execute(llm_params)
    self.assertEqual(result['status'], 'success')
```

## Security Considerations

### Access Control

```python
class SecureTool(models.Model):
    _inherit = "llm.tool"
    
    def secure_tool_execute(self, model: str, **kwargs):
        """Tool with security checks"""
        
        # Check model access
        if not self.env[model].check_access_rights('read', False):
            return {
                "status": "error",
                "message": "Access denied to model",
                "data": {}
            }
        
        # Apply record rules
        records = self.env[model].search([])
        # Records are automatically filtered by rules
        
        return {
            "status": "success",
            "data": {"count": len(records)}
        }
```

### Input Validation

Always validate inputs beyond schema validation:

```python
def validated_tool_execute(self, user_input: str):
    """Tool with extra validation"""
    
    # Sanitize input
    if not user_input or len(user_input) > 1000:
        return {
            "status": "error",
            "message": "Invalid input length"
        }
    
    # Prevent injection
    if any(char in user_input for char in ['<', '>', ';']):
        return {
            "status": "error", 
            "message": "Invalid characters in input"
        }
    
    # Process safely
    # ...
```

## Performance Optimization

### Efficient Queries

```python
def optimized_search_execute(
    self, 
    model: str, 
    domain: list,
    limit: int = 100
):
    """Optimized search implementation"""
    
    # Use search_read for efficiency
    results = self.env[model].search_read(
        domain=domain,
        fields=['id', 'name'],  # Only needed fields
        limit=limit
    )
    
    # Use read_group for aggregations
    grouped = self.env[model].read_group(
        domain=domain,
        fields=['state'],
        groupby=['state']
    )
    
    return {
        "status": "success",
        "data": {
            "results": results,
            "summary": grouped
        }
    }
```

### Caching

```python
from odoo.tools import ormcache

class CachedTool(models.Model):
    _inherit = "llm.tool"
    
    @ormcache('model_name')
    def _get_model_info(self, model_name):
        """Cache expensive computations"""
        return self.env['ir.model'].search_read(
            [('model', '=', model_name)],
            ['name', 'field_id']
        )
```

## Migration and Upgrades

### Migration Scripts

Create migration scripts in `migrations/VERSION/`:

```python
# migrations/17.0.1.0.2/post-migrate.py
from odoo import api, SUPERUSER_ID

def migrate(cr, version):
    """Migration script"""
    env = api.Environment(cr, SUPERUSER_ID, {})
    
    # Update existing tools
    tools = env['llm.tool'].search([])
    for tool in tools:
        if not tool.user_description:
            tool.user_description = tool.description
```

### Backward Compatibility

Maintain compatibility when updating implementations:

```python
def compatible_execute(self, **kwargs):
    """Backward compatible implementation"""
    
    # Handle old parameter names
    if 'old_param' in kwargs:
        kwargs['new_param'] = kwargs.pop('old_param')
        _logger.warning("'old_param' is deprecated, use 'new_param'")
    
    # Call new implementation
    return self.new_implementation(**kwargs)
```

## API Reference

See [API Reference](api.rst) for complete API documentation.

## Examples

### Complete Tool Implementation

```python
from odoo import api, fields, models
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)

class CustomerServiceTool(models.Model):
    _inherit = "llm.tool"
    
    @api.model
    def _get_available_implementations(self):
        implementations = super()._get_available_implementations()
        return implementations + [
            ("customer_service", "Customer Service Assistant")
        ]
    
    def customer_service_execute(
        self,
        action: str,
        customer_ref: str = None,
        data: dict = None
    ) -> dict:
        """
        Customer service operations.
        
        Parameters:
            action: Action to perform (search, create_ticket, check_order)
            customer_ref: Customer reference (email, phone, or ID)
            data: Additional data for the action
        """
        if action == "search":
            return self._search_customer(customer_ref)
        elif action == "create_ticket":
            return self._create_ticket(customer_ref, data)
        elif action == "check_order":
            return self._check_order_status(customer_ref, data)
        else:
            return {
                "status": "error",
                "message": f"Unknown action: {action}"
            }
    
    def _search_customer(self, ref):
        """Search for customer by reference"""
        domain = ['|', '|',
            ('email', 'ilike', ref),
            ('phone', 'ilike', ref),
            ('ref', '=', ref)
        ]
        
        customers = self.env['res.partner'].search_read(
            domain=domain,
            fields=['name', 'email', 'phone'],
            limit=5
        )
        
        return {
            "status": "success",
            "message": f"Found {len(customers)} customers",
            "data": {"customers": customers}
        }
```

## Debugging

### Enable Debug Logging

```python
# In your implementation
_logger.debug(f"Tool params: {params}")
_logger.debug(f"Generated schema: {schema}")
```

### Test in Python Console

```python
# Debug tool execution
tool = env['llm.tool'].search([('name', '=', 'my_tool')])
result = tool.execute({'param1': 'test'})
print(json.dumps(result, indent=2))

# Check schema
schema = tool.get_input_schema()
print(json.dumps(schema, indent=2))
```

## Best Practices

1. **Type Hints**: Always use type hints for automatic schema generation
2. **Docstrings**: Document parameters in docstrings for better schemas
3. **Error Handling**: Return standardized error responses
4. **Logging**: Log important operations for debugging
5. **Security**: Always validate inputs and check permissions
6. **Performance**: Use efficient queries and consider caching
7. **Testing**: Write comprehensive tests for your implementations
