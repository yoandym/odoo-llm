import ast
import json
import logging
import uuid

import ollama
from odoo import api, models

from ..utils.ollama_message_validator import OllamaMessageValidator
from ..utils.ollama_tool_call_id_utils import OllamaToolCallIdUtils

# Import base observability mixin directly
try:
    from odoo.addons.llm_observability.models.mixins.base_observability_mixin import \
        BaseObservabilityMixin
    _has_base_observability = True
except ImportError:
    _has_base_observability = False

    class BaseObservabilityMixin:
        pass

_logger = logging.getLogger(__name__)

# Debug logging only for base observability
_logger.info(f"llm_ollama: _has_base_observability = {_has_base_observability}")


class LLMProvider(models.Model):
    _inherit = "llm.provider"
    
    def _init_opentelemetry_tracing(self):
        """Initialize OpenTelemetry tracing"""
        phoenix_config = self.env['phoenix.config'].get_active_config()
        if not phoenix_config or not phoenix_config.enable_fullstack_tracing:
            return None
            
        try:
            # Try to import OpenTelemetry
            from opentelemetry import trace
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import \
                OTLPSpanExporter
            from opentelemetry.sdk.resources import Resource
            from opentelemetry.sdk.trace import TracerProvider
            from opentelemetry.sdk.trace.export import BatchSpanProcessor

            # Check if we already have a tracer configured
            current_tracer = trace.get_tracer_provider()
            if hasattr(current_tracer, 'get_tracer'):
                # Already configured, just get a tracer
                module_name = 'llm_ollama'
                return current_tracer.get_tracer(
                    instrumenting_module_name=module_name,
                    instrumenting_library_version="1.0.0"
                )
            
            # Configure resource
            module_name = 'llm_ollama'
            service_name = f"odoo-llm-{module_name}"
            resource = Resource.create({
                "service.name": service_name,
                "service.version": "1.0.0",
                "deployment.environment": getattr(phoenix_config, 'environment', 'development'),
                "service.namespace": "odoo-llm",
            })
            
            # Set up tracer provider
            provider = TracerProvider(resource=resource)
            trace.set_tracer_provider(provider)
            
            # Configure OTLP exporter
            otlp_exporter = OTLPSpanExporter(
                endpoint=phoenix_config.otlp_endpoint,
                insecure=True
            )
            
            # Add span processor
            span_processor = BatchSpanProcessor(otlp_exporter)
            provider.add_span_processor(span_processor)
            
            return trace.get_tracer(
                instrumenting_module_name=module_name,
                instrumenting_library_version="1.0.0"
            )
            
        except ImportError:
            _logger.debug("OpenTelemetry not available")
            return None
        except Exception as e:
            _logger.debug(f"Could not initialize OpenTelemetry: {e}")
            return None
    
    def _extract_metrics(self, result, operation_name, args, kwargs):
        """Extract metrics for observability"""
        # Add Ollama-specific metrics extraction here
        metrics = {}
        
        try:
            if operation_name == "chat_completion":
                # Basic token estimation for Ollama
                if isinstance(result, dict) and 'message' in result:
                    content = result['message'].get('content', '')
                    if content:
                        metrics['output_tokens'] = len(content) // 4  # Rough estimation
                        
                # Add input token estimation
                if len(args) > 0 and isinstance(args[0], list):
                    input_text = ""
                    for msg in args[0]:
                        if isinstance(msg, dict) and 'content' in msg:
                            input_text += msg['content']
                    if input_text:
                        metrics['input_tokens'] = len(input_text) // 4
                        
                if 'input_tokens' in metrics and 'output_tokens' in metrics:
                    metrics['total_tokens'] = metrics['input_tokens'] + metrics['output_tokens']
                    
            elif operation_name == "embedding":
                if isinstance(result, list):
                    metrics['embeddings_count'] = len(result)
                    if result and isinstance(result[0], list):
                        metrics['embedding_dimension'] = len(result[0])
                        
        except Exception as e:
            _logger.debug(f"Error extracting Ollama metrics: {e}")
        
        return metrics
    
    def _get_trace_attributes(self, operation_name, args, kwargs):
        """Get trace attributes for observability"""
        attributes = {}
        
        try:
            # Add Ollama-specific attributes
            attributes['llm.provider.type'] = 'ollama'
            
            # Extract model information
            model = kwargs.get('model')
            if not model and len(args) > 1:
                model = args[1]
            
            if model:
                model_name = str(model.name if hasattr(model, 'name') else model)
                attributes['ollama.model.full_name'] = model_name
                attributes['llm.model'] = model_name
                
                # Detect model family
                model_lower = model_name.lower()
                if 'llama' in model_lower:
                    attributes['ollama.model.family'] = 'llama'
                elif 'mistral' in model_lower:
                    attributes['ollama.model.family'] = 'mistral'
                elif 'qwen' in model_lower:
                    attributes['ollama.model.family'] = 'qwen'
                elif 'deepseek' in model_lower:
                    attributes['ollama.model.family'] = 'deepseek'
                else:
                    attributes['ollama.model.family'] = 'other'
            
            # Add operation-specific attributes
            if operation_name == "chat_completion":
                if kwargs.get('tools'):
                    attributes['ollama.tools.enabled'] = True
                    attributes['ollama.tools.count'] = len(kwargs['tools'])
                
                attributes['ollama.streaming'] = kwargs.get('stream', False)
                
                if kwargs.get('system_prompt'):
                    attributes['ollama.system_prompt.length'] = len(kwargs['system_prompt'])
                    
        except Exception as e:
            _logger.debug(f"Error getting Ollama trace attributes: {e}")
        
        return attributes

    @api.model
    def _get_available_services(self):
        services = super()._get_available_services()
        return services + [("ollama", "Ollama")]

    def ollama_get_client(self):
        """Get Ollama client instance"""
        return ollama.Client(host=self.api_base or "http://localhost:11434")

    @property
    def client(self):
        """Property to access the Ollama client"""
        return self.ollama_get_client()

    # Ollama specific implementation
    def ollama_format_tools(self, tools):
        """Format tools for Ollama"""
        return [self._ollama_format_tool(tool) for tool in tools]

    def _ollama_format_tool(self, tool):
        """Convert a tool to Ollama format

        Args:
            tool: llm.tool record to convert

        Returns:
            Dictionary in Ollama tool format
        """
        try:
            # First use the explicit input_schema if available
            if tool.input_schema:
                try:
                    schema = json.loads(tool.input_schema)
                    return self._create_ollama_tool_from_schema(schema, tool)
                except json.JSONDecodeError:
                    _logger.error(f"Invalid JSON schema for tool {tool.name}")
                    # Continue to next approach

            # Next generate schema from the tool's method signature
            schema = tool.get_input_schema()
            if schema:
                return self._create_ollama_tool_from_schema(schema, tool)

            # If we still don't have a schema, use minimal fallback
            _logger.warning(
                f"Could not get schema for tool {tool.name}, using fallback"
            )
            schema = {"type": "object", "properties": {}, "required": []}
            return self._create_ollama_tool_from_schema(schema, tool)

        except Exception as e:
            _logger.error(f"Error formatting tool {tool.name}: {str(e)}")
            # Use minimal fallback schema
            schema = {
                "title": tool.name,
                "description": tool.description,
                "properties": {},
                "required": [],
            }
            return self._create_ollama_tool_from_schema(schema, tool)

    def _create_ollama_tool_from_schema(self, schema, tool):
        """Helper method to create an Ollama tool from a schema

        Args:
            schema: JSON schema dictionary
            tool: llm.tool record

        Returns:
            Dictionary in Ollama tool format
        """
        formatted_tool = {
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description,
                "parameters": {
                    "type": "object",
                    "properties": schema.get("properties", {}),
                    "required": schema.get("required", []),
                },
            },
        }

        return formatted_tool

    def ollama_chat(
        self,
        messages,
        model=None,
        stream=False,
        tools=None,
        system_prompt=None,
        **kwargs,
    ):
        """Send chat messages using Ollama with OpenTelemetry observability"""
        _logger.info(f"ollama_chat called with model={model}, stream={stream}, tools={len(tools) if tools else 0}")
        
        # Use OpenTelemetry observability for all LLM operations
        if _has_base_observability:
            tracer = self._init_opentelemetry_tracing()
            
            if tracer:
                operation_name = "chat_completion"
                
                try:
                    from opentelemetry import context as otel_context
                    from opentelemetry import trace as otel_trace

                    # Start span
                    span = tracer.start_span(f"llm_ollama.{operation_name}")
                    ctx = otel_trace.set_span_in_context(span)
                    token = otel_context.attach(ctx)
                    
                    # Set span attributes
                    span.set_attribute("llm.provider", "ollama")
                    span.set_attribute("llm.operation", operation_name)
                    span.set_attribute("llm.streaming", stream)
                    span.set_attribute("llm.tools_count", len(tools) if tools else 0)
                    span.set_attribute("llm.has_tools", bool(tools))
                    
                    # Add custom attributes
                    trace_attrs = self._get_trace_attributes(operation_name, (messages,),
                                                             {'model': model, 'stream': stream, 'tools': tools, 'system_prompt': system_prompt})
                    for key, value in trace_attrs.items():
                        span.set_attribute(key, value)
                    
                    try:
                        # Execute the actual method with full tracing
                        result = self._ollama_chat_impl(messages, model, stream, tools, system_prompt, **kwargs)
                        
                        # Extract and set metrics from the result
                        metrics = self._extract_metrics(result, operation_name, (messages,),
                                                        {'model': model, 'stream': stream, 'tools': tools})
                        for key, value in metrics.items():
                            if key in ['input_tokens', 'output_tokens', 'total_tokens']:
                                span.set_attribute(f"llm.usage.{key}", value)
                            else:
                                span.set_attribute(key, value)
                        
                        return result
                        
                    except Exception as e:
                        span.record_exception(e)
                        span.set_status(otel_trace.Status(otel_trace.StatusCode.ERROR, str(e)))
                        raise
                    
                    finally:
                        span.end()
                        if token:
                            otel_context.detach(token)
                            
                except Exception as e:
                    _logger.warning(f"Error in OpenTelemetry tracing: {e}, executing without tracing")
                    # Fall back to non-observability execution
                    return self._ollama_chat_impl(messages, model, stream, tools, system_prompt, **kwargs)
            else:
                _logger.debug("OpenTelemetry tracer not available, executing without tracing")
                return self._ollama_chat_impl(messages, model, stream, tools, system_prompt, **kwargs)
        else:
            _logger.debug("Observability not available, executing without tracing")
            return self._ollama_chat_impl(messages, model, stream, tools, system_prompt, **kwargs)
    
    def _ollama_chat_impl(self, messages, model=None, stream=False, tools=None, system_prompt=None, **kwargs):
        """Internal implementation of ollama_chat"""
        model = self.get_model(model, "chat")
        
        params = self._prepare_chat_params(
            model, messages, stream, tools=tools, system_prompt=system_prompt
        )

        response = self.client.chat(**params)

        if not stream:
            return self.ollama_process_non_streaming_response(response)
        else:
            return self.ollama_process_streaming_response(response)

    def ollama_process_non_streaming_response(self, response):
        """Process a non-streaming response from Ollama"""
        message = {
            "role": "assistant",
            "content": response["message"]["content"] or "",  # Handle None content
        }

        if "tool_calls" in response["message"] and response["message"]["tool_calls"]:
            message["tool_calls"] = []

            for tool_call in response["message"]["tool_calls"]:
                tool_name = tool_call["function"]["name"]
                tool_id = OllamaToolCallIdUtils.create_tool_id(
                    tool_name, str(uuid.uuid4())
                )

                tool_call_data = {
                    "id": tool_id,
                    "type": "function",
                    "function": {"name": tool_name, "arguments": ""},
                }

                if "function" in tool_call and "arguments" in tool_call["function"]:
                    arguments = tool_call["function"]["arguments"]
                    if isinstance(arguments, dict):
                        tool_call_data["function"]["arguments"] = json.dumps(arguments)
                    elif isinstance(arguments, str):
                        tool_call_data["function"]["arguments"] = arguments
                    else:
                        try:
                            tool_call_data["function"]["arguments"] = json.dumps(
                                arguments
                            )
                        except (TypeError, ValueError):
                            _logger.warning(
                                f"Could not serialize arguments of type {type(arguments)}"
                            )
                            tool_call_data["function"]["arguments"] = str(arguments)

                message["tool_calls"].append(tool_call_data)

        yield message

    def ollama_process_streaming_response(self, response):
        """
        Processes Ollama stream and yields standardized dicts.
        Yields: {'content': str} OR {'tool_calls': list} OR {'error': str}
        """
        assembled_tool_calls = {}
        final_tool_calls_list = []
        stream_has_tools = False
        is_done = False
        last_content = ""

        try:
            for chunk in response:
                if not chunk:
                    continue

                message = chunk.get("message", {})
                content_chunk = message.get("content")
                tool_calls_chunk = message.get("tool_calls")
                chunk_done = chunk.get("done", False)
                error_msg = chunk.get("error")

                if error_msg:
                    yield {"error": f"Ollama stream error: {error_msg}"}
                    return

                if chunk_done:
                    is_done = True

                if content_chunk is not None and content_chunk != last_content:
                    yield {"content": content_chunk}
                    last_content = content_chunk

                if tool_calls_chunk:
                    stream_has_tools = True
                    for i, tool_call_delta in enumerate(tool_calls_chunk):
                        assembled_tool_calls = self._ollama_update_tool_call_chunk(
                            assembled_tool_calls, tool_call_delta, i
                        )

            if stream_has_tools and is_done:
                for _, call_data in sorted(assembled_tool_calls.items()):
                    if call_data.get("_complete"):
                        tool_name = call_data["function"]["name"]
                        tool_id = OllamaToolCallIdUtils.create_tool_id(
                            tool_name, str(uuid.uuid4())
                        )
                        final_tool_calls_list.append(
                            {
                                "id": tool_id,
                                "type": "function",
                                "function": {
                                    "name": tool_name,
                                    "arguments": call_data["function"]["arguments"],
                                },
                            }
                        )

                if final_tool_calls_list:
                    yield {"tool_calls": final_tool_calls_list}

        except Exception as e:
            _logger.error(f"Error processing Ollama stream: {e}", exc_info=True)
            yield {"error": f"Internal error processing Ollama stream: {e}"}

    def _ollama_update_tool_call_chunk(
        self, assembled_tool_calls, tool_call_delta, index
    ):
        """
        Helper to assemble tool calls from Ollama stream chunks.
        Ensures arguments are stored as a complete JSON string.
        """
        if index not in assembled_tool_calls:
            assembled_tool_calls[index] = {
                "id": None,
                "type": "function",
                "function": {"name": "", "arguments": ""},
                "_complete": False,
            }

        current_call = assembled_tool_calls[index]
        func_delta = tool_call_delta.get("function", {})

        if func_delta.get("name"):
            current_call["function"]["name"] = func_delta["name"]

        if "arguments" in func_delta:
            new_args_part = func_delta["arguments"]
            if isinstance(new_args_part, dict):
                # Pre-process dict values: attempt to parse stringified lists
                processed_args = {}
                for key, value in new_args_part.items():
                    if isinstance(value, str):
                        try:
                            parsed_value = ast.literal_eval(value)
                            if isinstance(parsed_value, list):
                                processed_args[key] = parsed_value
                            else:
                                processed_args[key] = value
                        except (ValueError, SyntaxError):
                            processed_args[key] = value
                    else:
                        processed_args[key] = value
                current_call["function"]["arguments"] = json.dumps(processed_args)
            else:
                _logger.warning(
                    f"Unexpected argument type in Ollama stream chunk: {type(new_args_part)}"
                )

        # Use the common helper to determine completeness for Ollama
        current_call["_complete"] = self._is_tool_call_complete(
            current_call["function"], expected_endings=("]", "}")
        )
        return assembled_tool_calls

    def ollama_embedding(self, texts, model=None):
        """Generate embeddings using Ollama with hybrid observability"""
        _logger.info(f"ollama_embedding called with model={model}")
        
        # Apply observability manually for embeddings
        if _has_base_observability:
            tracer = self._init_opentelemetry_tracing()
            
            if tracer:
                operation_name = "embedding"
                
                try:
                    from opentelemetry import context as otel_context
                    from opentelemetry import trace as otel_trace

                    # Start span
                    span = tracer.start_span(f"llm_ollama.{operation_name}")
                    ctx = otel_trace.set_span_in_context(span)
                    token = otel_context.attach(ctx)
                    
                    # Set span attributes
                    span.set_attribute("llm.provider", "ollama")
                    span.set_attribute("llm.operation", operation_name)
                    
                    # Add custom attributes
                    trace_attrs = self._get_trace_attributes(operation_name, (texts,), {"model": model})
                    for key, value in trace_attrs.items():
                        span.set_attribute(key, value)
                    
                    try:
                        result = self._ollama_embedding_impl(texts, model)
                        
                        # Extract and set metrics
                        metrics = self._extract_metrics(result, operation_name, (texts,), {"model": model})
                        for key, value in metrics.items():
                            span.set_attribute(key, value)
                        
                        return result
                        
                    except Exception as e:
                        span.record_exception(e)
                        span.set_status(otel_trace.Status(otel_trace.StatusCode.ERROR, str(e)))
                        raise
                    
                    finally:
                        span.end()
                        if token:
                            otel_context.detach(token)
                            
                except Exception as e:
                    _logger.debug(f"Error in embedding observability: {e}")
                    return self._ollama_embedding_impl(texts, model)
            else:
                return self._ollama_embedding_impl(texts, model)
        else:
            return self._ollama_embedding_impl(texts, model)
    
    def _ollama_embedding_impl(self, texts, model=None):
        """Internal implementation of ollama_embedding"""
        model = self.get_model(model, "embedding")
        
        # Ensure texts is a list
        if isinstance(texts, str):
            texts_list = [texts]
        else:
            texts_list = texts

        # Get embeddings for each text
        embeddings = []
        for text in texts_list:
            response = self.client.embed(model=model.name, input=[text])
            embeddings.append(response["embeddings"][0])
        return embeddings

    def ollama_models(self, model_id=None):
        """List available Ollama models"""
        if model_id:
            model = self.client.show(model_id)
            yield self._ollama_parse_model(model, model_name=model_id)
        else:
            models_response = self.client.list()
            # Get models from the response
            if hasattr(models_response, "models"):
                models = models_response.models
            else:
                error_msg = f"Unexpected Ollama API response format: {models_response}"
                _logger.error(error_msg)
                raise ValueError(error_msg)

            for model in models:
                yield self._ollama_parse_model(model)

    def _ollama_parse_model(self, model, model_name=None):
        model_name = model_name or model.model

        model_info = {
            "name": model_name,
            "details": {
                "id": model_name,
                "capabilities": ["chat"],  # Default capability
                "modified_at": str(model.modified_at)
                if hasattr(model, "modified_at")
                else None,
                "size": model.size if hasattr(model, "size") else None,
                "digest": model.digest if hasattr(model, "digest") else None,
            },
        }

        # Add embedding capability if model name suggests it
        if "embedding" in model_name.lower():
            model_info["details"]["capabilities"].append("embedding")

        return model_info

    def ollama_format_messages(self, messages, system_prompt=None):
        """Format messages for Ollama API

        Args:
            messages: List of message records
            system_prompt: Optional system prompt to prepend

        Returns:
            List of formatted messages in Ollama format
        """
        # First use the default implementation from the llm_tool module
        formatted_messages = []

        # Add system prompt if provided
        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})

        # Add all other messages, properly formatted
        for message in messages:
            # Handle both dict messages and record messages
            if isinstance(message, dict):
                # Direct dict message, use as-is but validate format
                formatted_msg = message
            else:
                # Record message, use dispatch
                try:
                    formatted_msg = self._dispatch("format_message", record=message)
                except Exception as e:
                    _logger.warning(f"Error formatting message via dispatch: {e}, skipping message")
                    formatted_msg = None
            
            if formatted_msg is not None:
                formatted_messages.append(formatted_msg)

        # Validate and clean messages
        validator = OllamaMessageValidator(formatted_messages)
        return validator.validate_and_clean()

    def _prepare_chat_params(self, model_record, messages, stream, tools=None, system_prompt=None, **kwargs):
        """Prepare parameters for Ollama chat API call"""
        
        # Format messages for Ollama
        formatted_messages = self.ollama_format_messages(messages, system_prompt)
        
        # Build base parameters using model configuration
        params = {
            "model": model_record.name,
            "messages": formatted_messages,
            "stream": stream,
            "options": {
                "temperature": model_record.temperature,
                "num_ctx": model_record.context_window,
                "top_p": model_record.top_p,
                "top_k": model_record.top_k,
                "repeat_penalty": model_record.repeat_penalty,
            }
        }
        
        # Add max_tokens if specified (not all models support this)
        if model_record.max_tokens and model_record.max_tokens > 0:
            params["options"]["num_predict"] = model_record.max_tokens
        
        # Add custom parameters from the legacy parameters text field
        # These can override or add to the dedicated field values
        if model_record.parameters:
            try:
                import json
                custom_params = json.loads(model_record.parameters)
                if isinstance(custom_params, dict):
                    # Update options with custom parameters (custom params take precedence)
                    params["options"].update(custom_params)
                    _logger.info(f"Applied custom parameters from model.parameters field: {custom_params}")
            except (json.JSONDecodeError, ValueError) as e:
                _logger.warning(f"Invalid JSON in model.parameters field: {e}")
        
        # Add tools if provided
        if tools:
            params["tools"] = self.ollama_format_tools(tools)
        
        _logger.info(f"Ollama chat params - model: {model_record.name}, temperature: {model_record.temperature}, "
                    f"context_window: {model_record.context_window}, stream: {stream}")
        
        return params


