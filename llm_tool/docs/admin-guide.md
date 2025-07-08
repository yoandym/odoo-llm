# Admin Guide for LLM Tool

This guide covers the configuration and administration of the LLM Tool module after installation.

## System Configuration

### Module Settings

The LLM Tool module can be configured through several interfaces:

1. **Settings > LLM Configuration > Tools** - Main tool management
2. **Settings > LLM Configuration > Tool Consent** - Consent configuration
3. **Settings > Technical > Server Actions** - For server action tools

### System Parameters

While this module doesn't define specific system parameters, it integrates with the LLM module's parameters:

* `llm.default_provider` - Affects which LLM processes tool calls
* `llm.request_timeout` - Timeout for tool execution in async contexts
* `llm.max_retries` - Retry attempts for failed tool executions

## Security Configuration

### Security Groups

This module extends the LLM module's security groups:

* **LLM / User** (`llm.group_llm_user`): 
  - Can view and execute tools
  - Cannot modify tool configurations
  - Suitable for end users who interact with AI assistants

* **LLM / Manager** (`llm.group_llm_manager`):
  - Full access to create, modify, and delete tools
  - Can configure consent settings
  - Can view execution logs and debug information

### Access Rights

The module defines the following access rights:

```csv
# From ir.model.access.csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_llm_tool_user,llm.tool.user,model_llm_tool,llm.group_llm_user,1,0,0,0
access_llm_tool_manager,llm.tool.manager,model_llm_tool,llm.group_llm_manager,1,1,1,1
access_llm_tool_consent_config_user,llm.tool.consent.config.user,model_llm_tool_consent_config,llm.group_llm_user,1,0,0,0
access_llm_tool_consent_config_manager,llm.tool.consent.config.manager,model_llm_tool_consent_config,llm.group_llm_manager,1,1,1,1
```

### Assigning User Permissions

To configure user access:

1. Go to **Settings > Users & Companies > Users**
2. Select a user
3. Under **Other** section, find **LLM**
4. Assign appropriate group:
   - **User** for regular users
   - **Manager** for administrators

## Tool Management

### Creating Tools

1. Navigate to **Settings > LLM Configuration > Tools**
2. Click **New**
3. Configure the tool:

```python
# Example configuration
{
    'name': 'customer_search',
    'description': 'Search for customers by various criteria',
    'user_description': 'I can help you find customer information',
    'implementation': 'odoo_record_retriever',
    'active': True,
    'default': True,
    'requires_user_consent': False,
    'read_only_hint': True,
    'destructive_hint': False
}
```

### Tool Configuration Options

#### Basic Settings
- **Name**: Unique identifier used by LLM (no spaces, lowercase)
- **Description**: Technical description for LLM understanding
- **User Description**: Friendly description shown to end users
- **Implementation**: Select from registered implementations

#### Behavior Hints
- **Read Only**: Tool doesn't modify data
- **Idempotent**: Repeated calls have same effect
- **Destructive**: Tool can delete or significantly modify data
- **Open World**: Tool interacts with external systems

#### Access Control
- **Active**: Enable/disable tool without deletion
- **Default**: Include in all LLM conversations
- **Requires User Consent**: Require explicit permission

### Managing Tool Schemas

Schemas are automatically generated but can be reviewed:

1. Open a tool record
2. Click **Compute Input Schema** to refresh
3. Review the JSON schema in the **Input Schema** field

Example schema:
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
      "default": [],
      "description": "Search domain"
    },
    "limit": {
      "type": "integer",
      "default": 10
    }
  },
  "required": ["model"]
}
```

## Consent Configuration

### Setting Up Consent

1. Go to **Settings > LLM Configuration > Tool Consent**
2. Create or edit the configuration:
   - **Name**: Configuration identifier
   - **Active**: Only one configuration can be active
   - **Tool Description Message**: Appended to tool descriptions
   - **System Message Template**: Instructions for the LLM

### Default Consent Messages

```text
Tool Description Message:
"IMPORTANT: This tool requires explicit user consent before execution. 
Please ask the user for permission before using this tool."

System Message Template:
"The following tools require explicit user consent before execution: {tool_names}.
For these tools, you MUST:
1. Clearly explain to the user what the tool will do
2. Ask for their explicit permission before using the tool
3. Only proceed if the user gives clear consent
4. If the user denies consent, do not use the tool"
```

## Server Actions Integration

### Creating Server Action Tools

1. Create a server action:
   - Go to **Settings > Technical > Server Actions**
   - Create new action with Python code
   - Note the action ID

2. Create a tool:
   - Implementation: `server_action`
   - Link the server action in **Related Server Action** field

### Server Action Example

```python
# Server Action Code
model = env['res.partner']
action = model.search([('is_company', '=', True)])
# Return data in expected format
action = {
    'status': 'success',
    'message': f'Found {len(action)} companies',
    'data': {'count': len(action)}
}
```

## Monitoring and Maintenance

### Viewing Tool Usage

Monitor tool usage through:

1. **Server Logs**: Enable debug logging for detailed execution traces
2. **Mail Threads**: Tool executions in chat contexts are logged
3. **Database Queries**: Monitor performance impact

### Debug Configuration

In `odoo.conf`:
```ini
[options]
log_handler = odoo.addons.llm_tool:DEBUG
log_level = debug
```

### Performance Monitoring

Key metrics to monitor:

1. **Execution Time**: Long-running tools may timeout
2. **Database Queries**: Complex searches can impact performance
3. **Memory Usage**: Large result sets can consume memory

Optimization strategies:
- Set appropriate limits on retrieval tools
- Use field restrictions to minimize data transfer
- Enable query result caching where appropriate

## Scheduled Maintenance

### Regular Tasks

1. **Review Tool Usage** (Weekly)
   - Check for unused tools
   - Identify frequently failing tools
   - Update descriptions based on usage patterns

2. **Schema Updates** (Monthly)
   - Run "Compute Input Schema" for all tools
   - Verify schemas match implementations
   - Update after code changes

3. **Security Audit** (Quarterly)
   - Review user permissions
   - Audit tools with destructive hints
   - Verify consent configurations

### Cleanup Procedures

Remove obsolete tools:
```python
# Via Python console
obsolete = env['llm.tool'].search([
    ('active', '=', False),
    ('write_date', '<', '2024-01-01')
])
obsolete.unlink()
```

## Integration with Other Modules

### LLM Module Integration

The tool system requires:
- Active LLM provider configuration
- Proper model selection for tool support
- API key configuration for external providers

### Chat Integration

When used with chat modules:
- Tools are automatically discovered
- Execution context includes thread information
- Responses are formatted for chat display

## Troubleshooting

### Common Issues

**Tools not appearing in LLM**
1. Verify tool is active
2. Check if marked as default
3. Ensure LLM model supports function calling

**Schema generation failures**
1. Check implementation method exists
2. Verify type hints are valid
3. Review method signature for issues

**Permission errors during execution**
1. Verify user has access to target model
2. Check record rules
3. Review security groups

**Consent not working**
1. Ensure consent config is active
2. Verify tool has `requires_user_consent` enabled
3. Check LLM is receiving consent instructions

### Emergency Procedures

**Disable all tools**:
```python
# Via Python console in emergency
env['llm.tool'].search([]).write({'active': False})
```

**Reset consent configuration**:
```python
# Reset to defaults
config = env['llm.tool.consent.config'].get_active_config()
config.write({
    'tool_description_message': config._fields['tool_description_message'].default(config),
    'system_message_template': config._fields['system_message_template'].default(config)
})
```

## Backup and Recovery

### What to Backup

1. **Tool Definitions**: Included in standard database backup
2. **Custom Implementations**: Backup custom module code
3. **Server Actions**: Included in database backup

### Recovery Procedures

After restoring from backup:
1. Verify all tool implementations are available
2. Recompute schemas for all tools
3. Test critical tools manually
4. Re-enable tools gradually

## Best Practices

1. **Tool Naming Convention**: Use descriptive, action-oriented names
2. **Regular Reviews**: Audit tool usage and effectiveness
3. **Documentation**: Maintain clear descriptions for all tools
4. **Testing**: Test tools in staging before production
5. **Access Control**: Follow principle of least privilege
6. **Monitoring**: Set up alerts for tool failures
7. **Versioning**: Document changes to tool configurations
