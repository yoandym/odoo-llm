# LLM Integration Base

## Contents

- [Installation](installation.md)
- [User Guide](user-guide.md)
- [Admin Guide](admin-guide.md)
- [Developer Guide](developer-guide/index.md)

## Overview

LLM Integration Base is a foundational module that provides seamless integration with various Large Language Model (LLM) providers in Odoo. It serves as the core framework for AI-powered features, supporting multiple providers including OpenAI, Anthropic, Ollama, Replicate, and more.

## Key Features

* **Multi-Provider Support** - Unified interface for OpenAI, Anthropic, Ollama, Replicate, and custom providers
* **Model Management** - Centralized management of AI models with automatic discovery
* **Chat Completions** - Streaming and non-streaming chat completions with full parameter control
* **Text Embeddings** - Generate embeddings for semantic search and analysis
* **Provider Abstraction** - Easy provider switching without code changes
* **Security & Access Control** - Role-based access to AI capabilities
* **Usage Tracking** - Monitor API usage and costs (when supported)

## Requirements

* Odoo 17.0+
* Python 3.8+
* Dependencies:
  - `mail` - Odoo mail module
  - `web` - Odoo web module
* Python packages (auto-installed):
  - Provider-specific SDKs as needed

## Quick Start

```python
# Configure a provider
provider = self.env['llm.provider'].create({
    'name': 'OpenAI',
    'provider_type': 'openai',
    'api_key': 'your-api-key',
})

# Fetch available models
provider.action_fetch_models()

# Use a model for chat
model = self.env['llm.model'].search([
    ('provider_id', '=', provider.id),
    ('model_use', '=', 'chat')
], limit=1)

response = model.chat(messages=[
    {"role": "user", "content": "Hello, how are you?"}
])
```

## Configuration

After installation:

1. **Navigate to Settings > LLM Configuration**
2. **Add a Provider**: Click "New" and configure your AI provider
3. **Fetch Models**: Use the "Fetch Models" button to discover available models
4. **Set Defaults**: Mark preferred models as default for different use cases
5. **Configure Access**: Set up user groups and permissions

## Screenshots

![Provider Configuration](_static/img/provider_config.png)
*Configure multiple AI providers with API keys and settings*

![Model Management](_static/img/model_management.png)
*Manage and organize available AI models*

![Usage Dashboard](_static/img/usage_dashboard.png)
*Monitor API usage and performance metrics*

## Integration

This module serves as the foundation for:

* **Easy AI Chat**: Interactive AI conversations
* **LLM Tool**: Function calling and tool integration
* **Custom AI Solutions**: Build your own AI-powered features

### Integration Points

* **Model Selection**: Unified model selection across all AI features
* **Provider Management**: Centralized provider configuration
* **Security Framework**: Consistent access control for AI features
* **Error Handling**: Standardized error handling and retry logic

## Related Modules

* [Easy AI Chat](../llm_thread/index.md) - Build on top for conversational AI
* [LLM Tool](../llm_tool/index.md) - Add function calling capabilities
* [LLM Mail Message Subtypes](../llm_mail_message_subtypes/index.md) - Enhanced message types

## Troubleshooting

Common issues and solutions:

* **Invalid API Key**: Verify key in provider settings and check provider dashboard
* **Model Not Found**: Click "Fetch Models" to refresh model list
* **Rate Limits**: Configure retry settings and implement rate limiting
* **Connection Errors**: Check network settings and proxy configuration

## Support

For issues and questions:

* Email: support@apexive.com
* GitHub: [Report an issue](https://github.com/apexive/odoo-llm/issues)
* Documentation: [Full Documentation](https://github.com/apexive/odoo-llm)

## Contributing

We welcome contributions! Please see:

* [Contributing Guide](https://github.com/apexive/odoo-llm/blob/main/CONTRIBUTING.md)
* [Development Setup](developer-guide.md#development-setup)
* [API Documentation](api.rst)
