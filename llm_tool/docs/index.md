# LLM Tool

## Contents

- [Installation](installation.md)
- [User Guide](user-guide.md)
- [Admin Guide](admin-guide.md)
- [Developer Guide](developer-guide.md)
- [API Reference](api.rst)

## Overview

LLM Tool provides a robust framework for integrating Large Language Models (LLMs) with Odoo through function calling and tool execution. This module enables AI assistants to interact with your Odoo database by executing predefined tools, making it possible to automate workflows, retrieve information, and perform actions based on natural language requests.

## Key Features

* **Function Calling Framework** - Enable LLMs to call specific functions based on user requests with automatic parameter validation
* **Dynamic Tool Management** - Define and manage LLM tools with custom implementations through a flexible architecture
* **Schema Generation** - Automatic JSON Schema generation from Python method signatures using Pydantic
* **User Consent Management** - Built-in consent system for tools that require explicit user permission
* **Built-in Tool Implementations** - Ready-to-use tools for common operations:
  - User greeting and capability discovery
  - Odoo model inspection
  - Record CRUD operations (Create, Read, Update, Delete)
  - Method execution on Odoo models
* **Integration with Mail Threads** - Seamless integration with Odoo's mail system for chat-like interactions
* **Extensible Architecture** - Easy addition of new tool implementations through inheritance

## Requirements

* Odoo 17.0+
* Python 3.8+
* Dependencies:
  - `base` - Odoo base module
  - `mail` - Odoo mail module  
  - `llm` - LLM Integration Base module (provides core LLM functionality)
* Python packages:
  - `pydantic>=2.0.0` - For schema generation and validation

## Quick Start

```python
# Create a new tool
tool = self.env['llm.tool'].create({
    'name': 'get_customer_info',
    'description': 'Retrieve customer information by name or ID',
    'implementation': 'odoo_record_retriever',
    'active': True,
})

# Execute the tool
result = tool.execute({
    'model': 'res.partner',
    'domain': [('is_company', '=', True)],
    'fields': ['name', 'email', 'phone'],
    'limit': 5
})

# Get tool definition for LLM
tool_def = tool.get_tool_definition()
# Returns formatted tool specification with input schema
```

## Configuration

After installation:

1. **Navigate to Settings > LLM Configuration > Tools**
2. **Create New Tools**: Click "New" to define a tool
3. **Configure Tool Properties**:
   - Name: Unique identifier for the LLM to call
   - Description: What the tool does (sent to LLM)
   - User Description: User-friendly description
   - Implementation: Select from available implementations
4. **Set Tool Hints**: Configure behavior hints (read-only, idempotent, etc.)
5. **Configure Consent**: Enable user consent if tool performs sensitive operations
6. **Set Default Tools**: Mark tools as default to include in all LLM requests

## Tool Implementations

### Built-in Implementations

* **User Greeting** (`user_greeting`) - Greet users and show available capabilities
* **Model Inspector** (`odoo_model_inspector`) - Inspect Odoo model structure and methods
* **Record Retriever** (`odoo_record_retriever`) - Search and retrieve records
* **Record Creator** (`odoo_record_creator`) - Create new records
* **Record Updater** (`odoo_record_updater`) - Update existing records
* **Record Unlinker** (`odoo_record_unlinker`) - Delete records
* **Method Executor** (`odoo_model_method_executor`) - Execute model methods

### Response Schema

All tools follow a standardized response format for consistency:

```python
{
    "status": "success",  # or "error", "warning", "info"
    "message": "Human-readable message",
    "data": {},  # Tool-specific data
    "flow_action": None,  # Optional flow control
    "flow_params": {}  # Parameters for flow action
}
```

## Integration

This module integrates with:

* **LLM Integration Base** (`llm`): Provides core LLM functionality and model management
* **Mail Module**: Enables chat-like interactions through mail threads
* **Easy AI Chat** (if installed): Tools become available in chat conversations

### Integration Points

* **Tool Discovery**: LLMs can query available tools and their capabilities
* **Parameter Validation**: Automatic validation using generated schemas
* **Error Handling**: Standardized error responses for failed operations
* **Security**: Respects Odoo's access rights and record rules

## Related Modules

* [LLM Integration Base](../llm/index.md) - Core LLM functionality (required dependency)
* [Easy AI Chat](../llm_thread/index.md) - Interactive AI conversations using tools
* [LLM Mail Message Subtypes](../llm_mail_message_subtypes/index.md) - Enhanced message types for AI interactions

## Troubleshooting

Common issues and solutions:

* **Tool Not Found**: Ensure the tool is active and the implementation is properly registered
* **Schema Generation Failed**: Check method signatures and type hints in the implementation
* **Permission Denied**: Verify user has access rights to the model being accessed
* **Invalid Parameters**: Review the tool's input schema and ensure parameters match

For more detailed troubleshooting, check the logs at debug level.

## Support

For issues and questions:

* Email: support@apexive.com
* GitHub Issues: [Report an issue](https://github.com/apexive/odoo-llm/issues)
* Documentation: [Full Documentation](https://github.com/apexive/odoo-llm)

## Contributing

We welcome contributions! When adding new tool implementations:

1. Inherit from `llm.tool` model
2. Add your implementation to `_get_available_implementations()`
3. Create an execute method: `your_implementation_execute(**kwargs)`
4. Follow the standardized response format
5. Add appropriate docstrings for schema generation

See the [Developer Guide](developer-guide.md) for detailed instructions.
