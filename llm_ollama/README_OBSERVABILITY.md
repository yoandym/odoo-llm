# Ollama Observability Integration

This document explains how observability is integrated into the `llm_ollama` module using the Hybrid Approach.

## Architecture Overview

The observability integration follows a hybrid approach that:
- Keeps `llm_ollama` independent (no hard dependency on `llm_observability`)
- Automatically enables observability features when `llm_observability` is installed
- Provides Ollama-specific metrics and trace attributes

## Files Structure

```
llm_observability/
├── models/
│   └── mixins/
│       └── base_observability_mixin.py  # Base functionality
│
llm_ollama/
├── models/
│   ├── ollama_provider.py              # Main provider (uses mixin)
│   └── ollama_observability.py         # Ollama-specific observability
```

## How It Works

### 1. Base Observability (in llm_observability)

The `BaseObservabilityMixin` provides:
- Trace record creation and updates
- OpenTelemetry integration
- `@with_observability` decorator
- Common metrics extraction framework

### 2. Ollama-Specific Implementation

The `OllamaObservabilityMixin` extends the base with:
- Ollama-specific metric extraction (token estimation, model family detection)
- Custom trace attributes (quantization, model tags, streaming info)
- Graceful fallback when base is not available

### 3. Provider Integration

The Ollama provider:
- Imports and inherits from `OllamaObservabilityMixin`
- Uses `@with_observability` decorator on key methods
- Works normally if observability is not available

## Usage

### Without llm_observability Module

```python
# Works normally without any observability features
provider = env['llm.provider'].search([('service', '=', 'ollama')])
response = provider.chat(messages, model='llama2')
```

### With llm_observability Module

```python
# Same code, but now creates traces automatically
provider = env['llm.provider'].search([('service', '=', 'ollama')])
response = provider.chat(messages, model='llama2')

# Traces are available in the UI
# Navigate to: LLM Observability > LLM Traces
```

## Key Features

### Automatic Trace Creation
- Every LLM operation creates a trace record
- Traces include timing, status, and error information

### Ollama-Specific Metrics
- Token estimation (since Ollama doesn't provide counts)
- Model family detection (llama, mistral, codellama, etc.)
- Quantization detection from model tags
- Tool usage tracking
- Streaming vs non-streaming detection

### OpenTelemetry Integration
- Full distributed tracing support
- Sends traces to Phoenix when configured
- Includes custom Ollama attributes

### Error Handling
- All errors are caught and recorded
- Provider continues to work even if observability fails

## Testing

Run the test script to verify the integration:

```bash
# In Odoo shell
./odoo-bin shell -d your_database

# Then in the shell
exec(open('/path/to/llm_ollama/scripts/test_ollama_observability.py').read())
```

## Adding Observability to New Methods

To add observability to a new Ollama method:

```python
@OllamaObservabilityMixin.with_observability("operation_name")
def ollama_new_method(self, param1, model=None, **kwargs):
    """Your new method with automatic observability"""
    # Method implementation
    pass
```

## Customizing Metrics

Override `_extract_metrics` in `OllamaObservabilityMixin` to add new metrics:

```python
def _extract_metrics(self, result, operation_name, args, kwargs):
    metrics = super()._extract_metrics(result, operation_name, args, kwargs)
    
    # Add your custom metrics
    if operation_name == "your_operation":
        metrics['custom_metric'] = extract_custom_value(result)
    
    return metrics
```

## Benefits

1. **No Dependencies**: `llm_ollama` works without `llm_observability`
2. **Automatic Enhancement**: Install `llm_observability` to get features
3. **Provider-Specific**: Each provider can customize their observability
4. **Maintainable**: Clear separation of concerns
5. **Extensible**: Easy to add new metrics or attributes

## Next Steps

To add observability to other providers:
1. Create a similar observability mixin in the provider module
2. Inherit from `BaseObservabilityMixin` if available
3. Add provider-specific metrics and attributes
4. Decorate methods with `@with_observability`
