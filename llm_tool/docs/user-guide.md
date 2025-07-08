# User Guide for LLM Tool

## Overview

LLM Tool enables AI assistants to interact with your Odoo database through natural language. When integrated with an LLM (Large Language Model), these tools allow the AI to perform actions like searching records, creating entries, updating data, and executing business logic based on user requests.

## Getting Started

### First Steps

1. After installation, navigate to **Settings > LLM Configuration > Tools**
2. You'll see a list of available tools (empty initially)
3. To get started, create your first tool by clicking **New**

### Basic Concepts

Before using this module, understand these key concepts:

- **Tool**: A function that an LLM can call to perform specific actions in Odoo
- **Implementation**: The underlying code that executes when a tool is called
- **Schema**: The parameters and their types that a tool accepts
- **Consent**: Some tools require explicit user permission before execution

## Features

### Feature 1: Tool Management

Manage all your LLM tools from a central location.

**How to use:**

1. Navigate to **Settings > LLM Configuration > Tools**
2. Click **New** to create a tool
3. Fill in the required fields:
   - **Name**: Unique identifier (e.g., "search_customers")
   - **Description**: What the tool does (sent to the LLM)
   - **User Description**: Friendly description shown to users
   - **Implementation**: Select from available options
4. Click **Save** to create the tool

**Example:**
```
Name: search_customers
Description: Search for customers by name, email, or phone number
User Description: I can help you find customer information
Implementation: odoo_record_retriever
```

### Feature 2: Built-in Tool Implementations

Use ready-made tools for common operations.

#### Available Implementations:

1. **User Greeting** (`user_greeting`)
   - Greets users and shows available capabilities
   - Parameters: `greeting_type`, `thread_id`

2. **Model Inspector** (`odoo_model_inspector`)
   - Explores Odoo model structure
   - Parameters: `model`, `include_fields`, `include_methods`

3. **Record Retriever** (`odoo_record_retriever`)
   - Searches and retrieves records
   - Parameters: `model`, `domain`, `fields`, `limit`

4. **Record Creator** (`odoo_record_creator`)
   - Creates new records
   - Parameters: `model`, `values`

5. **Record Updater** (`odoo_record_updater`)
   - Updates existing records
   - Parameters: `model`, `record_id`, `values`

**Tips:**
- Start with read-only tools like retriever and inspector
- Test tools manually before enabling for users

### Feature 3: User Consent Management

Configure tools that require user permission before execution.

**How to use:**

1. Navigate to **Settings > LLM Configuration > Tool Consent**
2. Configure consent messages:
   - **Tool Description Message**: Added to tool descriptions
   - **System Message Template**: Instructions for the LLM
3. On individual tools, enable **Requires User Consent**

**Best Practices:**
- Enable consent for tools that modify data
- Keep consent messages clear and concise
- Test the consent flow with users

## Common Use Cases

### Use Case 1: Customer Service Assistant

**Scenario**: Enable customer service reps to quickly find customer information

**Solution**:
1. Create a "find_customer" tool:
   ```
   Name: find_customer
   Description: Search customers by name, email, or phone
   Implementation: odoo_record_retriever
   ```

2. Configure the tool to search res.partner model
3. Set appropriate field limits for privacy
4. Test with queries like "Find customer John Smith"

### Use Case 2: Inventory Status Checker

**Scenario**: Allow warehouse staff to check product availability via chat

**Solution**:
1. Create an "check_inventory" tool:
   ```
   Name: check_inventory  
   Description: Check product stock levels and availability
   Implementation: odoo_record_retriever
   ```

2. Configure to search product.product with stock quantities
3. Add user-friendly descriptions
4. Enable for warehouse user group only

### Use Case 3: Order Creation Assistant

**Scenario**: Automate order creation through conversational interface

**Solution**:
1. Create "create_order" tool with consent required:
   ```
   Name: create_order
   Description: Create a new sales order
   Implementation: odoo_record_creator
   Requires User Consent: Yes
   ```

2. Configure proper validation rules
3. Test the consent flow
4. Monitor usage through logs

## User Interface Guide

### Main Views

#### Tool List View
- **Purpose**: Overview of all configured tools
- **Key Elements**:
  - Name and description
  - Implementation type
  - Active status
  - Default tool indicator
- **Actions Available**: Create, Edit, Delete, Activate/Deactivate

#### Tool Form View
- **Purpose**: Configure individual tools
- **Sections**:
  - Basic Information (name, descriptions)
  - Technical Settings (implementation, schema)
  - Behavior Hints (read-only, idempotent, etc.)
  - Access Control (user consent)

### Menu Structure

```
Settings
└── LLM Configuration
    ├── Tools
    │   ├── Tool List
    │   └── Create Tool
    └── Tool Consent
        └── Consent Configuration
```

## Working with Schemas

### Understanding Input Schemas

Tools automatically generate schemas from their implementation:

```json
{
  "type": "object",
  "properties": {
    "model": {
      "type": "string",
      "description": "The Odoo model to search"
    },
    "domain": {
      "type": "array",
      "description": "Search domain"
    },
    "limit": {
      "type": "integer",
      "default": 10,
      "description": "Maximum records to return"
    }
  },
  "required": ["model"]
}
```

### Schema Validation

- Parameters are automatically validated before execution
- Type mismatches result in clear error messages
- Default values are applied when parameters are omitted

## Best Practices

1. **Tool Naming**: Use clear, action-oriented names (e.g., "search_products" not "products")
2. **Descriptions**: Write descriptions that help the LLM understand when to use the tool
3. **Limits**: Set reasonable limits on data retrieval to prevent performance issues
4. **Testing**: Always test tools manually before enabling for production use
5. **Monitoring**: Review tool usage logs regularly for issues or optimization opportunities

## Permissions and Access Rights

### Security Groups

Tools respect Odoo's standard security model:

- **Tool Managers**: Can create, edit, and delete tools
- **Tool Users**: Can execute tools (based on implementation permissions)
- **Restricted Users**: May have limited or no access to tools

### Record-Level Security

- Tools respect record rules and access rights
- Users can only access data they have permission to see
- Failed access attempts are logged

## FAQ

**Q: Can I create custom tool implementations?**
A: Yes! See the [Developer Guide](developer-guide.md) for instructions on creating custom implementations.

**Q: How do I restrict which models a tool can access?**
A: Create separate tools for different models and use Odoo's standard access rights to control permissions.

**Q: What happens if a tool execution fails?**
A: The tool returns a standardized error response with details about what went wrong.

**Q: Can tools call other tools?**
A: Not directly, but an LLM can chain multiple tool calls in sequence.

**Q: How do I monitor tool usage?**
A: Check the server logs and mail thread messages for tool execution history.

## Tips and Tricks

- **Quick Testing**: Use the Python console to test tool execution
- **Batch Operations**: Some tools support batch operations for efficiency
- **Custom Domains**: Use parameter defaults to pre-filter common searches
- **Performance**: Index frequently searched fields for better performance

## Troubleshooting

### Common Issues

**Problem**: Tool not appearing for LLM
- **Cause**: Tool not active or not marked as default
- **Solution**: Check tool is active and configure default tools

**Problem**: "Permission denied" errors
- **Cause**: User lacks access to the model or records
- **Solution**: Review and adjust security groups and record rules

**Problem**: Schema validation failures
- **Cause**: Invalid parameter types or missing required fields
- **Solution**: Check the tool's schema and ensure parameters match

## Getting Help

If you need additional help:

1. Check the [FAQ](#faq) section
2. Review tool logs in debug mode
3. Contact support at support@apexive.com

## Next Steps

After mastering the basics:

- Explore [Creating Custom Tools](developer-guide.md#creating-custom-tools)
- Learn about [Integration with AI Chat](../llm_thread/index.md)
- Read about [Advanced Schema Configuration](developer-guide.md#schema-customization)
