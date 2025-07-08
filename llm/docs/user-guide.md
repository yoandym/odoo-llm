# User Guide for LLM Integration Base

## Overview

LLM Integration Base provides a unified interface for integrating various Large Language Model providers into your Odoo instance. It serves as the foundation for AI-powered features, enabling chat completions, embeddings, and other AI capabilities across your Odoo applications.

## Getting Started

### First Steps

1. After installation, navigate to **Settings > LLM Configuration**
2. You'll see the main dashboard with:
   - Providers section
   - Models section
   - Usage statistics (if available)
3. Start by configuring your first provider

### Basic Concepts

Before using this module, understand these key concepts:

- **Provider**: A service that offers LLM capabilities (OpenAI, Anthropic, etc.)
- **Model**: A specific AI model offered by a provider (GPT-4, Claude, etc.)
- **Chat Completion**: AI-generated responses to conversational prompts
- **Embeddings**: Numerical representations of text for semantic search
- **API Key**: Authentication credential for accessing provider services

## Features

### Feature 1: Provider Management

Configure and manage multiple LLM providers from a single interface.

**How to use:**

1. Navigate to **Settings > LLM Configuration > Providers**
2. Click **New** to add a provider
3. Fill in the required fields:
   - **Name**: Descriptive name (e.g., "OpenAI Production")
   - **Provider Type**: Select from dropdown (openai, anthropic, etc.)
   - **API Key**: Your provider's API key
   - **Active**: Enable/disable the provider
4. Click **Save**

**Example Configuration:**
```
Name: OpenAI GPT-4
Provider Type: openai
API Key: sk-...your-key...
API URL: https://api.openai.com/v1 (default)
Active: ✓
```

**Tips:**
- Use descriptive names to distinguish between multiple providers
- Keep API keys secure and never share them
- Test providers after configuration

### Feature 2: Model Discovery and Management

Automatically discover and manage available models from configured providers.

**How to use:**

1. Select a configured provider
2. Click **Fetch Models** button
3. Wait for the model list to populate
4. Review discovered models in **Models** menu

**Model Properties:**
- **Name**: Model identifier (e.g., "gpt-4")
- **Display Name**: User-friendly name
- **Model Use**: Purpose (chat, embeddings, etc.)
- **Context Size**: Maximum token limit
- **Capabilities**: Supported features

**Setting Default Models:**
1. Go to **Models** menu
2. Find your preferred model
3. Edit the model
4. Check **Is Default for Chat** or **Is Default for Embeddings**
5. Save changes

### Feature 3: Chat Completions

Use AI models for generating text responses.

**Basic Usage:**
```python
# From any Odoo model or method
model = self.env['llm.model'].get_default_chat_model()
response = model.chat([
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Explain Odoo in one sentence."}
])
print(response)
```

**Advanced Parameters:**
- **temperature**: Controls randomness (0.0-2.0)
- **max_tokens**: Maximum response length
- **top_p**: Nucleus sampling parameter
- **stream**: Enable streaming responses

**Streaming Responses:**
```python
# For real-time responses
for chunk in model.stream_chat(messages):
    print(chunk, end='')
```

### Feature 4: Embeddings Generation

Generate vector embeddings for semantic search and similarity matching.

**How to use:**

1. Ensure you have an embedding model configured
2. Set a default embedding model
3. Use the embedding functionality:

```python
# Generate embeddings
embedding_model = self.env['llm.model'].get_default_embedding_model()
vectors = embedding_model.embed_texts([
    "Product description 1",
    "Product description 2"
])
```

**Use Cases:**
- Semantic search in documents
- Content similarity matching
- Recommendation systems
- Clustering and classification

## Common Use Cases

### Use Case 1: Customer Support Automation

**Scenario**: Automate initial customer inquiries using AI

**Solution**:
1. Configure a chat model (e.g., GPT-4)
2. Create system prompts for your business
3. Integrate with helpdesk or live chat:
   ```python
   messages = [
       {"role": "system", "content": "You are a customer support agent for [Company]. Be helpful and professional."},
       {"role": "user", "content": customer_message}
   ]
   response = model.chat(messages)
   ```

### Use Case 2: Content Generation

**Scenario**: Generate product descriptions, emails, or documentation

**Solution**:
1. Select appropriate model with good writing capabilities
2. Craft specific prompts:
   ```python
   prompt = f"Write a compelling product description for: {product.name}\nFeatures: {product.features}"
   response = model.chat([{"role": "user", "content": prompt}])
   ```

### Use Case 3: Intelligent Search

**Scenario**: Implement semantic search across your data

**Solution**:
1. Configure an embedding model
2. Generate embeddings for your content
3. Store embeddings for similarity search
4. Query using natural language

## User Interface Guide

### Main Dashboard

Located at **Settings > LLM Configuration**:
- **Quick Stats**: Active providers, available models
- **Usage Metrics**: API calls, tokens used (if tracked)
- **Quick Actions**: Add provider, fetch models

### Provider List View

**Columns**:
- Name and type
- Status (active/inactive)
- Number of associated models
- Last sync date

**Actions**:
- Create new provider
- Edit configuration
- Fetch models
- Test connection

### Model List View

**Columns**:
- Model name and provider
- Use case (chat/embeddings)
- Default status
- Context size
- Capabilities

**Filters**:
- By provider
- By use case
- Active only
- Default models

### Menu Structure

```
Settings
└── LLM Configuration
    ├── Dashboard
    ├── Providers
    │   ├── Provider List
    │   └── Create Provider
    └── Models
        ├── Model List
        └── Model Details
```

## Best Practices

1. **API Key Security**: 
   - Store keys securely
   - Use different keys for dev/prod
   - Rotate keys regularly

2. **Model Selection**:
   - Choose models appropriate for your use case
   - Consider cost vs. performance
   - Test different models for quality

3. **Error Handling**:
   - Always wrap API calls in try-except blocks
   - Implement retry logic for transient failures
   - Have fallback options

4. **Cost Management**:
   - Monitor token usage
   - Set up alerts for unusual usage
   - Use appropriate models for each task

5. **Performance**:
   - Cache responses when appropriate
   - Use streaming for long responses
   - Batch embedding requests

## Permissions and Access Rights

### Security Groups

- **LLM / User**: 
  - Can use AI features in other modules
  - Cannot modify provider settings
  - Can view available models

- **LLM / Manager**:
  - Full access to configuration
  - Can add/edit providers
  - Can set default models
  - View usage statistics

### Assigning Permissions

1. Go to **Settings > Users & Companies > Users**
2. Select a user
3. In the **Other** section, find **LLM**
4. Assign appropriate group

## FAQ

**Q: How do I get API keys for providers?**
A: Visit the provider's website:
- OpenAI: https://platform.openai.com
- Anthropic: https://console.anthropic.com
- Others: Check provider documentation

**Q: Can I use multiple providers simultaneously?**
A: Yes! Configure multiple providers and select appropriate models for different tasks.

**Q: How do I control costs?**
A: Use less expensive models for simple tasks, monitor usage, and set up billing alerts with your provider.

**Q: What's the difference between chat and embedding models?**
A: Chat models generate text responses, while embedding models create vector representations for similarity matching.

**Q: Can I use local models?**
A: Yes, through Ollama or similar local providers. Configure with appropriate API URL.

## Tips and Tricks

- **Model Testing**: Use the Python console to test models before integration
- **Prompt Engineering**: Craft clear, specific prompts for better results
- **Temperature Tuning**: Lower = more focused, Higher = more creative
- **Context Management**: Be mindful of token limits in conversations

## Troubleshooting

### Common Issues

**Problem**: "Invalid API Key" error
- **Cause**: Incorrect or expired API key
- **Solution**: Verify key on provider's website, update in Odoo

**Problem**: Models not appearing after fetch
- **Cause**: API permissions or network issues
- **Solution**: Check API key permissions, verify network connectivity

**Problem**: Slow response times
- **Cause**: Network latency or model size
- **Solution**: Consider using smaller models or implementing caching

**Problem**: "Rate limit exceeded" errors
- **Cause**: Too many requests to provider
- **Solution**: Implement retry logic with exponential backoff

## Getting Help

If you need additional help:

1. Check provider-specific documentation
2. Review error logs in Odoo
3. Contact support at support@apexive.com

## Next Steps

After mastering the basics:

- Install [LLM Tool](../llm_tool/index.md) for function calling
- Try [Easy AI Chat](../llm_thread/index.md) for conversational AI
- Explore custom integrations in your modules
