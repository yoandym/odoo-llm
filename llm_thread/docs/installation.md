# Installation Guide

## Prerequisites

Before installing the Easy AI Chat module, ensure you have:

- **Odoo 17.0** installed and running
- **Python 3.8 or higher** with pip
- **Administrative access** to your Odoo instance
- **API keys** for at least one AI provider (OpenAI, Anthropic, etc.)

### System Requirements

- **RAM**: Minimum 4GB, recommended 8GB+
- **Storage**: 100MB for module files
- **Network**: Stable internet connection for AI API calls
- **Browser**: Modern browser with JavaScript enabled

## Installation Steps

### Install Python Packages Dependencies

```bash
# Navigate to your Odoo installation
cd /path/to/odoo

# Or if using requirements.txt
pip install -r addons/odoo-llm/llm_thread/requirements.txt
```


### Update Module List

1. Go to **Apps** menu
2. Click **Update Apps List** (Developer Mode required)

### Install the module from Odoo Apps UI

1. Navigate to Apps in your Odoo instance
2. Search for "Easy AI Chat"
3. Click Install

## Initial Configuration

After installation:

1. Navigate to **LLM > Configuration**
2. Configure at least one AI provider:
   - Add provider (OpenAI, Anthropic, etc.)
   - Enter API key
   - Test connection
3. Fetch available models
4. Set default model for chat

## Configuration

### AI Provider Setup

1. **OpenAI Configuration**:
   ```
   Name: OpenAI
   API Key: sk-...
   API URL: https://api.openai.com/v1
   ```

2. **Anthropic Configuration**:
   ```
   Name: Anthropic  
   API Key: sk-ant-...
   API URL: https://api.anthropic.com
   ```

3. **Local Ollama**:
   ```
   Name: Ollama
   API URL: http://localhost:11434
   API Key: (leave empty)
   ```

### Model Configuration

After adding providers:

1. Click **Fetch Models** on the provider
2. Available models will be loaded
3. Set appropriate use types:
   - `chat` - For conversation
   - `multimodal` - For image + text
4. Mark preferred model as default

### Tool Configuration

Enable default tools:

1. Navigate to **Settings > LLM Tools**
2. Activate desired tools
3. Mark commonly used tools as **Default**
4. These will be auto-assigned to new threads

### Security Configuration

Set up access rights:

1. Go to **Settings > Users & Companies > Groups**
2. Configure AI Chat groups:
   - **AI Chat / User**: Basic usage rights
   - **AI Chat / Manager**: Full management rights
3. Assign groups to appropriate users

### System Parameters

Optional system parameters:

```xml
<!-- Maximum response length -->
<field name="key">llm_thread.max_response_length</field>
<field name="value">4000</field>

<!-- Default thread timeout (seconds) -->
<field name="key">llm_thread.generation_timeout</field>
<field name="value">300</field>

<!-- Enable markdown rendering -->
<field name="key">llm_thread.enable_markdown</field>
<field name="value">True</field>
```

## Post-Installation Steps

### 1. Test the Installation

1. Create a test thread:
   - Navigate to **Discuss > AI Chats**
   - Click **New Thread**
   - Send a test message: "Hello, can you hear me?"

2. Verify response streaming works
3. Test tool execution if configured

### 2. Configure User Preferences

Each user can:
- Set preferred AI model
- Choose default tools
- Configure notification preferences

### 3. Set Up Integrations

Link AI Chat to other modules:

1. **Sales Integration**:
   - Enable AI chat widget on sales orders
   - Configure sales-specific tools

2. **Support Integration**:
   - Add to helpdesk tickets
   - Enable ticket creation tools

## Troubleshooting

### Installation Issues

**Module not found after installation**
- Solution: Update Apps List with developer mode enabled
- Check addon path is included in Odoo config

**Dependency errors**
- Solution: Install required modules first (llm, llm_tool, llm_mail_message_subtypes)
- Verify Python packages are installed

**Import errors**
- Solution: Restart Odoo service after installing Python packages
- Check Python path configuration

### Configuration Issues

**No models available**
- Click "Fetch Models" button on provider
- Verify API key has proper permissions
- Check provider service status

### Runtime Issues

**Thread lock errors**
- Previous generation still running
- Restart Odoo service if persists
- Check for JavaScript errors in browser console

**Slow response times**
- Check internet connection speed
- Consider using faster AI models
- Reduce number of active tools

