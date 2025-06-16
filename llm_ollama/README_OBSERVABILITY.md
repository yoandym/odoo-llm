# Ollama Observability Integration

This document explains how observability is integrated into the `llm_ollama` module using OpenTelemetry.

## Architecture Overview

The observability integration uses OpenTelemetry directly to:
- Provide comprehensive tracing for all LLM operations
- Track tool usage, streaming, and all LLM interactions
- Support distributed tracing when connected to observability platforms like Phoenix
- Work independently without external dependencies

## Observability Strategy

The Ollama provider implements direct OpenTelemetry tracing:
- **No LlamaIndex**: Removed all LlamaIndex dependencies and observability
- **Direct OpenTelemetry**: Uses OpenTelemetry SDK directly for tracing
- **Comprehensive Coverage**: Traces all LLM operations including tools, messages, and streaming
- **Zero Dependencies**: Works with or without external observability platforms

## How It Works

### 1. OpenTelemetry Integration

The provider includes:
- Direct OpenTelemetry span creation for all operations
- Custom trace attributes for Ollama-specific data
- Token estimation and model family detection
- Tool execution tracking
- Streaming vs non-streaming differentiation

### 2. Trace Coverage

All LLM access is traced:
- Chat completions (streaming and non-streaming)
- Tool calls and executions
- Embedding generation
- Model information and parameters

### 3. Graceful Degradation

- Observability works when `llm_observability` module is available
- Provider functions normally without observability
- No hard dependencies on external tracing systems

## Usage

### Without llm_observability Module

```python
# Works normally without any observability features
provider = env['llm.provider'].search([('service', '=', 'ollama')])
response = provider.chat(messages, model='llama2')
```

### With llm_observability Module

```python
# Same code, but now creates OpenTelemetry traces automatically
provider = env['llm.provider'].search([('service', '=', 'ollama')])
response = provider.chat(messages, model='llama2')

# If Phoenix is configured, traces are sent automatically
# Local debugging shows trace info in logs
```

## Key Features

### OpenTelemetry Tracing
- Direct OpenTelemetry span creation for all operations
- Comprehensive attribute collection
- Distributed tracing support when configured

### Ollama-Specific Metrics
- Token estimation (input/output/total tokens)
- Model family detection (llama, mistral, codellama, etc.)
- Model configuration tracking (temperature, context window, etc.)
- Tool usage and execution tracking
- Streaming vs non-streaming detection

### Tool Execution Tracing
- Tracks all tool calls and executions
- Records tool parameters and results
- Monitors tool performance and errors

### Error Handling
- All errors are recorded in spans
- Provider continues to work even if tracing fails
- Graceful degradation when observability is unavailable

## Testing

Test the integration in Odoo shell:

```bash
# In Odoo shell
./odoo-bin shell -d your_database

# Test chat with tracing
provider = env['llm.provider'].search([('service', '=', 'ollama')])
messages = [{'role': 'user', 'content': 'Hello!'}]
response = provider.chat(messages)
# Check logs for OpenTelemetry trace information
```

## Implementation Details

The observability is implemented directly in the provider methods:

### Chat Method Tracing
```python
def ollama_chat(self, messages, model=None, stream=False, tools=None, **kwargs):
    """Send chat messages using Ollama with OpenTelemetry observability"""
    if _has_base_observability:
        tracer = self._init_opentelemetry_tracing()
        if tracer:
            # Create span with comprehensive attributes
            span = tracer.start_span("llm_ollama.chat_completion")
            span.set_attribute("llm.provider", "ollama")
            span.set_attribute("llm.streaming", stream)
            span.set_attribute("llm.tools_count", len(tools) if tools else 0)
            # ... execute operation and capture metrics
```

### Custom Metrics Extraction
The provider includes methods for extracting Ollama-specific metrics:
- `_extract_metrics()`: Token estimation and operation metrics
- `_get_trace_attributes()`: Model information and parameters

## Benefits

1. **No Dependencies**: Works without external observability libraries
2. **LlamaIndex-Free**: Completely removed LlamaIndex dependencies that caused tool issues
3. **Comprehensive Tracing**: All LLM operations including tools are traced
4. **Direct Integration**: Uses OpenTelemetry directly for maximum compatibility
5. **Maintainable**: Clean, simple implementation without complex abstractions
6. **Tool-Compatible**: Ensures tool calling works correctly without LlamaIndex interference

## Architecture Benefits

- **Simplified**: Removed complex LlamaIndex integration that broke tools
- **Reliable**: Direct OpenTelemetry ensures consistent tracing
- **Compatible**: Works with all Ollama features including tool calling
- **Performant**: Minimal overhead compared to LlamaIndex wrappers
- **Debuggable**: Clear trace attributes and logging for troubleshooting

## Migration from LlamaIndex

This implementation completely removes LlamaIndex:
- No more LlamaIndex tool conversion issues
- No more schema conflicts between LlamaIndex and Ollama
- No more complex fallback logic
- Direct tool support using native Ollama format
- Cleaner error handling and debugging
