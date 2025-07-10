# Easy AI Chat (llm_thread)

## Contents

```{toctree}
:maxdepth: 2

installation
user-guide
admin-guide
developer-guide/index
```

## Overview

Easy AI Chat for Odoo is a user-friendly module that brings AI-powered chat capabilities to your Odoo environment. It provides seamless integration with multiple AI providers, manages real-time conversations through Odoo's mail system, and supports advanced features like multimodal interactions and tool integration.

## Key Features

* **Multiple AI Providers** - Support for OpenAI, Anthropic, Grok, Ollama, DeepSeek, and more
* **Real-Time Chat** - Instant AI conversations with streaming responses
* **Full Odoo Integration** - Link chats to any Odoo record for contextual interactions
* **Tool Integration** - Enable AI to execute custom tools and functions
* **Function Calling** - Select specific tools for each thread to enhance AI capabilities
* **Multimodal Support** - Go beyond text with advanced AI models
* **Message Voting** - Rate AI responses for quality tracking
* **Thread Management** - Organize conversations with customizable threads

## Requirements

* Odoo 17.0+
* Python 3.8+
* Dependencies:
  - `llm` - LLM Integration Base module
  - `llm_tool` - LLM Tool Integration module
  - `llm_mail_message_subtypes` - Mail message subtypes for LLM
  - `base`, `mail`, `web` - Core Odoo modules
* Python packages:
  - `emoji` - For emoji processing
  - `markdown2` - For markdown rendering

## Quick Start

```python
# Create a new chat thread
thread = self.env['llm.thread'].create({
    'name': 'Customer Support Chat',
    'provider_id': provider.id,
    'model_id': model.id,
    'tool_ids': [(6, 0, tool_ids)],
})

# Send a message to the thread
response = thread.send_message("Hello, I need help with my order")

# Generate AI response
for chunk in thread.generate(user_message_body="What's the status of order SO/2024/001?"):
    # Process streaming response
    print(chunk)
```

## Configuration

After installation, configure the module:

1. **AI Provider Setup**: Configure your AI provider API keys in Settings > LLM Configuration
2. **Model Selection**: Choose and configure available AI models
3. **Tool Configuration**: Enable and configure tools for function calling
4. **Access Rights**: Configure user permissions through security groups
5. **Default Settings**: Set default provider, model, and tools for new threads

## Screenshots

![AI Chat Interface](_static/img/chat_interface.png)
*The main chat interface showing conversation threads and real-time responses*

![Thread Configuration](_static/img/thread_config.png)
*Configuration options for AI threads including model and tool selection*

![Integration Example](_static/img/integration_example.png)
*AI chat integrated with a sales order for contextual assistance*

## Integration

The module integrates seamlessly with:

* **LLM Base Module**: Provides core AI provider integration and model management
* **LLM Tool Module**: Enables function calling and tool execution
* **Mail System**: Full integration with Odoo's mail system for message handling
* **Any Odoo Model**: Link threads to any record for contextual AI assistance

## Related Modules

* [LLM Integration Base](../llm/index.md) - Core AI provider integration
* [LLM Tool](../llm_tool/index.md) - Tool and function calling framework
* [LLM Mail Message Subtypes](../llm_mail_message_subtypes/index.md) - Specialized message types
