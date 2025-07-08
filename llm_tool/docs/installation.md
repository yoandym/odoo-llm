# Installation Guide for LLM Tool

## Prerequisites

Before installing this module, ensure you have:

- Odoo 17.0 or higher installed
- Python 3.8 or higher
- The `llm` module installed and configured (required dependency)
- Administrative access to your Odoo instance

## Dependencies

This module depends on:

### Odoo Modules
- `base` - Odoo base module
- `mail` - Odoo mail module for thread integration
- `llm` - LLM Integration Base module (must be installed first)

### Python Dependencies
```bash
pydantic>=2.0.0  # For schema generation and validation
```

The Python dependencies will be automatically installed when you install the module through Odoo.

## Installation Steps

### 1. Install the LLM Base Module First

The `llm` module must be installed before installing `llm_tool`:

```bash
# Navigate to your Odoo instance
# Install the llm module first
# Then proceed with llm_tool installation
```

### 2. Download the Module

#### Using Git
```bash
# Navigate to your addons directory
cd /path/to/odoo/addons

# Clone the repository
git clone https://github.com/apexive/odoo-llm.git odoo-llm

# The llm_tool module will be at odoo-llm/llm_tool
```

#### Manual Download
1. Download the module from [GitHub](https://github.com/apexive/odoo-llm)
2. Extract to your Odoo addons directory
3. Ensure the folder structure is: `addons/odoo-llm/llm_tool`

### 3. Add to Odoo Addons Path

Ensure the module is in your Odoo addons path:

```python
# In your odoo.conf file
addons_path = /path/to/odoo/addons,/path/to/odoo-llm
```

### 4. Update Module List

1. Restart Odoo server
2. Go to Apps menu
3. Click "Update Apps List" (may require developer mode)
4. Search for "LLM Tool"

### 5. Install the Module

1. Find "LLM Tool" in the Apps list
2. Click "Install"
3. Wait for installation to complete

## Configuration

After installation, configure the module:

### Basic Configuration

1. **Navigate to Settings > LLM Configuration > Tools**
2. **Configure Tool Consent Settings** (if needed):
   - Go to Settings > LLM Configuration > Tool Consent
   - Set up consent messages for tools requiring user permission
   - Activate the configuration

3. **Create Your First Tool**:
   ```python
   # Example: Create a greeting tool
   self.env['llm.tool'].create({
       'name': 'greeting',
       'description': 'Greet the user and show available capabilities',
       'user_description': 'I can greet you and show what I can help with',
       'implementation': 'user_greeting',
       'active': True,
       'default': True,  # Include in all LLM requests
   })
   ```

### Advanced Configuration

#### Server Actions Integration

Create custom tools using server actions:

1. Go to Settings > Technical > Server Actions
2. Create a new server action with your custom logic
3. Create an LLM tool with `implementation` set to `server_action`
4. Link the server action in the tool configuration

#### Security Configuration

Configure access rights for tool usage:

1. Go to Settings > Users & Companies > Groups
2. Configure which user groups can:
   - View tools
   - Execute tools
   - Manage tools

## Post-Installation

After installation:

1. **Create Initial Tools**:
   - Set up commonly used tools for your organization
   - Configure tool descriptions for optimal LLM understanding

2. **Test Tool Execution**:
   ```python
   # Test a tool manually
   tool = self.env['llm.tool'].search([('name', '=', 'greeting')], limit=1)
   result = tool.execute({'greeting_type': 'initial'})
   print(result)
   ```

3. **Configure Default Tools**:
   - Mark frequently used tools as default
   - These will be available in all LLM interactions

## Upgrading

To upgrade from a previous version:

```bash
# Update the module code
cd /path/to/odoo-llm
git pull origin main

# In Odoo, upgrade the module
# 1. Go to Apps > Installed Apps
# 2. Search for "LLM Tool"
# 3. Click on the module
# 4. Click "Upgrade"
```

### Migration Notes

- **Version 17.0.1.0.2**: Added response schema standardization
- **Version 17.0.1.0.1**: Initial migration support

## Uninstallation

To uninstall the module:

1. **Remove Dependent Configurations First**:
   - Delete or deactivate all created tools
   - Remove any custom server actions linked to tools

2. **Uninstall the Module**:
   - Go to Apps > Installed Apps
   - Find "LLM Tool"
   - Click "Uninstall"

⚠️ **Warning**: Uninstalling will remove:
- All tool definitions
- Tool execution history
- Consent configurations

## Troubleshooting

### Common Issues

**Issue**: Module not appearing in Apps list
- **Solution**: 
  - Verify the module is in the addons path
  - Check folder structure: `odoo-llm/llm_tool/__manifest__.py` must exist
  - Restart Odoo and update apps list again

**Issue**: Installation fails with "Unmet dependencies"
- **Solution**: 
  - Install the `llm` module first
  - Ensure Python dependencies are installed: `pip install pydantic>=2.0.0`

**Issue**: Tools not executing properly
- **Solution**:
  - Check tool implementation is correctly defined
  - Verify user has execution permissions
  - Review logs for detailed error messages

**Issue**: Schema generation failing
- **Solution**:
  - Ensure method signatures have proper type hints
  - Check Pydantic is correctly installed
  - Review implementation method docstrings

### Debug Mode

Enable debug logging for troubleshooting:

```python
# In your odoo.conf
log_level = debug
log_handler = odoo.addons.llm_tool:DEBUG
```

### Getting Help

If you encounter issues:

1. Check the [GitHub Issues](https://github.com/apexive/odoo-llm/issues)
2. Review server logs for error details
3. Create a new issue with:
   - Odoo version
   - Module version
   - Error messages
   - Steps to reproduce
