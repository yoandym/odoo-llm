# Installation Guide for LLM Integration Base

## Prerequisites

Before installing this module, ensure you have:

- Odoo 17.0 or higher installed
- Python 3.8 or higher
- Administrative access to your Odoo instance
- API keys for your chosen LLM provider(s)

## Dependencies

This module depends on:

### Odoo Modules
- `base` - Odoo base module
- `mail` - Odoo mail module
- `web` - Odoo web module

### Python Dependencies
The module will automatically install required provider SDKs based on your configuration:
- OpenAI SDK (for OpenAI/Azure)
- Anthropic SDK (for Claude)
- Other provider-specific packages as needed

## Installation Steps

### 1. Download the Module

#### Using Git
```bash
# Navigate to your addons directory
cd /path/to/odoo/addons

# Clone the repository
git clone https://github.com/apexive/odoo-llm.git odoo-llm

# The llm module will be at odoo-llm/llm
```

#### Manual Download
1. Download the module from [GitHub](https://github.com/apexive/odoo-llm)
2. Extract to your Odoo addons directory
3. Ensure the folder structure is: `addons/odoo-llm/llm`

### 2. Add to Odoo Addons Path

Ensure the module is in your Odoo addons path:

```python
# In your odoo.conf file
addons_path = /path/to/odoo/addons,/path/to/odoo-llm
```

### 3. Update Module List

1. Restart Odoo server
2. Go to Apps menu
3. Click "Update Apps List" (may require developer mode)
4. Search for "LLM Integration Base" or "LLM"

### 4. Install the Module

1. Find "LLM Integration Base" in the Apps list
2. Click "Install"
3. Wait for installation to complete

## Configuration

After installation, configure the module:

### Basic Configuration

1. **Navigate to Settings > LLM Configuration**

2. **Add Your First Provider**:
   - Click "Providers" → "New"
   - Enter provider details:
     ```
     Name: OpenAI Production
     Provider Type: openai
     API Key: sk-...your-api-key...
     Active: ✓
     ```

3. **Fetch Available Models**:
   - Save the provider
   - Click "Fetch Models" button
   - Wait for model list to populate

4. **Set Default Models**:
   - Go to "Models" menu
   - Find your preferred chat model
   - Edit and set "Is Default for Chat" = True
   - Repeat for embeddings if needed

### Provider-Specific Configuration

#### OpenAI
```python
{
    'name': 'OpenAI',
    'provider_type': 'openai',
    'api_key': 'sk-...',
    'api_url': 'https://api.openai.com/v1',  # Optional custom endpoint
}
```

#### Anthropic (Claude)
```python
{
    'name': 'Anthropic',
    'provider_type': 'anthropic',
    'api_key': 'sk-ant-...',
}
```

#### Ollama (Local)
```python
{
    'name': 'Ollama Local',
    'provider_type': 'ollama',
    'api_url': 'http://localhost:11434',  # Ollama server URL
}
```

#### Azure OpenAI
```python
{
    'name': 'Azure OpenAI',
    'provider_type': 'azure_openai',
    'api_key': 'your-azure-key',
    'api_url': 'https://your-resource.openai.azure.com/',
    'api_version': '2024-02-15-preview',
}
```

### Advanced Configuration

#### Proxy Settings

If behind a corporate proxy:

```python
# In odoo.conf
[options]
proxy_mode = True
proxy_host = proxy.company.com
proxy_port = 8080
```

#### Rate Limiting

Configure in provider settings:
- **Max Retries**: Number of retry attempts
- **Retry Delay**: Seconds between retries
- **Request Timeout**: Maximum request duration

#### Security Groups

Assign users to appropriate groups:
1. Go to Settings > Users & Companies > Groups
2. Find LLM groups:
   - **LLM / User**: Can use AI features
   - **LLM / Manager**: Can configure providers and models

## Post-Installation

After installation:

1. **Test Provider Connection**:
   ```python
   # Via Python console
   provider = env['llm.provider'].search([('active', '=', True)], limit=1)
   models = provider.action_fetch_models()
   print(f"Found {len(models)} models")
   ```

2. **Configure Default Models**:
   - Set default chat model for conversations
   - Set default embedding model for semantic search
   - Configure model parameters (temperature, max tokens)

3. **Test Basic Functionality**:
   ```python
   # Test chat completion
   model = env['llm.model'].search([('model_use', '=', 'chat')], limit=1)
   response = model.chat([
       {"role": "user", "content": "Hello, are you working?"}
   ])
   print(response)
   ```

## Upgrading

To upgrade from a previous version:

```bash
# Update the module code
cd /path/to/odoo-llm
git pull origin main

# In Odoo, upgrade the module
# 1. Go to Apps > Installed Apps
# 2. Search for "LLM Integration Base"
# 3. Click "Upgrade"
```

### Migration Notes

- Models are automatically migrated
- API keys are preserved
- Check provider configurations after upgrade

## Uninstallation

⚠️ **Warning**: Uninstalling will remove all:
- Provider configurations
- Model definitions
- API keys
- Usage history

To uninstall:
1. First uninstall dependent modules (llm_tool, llm_thread, etc.)
2. Go to Apps > Installed Apps
3. Find "LLM Integration Base"
4. Click "Uninstall"

## Troubleshooting

### Common Issues

**Issue**: Module not appearing in Apps list
- **Solution**: 
  - Verify module path in addons_path
  - Check `__manifest__.py` exists
  - Restart server with `--update=apps`

**Issue**: "Provider not found" error
- **Solution**:
  - Ensure provider is active
  - Verify API key is correct
  - Check network connectivity

**Issue**: Models not fetching
- **Solution**:
  - Verify API key permissions
  - Check provider API URL
  - Review server logs for errors

**Issue**: SSL/Certificate errors
- **Solution**:
  - Update certificates: `pip install --upgrade certifi`
  - Configure proxy settings if needed
  - Check firewall rules

### Debug Mode

Enable debug logging:

```python
# In odoo.conf
log_level = debug
log_handler = odoo.addons.llm:DEBUG
```

### Getting Help

If you encounter issues:

1. Check server logs for detailed errors
2. Visit [GitHub Issues](https://github.com/apexive/odoo-llm/issues)
3. Contact support@apexive.com
4. Include:
   - Odoo version
   - Module version
   - Error messages
   - Provider type
