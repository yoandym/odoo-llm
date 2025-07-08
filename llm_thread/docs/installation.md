# Installation Guide

## Prerequisites

Before installing the Easy AI Chat module, ensure you have:

- **Odoo 17.0 or higher** installed and running
- **Python 3.8 or higher** with pip
- **Administrative access** to your Odoo instance
- **API keys** for at least one AI provider (OpenAI, Anthropic, etc.)

### System Requirements

- **RAM**: Minimum 4GB, recommended 8GB+
- **Storage**: 100MB for module files
- **Network**: Stable internet connection for AI API calls
- **Browser**: Modern browser with JavaScript enabled

### Python Dependencies

The module requires these Python packages:
```bash
emoji>=2.0.0
markdown2>=2.4.0
```

## Installation Steps

### 1. Install Dependencies

First, install the required Odoo modules:

1. **LLM Integration Base (`llm`)**: Core AI provider integration
2. **LLM Tool (`llm_tool`)**: Tool and function calling framework  
3. **LLM Mail Message Subtypes (`llm_mail_message_subtypes`)**: Message type support

These can be installed from the same repository or Odoo Apps Store.

### 2. Install Python Packages

```bash
# Navigate to your Odoo installation
cd /path/to/odoo

# Install required Python packages
pip install emoji markdown2

# Or if using requirements.txt
pip install -r addons/odoo-llm/llm_thread/requirements.txt
```

### 3. Download and Install Module

#### Option A: From GitHub

```bash
# Navigate to your Odoo addons directory
cd /path/to/odoo/addons

# Clone the repository
git clone https://github.com/apexive/odoo-llm.git

# Or download specific module
wget https://github.com/apexive/odoo-llm/archive/main.zip
unzip main.zip
```

#### Option B: From Odoo Apps Store

1. Navigate to Apps in your Odoo instance
2. Search for "Easy AI Chat"
3. Click Install

### 4. Update Module List

1. Go to **Apps** menu
2. Click **Update Apps List** (Developer Mode required)
3. Search for "Easy AI Chat"
4. Click **Install**

### 5. Initial Configuration

After installation:

1. Navigate to **Settings > LLM Configuration**
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

**API connection failed**
- Verify API key is correct
- Check network connectivity
- Ensure API URL is accurate
- Test with curl: 
  ```bash
  curl -H "Authorization: Bearer YOUR_API_KEY" https://api.openai.com/v1/models
  ```

**No models available**
- Click "Fetch Models" button on provider
- Verify API key has proper permissions
- Check provider service status

**Tools not working**
- Ensure tools module (llm_tool) is installed
- Activate tools in configuration
- Check user permissions

### Runtime Issues

**Thread lock errors**
- Previous generation still running
- Restart Odoo service if persists
- Check for JavaScript errors in browser console

**Slow response times**
- Check internet connection speed
- Consider using faster AI models
- Reduce number of active tools

## Upgrade Instructions

When upgrading the module:

1. **Backup your database** first
2. Download new version
3. Replace module files
4. Restart Odoo service
5. Navigate to Apps
6. Find Easy AI Chat and click **Upgrade**
7. Test functionality

### Migration Notes

**From 17.0.1.0.x to 17.0.1.1.x**:
- New streaming architecture
- Tool system improvements
- No manual migration needed

## Uninstallation

To remove the module:

1. Navigate to **Apps**
2. Search for "Easy AI Chat"
3. Click **Uninstall**
4. Confirm removal

Note: This will archive all chat threads but preserve message history.

## Environment Variables

Optional environment variables:

```bash
# Proxy configuration (if needed)
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080

# Timeout settings
export LLM_REQUEST_TIMEOUT=60

# Debug mode
export LLM_DEBUG=1
```

## Docker Installation

For Docker deployments:

```dockerfile
FROM odoo:17.0

# Install Python dependencies
RUN pip install emoji markdown2

# Copy module
COPY ./odoo-llm /mnt/extra-addons/odoo-llm

# Add to addon path
ENV ADDONS_PATH="/mnt/extra-addons"
```

## Support

If you encounter issues:

1. Check the [FAQ](user-guide.md#faq)
2. Review [Troubleshooting Guide](#troubleshooting)
3. Contact support@apexive.com
4. Create an issue on [GitHub](https://github.com/apexive/odoo-llm/issues)
