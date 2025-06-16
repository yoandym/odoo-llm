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
        """Initialize OpenTelemetry tracing (only once globally)"""
        _logger.info("🔍 Ollama: _init_opentelemetry_tracing called")
        
        phoenix_config = self.env['phoenix.config'].get_active_config()
        if not phoenix_config:
            _logger.info("🔍 Ollama: No Phoenix config found")
            return None
            
        if not phoenix_config.enable_fullstack_tracing:
            _logger.info("🔍 Ollama: Full-stack tracing disabled in config")
            return None
            
        _logger.info(f"🔍 Ollama: Phoenix config found, initializing with endpoint: {phoenix_config.otlp_endpoint}")
            
        try:
            # Try to import OpenTelemetry
            from opentelemetry import trace
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import \
                OTLPSpanExporter
            from opentelemetry.sdk.resources import Resource
            from opentelemetry.sdk.trace import TracerProvider
            from opentelemetry.sdk.trace.export import BatchSpanProcessor

            # Try to use Phoenix-specific ResourceAttributes for PROJECT_NAME
            try:
                from openinference.semconv.resource import ResourceAttributes
                has_phoenix_attributes = True
            except ImportError:
                # Fallback to standard OpenTelemetry ResourceAttributes
                from opentelemetry.semconv.resource import ResourceAttributes
                has_phoenix_attributes = False

            # Check if already initialized
            current_provider = trace.get_tracer_provider()
            if hasattr(current_provider, '_resource') and current_provider._resource:
                _logger.info("🔍 Ollama: OpenTelemetry already initialized, reusing existing provider")
                return trace.get_tracer(
                    instrumenting_module_name='llm_ollama',
                    instrumenting_library_version="1.0.0"
                )

            # Configure resource
            module_name = 'llm_ollama'
            service_name = f"odoo-llm-{module_name}"
            resource_attrs = {
                ResourceAttributes.SERVICE_NAME: service_name,
                ResourceAttributes.SERVICE_VERSION: "1.0.0",
                ResourceAttributes.DEPLOYMENT_ENVIRONMENT: getattr(phoenix_config, 'environment', 'development'),
                ResourceAttributes.SERVICE_NAMESPACE: "odoo-llm",
            }
            
            # Add PROJECT_NAME if Phoenix ResourceAttributes are available
            if has_phoenix_attributes:
                resource_attrs[ResourceAttributes.PROJECT_NAME] = phoenix_config.project_name
            else:
                _logger.warning("🔍 Ollama: Phoenix ResourceAttributes not available, using fallback")
                resource_attrs["project.name"] = phoenix_config.project_name
                
            resource = Resource.create(resource_attrs)
            
            # Set up tracer provider
            provider = TracerProvider(resource=resource)
            
            # Configure OTLP exporter
            otlp_exporter = OTLPSpanExporter(
                endpoint=phoenix_config.otlp_endpoint,
                insecure=True
            )
            
            # Add span processor
            span_processor = BatchSpanProcessor(otlp_exporter)
            provider.add_span_processor(span_processor)
            
            # Set global tracer provider only if not already set
            try:
                trace.set_tracer_provider(provider)
                _logger.info(f"🔍 Ollama: Initialized TracerProvider: {type(provider)}")
            except Exception as set_error:
                _logger.warning(f"🔍 Ollama: TracerProvider already set: {set_error}")
            
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
    
    def _force_flush_spans(self):
        """Force flush spans to ensure they are exported immediately"""
        try:
            from opentelemetry import trace
            from opentelemetry.sdk.trace import TracerProvider
            
            tracer_provider = trace.get_tracer_provider()
            _logger.info(f"🔍 Ollama: Tracer provider type: {type(tracer_provider)}")
            
            # Try different methods to force flush
            if hasattr(tracer_provider, 'force_flush'):
                _logger.info("🔍 Ollama: Force flushing spans via tracer provider...")
                result = tracer_provider.force_flush()
                _logger.info(f"🔍 Ollama: Spans force flushed successfully via tracer provider: {result}")
            elif isinstance(tracer_provider, TracerProvider):
                # It's our TracerProvider, try to access span processors directly
                _logger.info("🔍 Ollama: Trying to access span processors on TracerProvider...")
                try:
                    # Try to force flush all span processors
                    for processor in tracer_provider._span_processors:
                        if hasattr(processor, 'force_flush'):
                            _logger.info(f"🔍 Ollama: Force flushing processor: {type(processor)}")
                            processor.force_flush()
                    _logger.info("🔍 Ollama: All span processors force flushed successfully")
                except Exception as e:
                    _logger.warning(f"🔍 Ollama: Error accessing span processors: {e}")
            else:
                _logger.warning("🔍 Ollama: No force_flush method available - using ProxyTracerProvider")
                
        except Exception as e:
            _logger.warning(f"🔍 Ollama: Error force flushing spans: {e}")
            import traceback
            _logger.warning(f"🔍 Ollama: Traceback: {traceback.format_exc()}")
    
    def _extract_metrics(self, result, operation_name, args, kwargs):
        """Extract metrics for observability"""
        # Add Ollama-specific metrics extraction here
        metrics = {}
        
        try:
            if operation_name == "chat_completion":
                # Handle streaming vs non-streaming responses
                is_streaming = kwargs.get('stream', False)
                
                if is_streaming and hasattr(result, '__iter__'):
                    # For streaming, we can't get the full response content yet
                    # But we can extract input information
                    _logger.info("🔍 Ollama: Handling streaming response")
                    
                    # Add input data from args (messages)
                    if len(args) > 0 and isinstance(args[0], list):
                        messages = args[0]
                        input_text = ""
                        user_messages = []
                        
                        for msg in messages:
                            if isinstance(msg, dict):
                                if 'content' in msg:
                                    input_text += msg['content']
                                    if msg.get('role') == 'user':
                                        user_messages.append(msg['content'])
                        
                        if input_text:
                            metrics['llm.usage.input_tokens'] = len(input_text) // 4
                        
                        if user_messages:
                            metrics['llm.request.user_messages'] = str(user_messages[-3:])  # Last 3 user messages
                        
                        # Message count and conversation info
                        metrics['llm.messages.count'] = len(messages)
                        
                        # Count by role
                        role_counts = {}
                        for msg in messages:
                            if isinstance(msg, dict) and 'role' in msg:
                                role = msg['role']
                                role_counts[role] = role_counts.get(role, 0) + 1
                        
                        for role, count in role_counts.items():
                            metrics[f'llm.messages.{role}_count'] = count
                        
                        # Conversation length
                        conversation_length = sum(len(str(msg.get('content', ''))) for msg in messages if isinstance(msg, dict))
                        metrics['llm.conversation.total_length'] = conversation_length
                    
                    # Note: For streaming, we can't capture output content/tokens here
                    # This would need to be done in a separate callback when the stream completes
                    
                elif isinstance(result, dict) and 'message' in result:
                    # Non-streaming response
                    _logger.info("🔍 Ollama: Handling non-streaming response")
                    content = result['message'].get('content', '')
                    if content:
                        metrics['llm.usage.output_tokens'] = len(content) // 4  # Rough estimation
                        metrics['llm.response.content'] = content[:500]  # First 500 chars
                    
                    # Check for tool calls
                    message = result['message']
                    if message.get('tool_calls'):
                        tool_calls = []
                        for tool_call in message['tool_calls']:
                            if isinstance(tool_call, dict):
                                tool_calls.append({
                                    'name': tool_call.get('function', {}).get('name', 'unknown'),
                                    'args': str(tool_call.get('function', {}).get('arguments', ''))[:200]
                                })
                        metrics['llm.response.tool_calls'] = str(tool_calls)
                    
                    # Add input data (same as streaming)
                    if len(args) > 0 and isinstance(args[0], list):
                        messages = args[0]
                        input_text = ""
                        user_messages = []
                        
                        for msg in messages:
                            if isinstance(msg, dict):
                                if 'content' in msg:
                                    input_text += msg['content']
                                    if msg.get('role') == 'user':
                                        user_messages.append(msg['content'])
                        
                        if input_text:
                            metrics['llm.usage.input_tokens'] = len(input_text) // 4
                        
                        if user_messages:
                            metrics['llm.request.user_messages'] = str(user_messages[-3:])
                    
                    # Calculate total tokens
                    if 'llm.usage.input_tokens' in metrics and 'llm.usage.output_tokens' in metrics:
                        metrics['llm.usage.total_tokens'] = metrics['llm.usage.input_tokens'] + metrics['llm.usage.output_tokens']
                
                # Add tool information (works for both streaming and non-streaming)
                if kwargs.get('tools'):
                    _logger.info(f"🔍 Ollama: Tools found: {type(kwargs['tools'])}, length: {len(kwargs['tools'])}")
                    tools_info = []
                    for i, tool in enumerate(kwargs['tools']):
                        _logger.info(f"🔍 Ollama: Tool {i}: {type(tool)}, keys: {list(tool.keys()) if isinstance(tool, dict) else 'not dict'}")
                        if isinstance(tool, dict) and 'function' in tool:
                            tool_name = tool['function'].get('name', 'unknown')
                            tools_info.append(tool_name)
                        elif hasattr(tool, 'name'):
                            # Handle Odoo tool objects
                            tools_info.append(str(tool.name))
                        else:
                            tools_info.append(str(tool))
                    metrics['llm.tools.available'] = str(tools_info)
                    _logger.info(f"🔍 Ollama: Extracted tools: {tools_info}")
                else:
                    _logger.info("🔍 Ollama: No tools found in kwargs")
                        
            elif operation_name == "embedding":
                if isinstance(result, list):
                    metrics['llm.embeddings.count'] = len(result)
                    if result and isinstance(result[0], list):
                        metrics['llm.embeddings.dimension'] = len(result[0])
                        
                # Add input text for embedding
                if len(args) > 0:
                    input_texts = args[0] if isinstance(args[0], list) else [args[0]]
                    metrics['llm.request.texts'] = str(input_texts[:3])  # First 3 texts
                        
        except Exception as e:
            _logger.warning(f"Error extracting Ollama metrics: {e}")
            import traceback
            _logger.warning(f"Traceback: {traceback.format_exc()}")
        
        return metrics
    
    def _get_trace_attributes(self, operation_name, args, kwargs):
        """Get trace attributes for observability"""
        attributes = {}
        
        try:
            # Add Ollama-specific attributes
            attributes['llm.provider.type'] = 'ollama'
            attributes['llm.operation'] = operation_name
            
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
                # Tools information
                if kwargs.get('tools'):
                    attributes['ollama.tools.enabled'] = True
                    attributes['llm.tools.count'] = len(kwargs['tools'])
                    
                    # Tool names
                    tool_names = []
                    for tool in kwargs['tools']:
                        if isinstance(tool, dict) and 'function' in tool:
                            tool_names.append(tool['function'].get('name', 'unknown'))
                    attributes['llm.tools.names'] = str(tool_names)
                
                attributes['ollama.streaming'] = kwargs.get('stream', False)
                attributes['llm.streaming'] = kwargs.get('stream', False)
                
                if kwargs.get('system_prompt'):
                    attributes['ollama.system_prompt.length'] = len(kwargs['system_prompt'])
                    attributes['llm.system_prompt'] = kwargs['system_prompt'][:200]  # First 200 chars
                
                # Message count and conversation length
                if len(args) > 0 and isinstance(args[0], list):
                    messages = args[0]
                    attributes['llm.messages.count'] = len(messages)
                    
                    # Count by role
                    role_counts = {}
                    for msg in messages:
                        if isinstance(msg, dict) and 'role' in msg:
                            role = msg['role']
                            role_counts[role] = role_counts.get(role, 0) + 1
                    
                    for role, count in role_counts.items():
                        attributes[f'llm.messages.{role}_count'] = count
                    
                    # Add conversation summary
                    conversation_length = sum(len(str(msg.get('content', ''))) for msg in messages if isinstance(msg, dict))
                    attributes['llm.conversation.total_length'] = conversation_length
                    
            elif operation_name == "embedding":
                # Embedding-specific attributes
                if len(args) > 0:
                    texts = args[0] if isinstance(args[0], list) else [args[0]]
                    attributes['llm.embeddings.input_count'] = len(texts)
                    total_chars = sum(len(str(text)) for text in texts)
                    attributes['llm.embeddings.total_chars'] = total_chars
                    
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
        """Send chat messages using Ollama with OpenTelemetry observability and nested spans"""
        _logger.info(f"ollama_chat called with model={model}, stream={stream}, tools={len(tools) if tools else 0}")
        
        # Use OpenTelemetry observability for all LLM operations
        if _has_base_observability:
            _logger.info("🔍 Ollama: Base observability available, initializing tracing")
            tracer = self._init_opentelemetry_tracing()
            
            if tracer:
                _logger.info("🔍 Ollama: Tracer obtained, creating nested spans")
                operation_name = "chat_completion"
                
                try:
                    from opentelemetry import context as otel_context
                    from opentelemetry import trace as otel_trace
                    from opentelemetry.trace import SpanKind

                    # Start main LLM operation span (Parent span for the entire conversation)
                    with tracer.start_as_current_span(
                        name="llm.chat_completion",
                        kind=SpanKind.CLIENT
                    ) as parent_span:
                        
                        # Set OpenTelemetry LLM semantic convention attributes on parent span
                        parent_span.set_attribute("llm.system", "ollama")
                        parent_span.set_attribute("llm.request.type", "completion")
                        parent_span.set_attribute("llm.request.model", str(model))
                        parent_span.set_attribute("llm.streaming", stream)
                        parent_span.set_attribute("llm.tools_count", len(tools) if tools else 0)
                        
                        # Add user input attributes
                        if messages:
                            parent_span.set_attribute("llm.input.messages_count", len(messages))
                            # Add user message content (truncated)
                            user_messages = [msg for msg in messages if isinstance(msg, dict) and msg.get('role') == 'user']
                            if user_messages:
                                last_user_msg = user_messages[-1].get('content', '')
                                parent_span.set_attribute("llm.user_input", str(last_user_msg)[:500])
                        
                        parent_span.add_event("llm.request.start")
                        
                        # Create nested span for model execution
                        with tracer.start_as_current_span("llm.model.execution") as execution_span:
                            execution_span.set_attribute("llm.model", str(model))
                            execution_span.set_attribute("llm.operation", "chat")
                            
                            try:
                                # Execute the actual method with full tracing
                                _logger.info("🔍 Ollama: Executing LLM operation with nested spans")
                                result = self._ollama_chat_impl(messages, model, stream, tools, system_prompt, **kwargs)
                                
                                # Handle streaming vs non-streaming responses with nested spans
                                if stream:
                                    # For streaming, create a wrapper generator that handles tracing
                                    def traced_generator():
                                        chunk_count = 0
                                        try:
                                            for chunk in result:
                                                chunk_count += 1
                                                
                                                # Create completion span for significant chunks
                                                if isinstance(chunk, dict) and ('content' in chunk or 'tool_calls' in chunk):
                                                    with tracer.start_as_current_span("llm.chunk.completion") as completion_span:
                                                        completion_span.set_attribute("llm.streaming", True)
                                                        completion_span.set_attribute("chunk.number", chunk_count)
                                                        
                                                        # Handle tool calls in streaming response
                                                        if 'tool_calls' in chunk:
                                                            tool_calls = chunk['tool_calls']
                                                            completion_span.add_event("llm.tool.calls")
                                                            completion_span.set_attribute("llm.response.tool_calls", len(tool_calls))
                                                            parent_span.set_attribute("llm.response.tool_calls", len(tool_calls))
                                                            
                                                            # Create nested spans for each tool call
                                                            for i, tool_call in enumerate(tool_calls):
                                                                if isinstance(tool_call, dict) and 'function' in tool_call:
                                                                    tool_name = tool_call['function'].get('name', f'tool_{i}')
                                                                    
                                                                    with tracer.start_as_current_span(f"llm.tool.call.{tool_name}") as tool_span:
                                                                        tool_span.set_attribute("tool.name", tool_name)
                                                                        tool_span.set_attribute("tool.call_id", tool_call.get('id', f'call_{i}'))
                                                                        tool_span.set_attribute("tool.streaming", True)
                                                                        
                                                                        # Tool arguments
                                                                        if 'arguments' in tool_call['function']:
                                                                            args = tool_call['function']['arguments']
                                                                            tool_span.set_attribute("tool.arguments", str(args)[:500])
                                                                        
                                                                        tool_span.add_event("tool.call.requested")
                                                
                                                yield chunk
                                            
                                            # Final streaming metrics
                                            execution_span.set_attribute("llm.streaming.chunks_total", chunk_count)
                                            parent_span.set_attribute("llm.streaming.chunks_total", chunk_count)
                                        
                                        except Exception as e:
                                            execution_span.record_exception(e)
                                            execution_span.set_status(otel_trace.Status(otel_trace.StatusCode.ERROR, str(e)))
                                            parent_span.record_exception(e)
                                            parent_span.set_status(otel_trace.Status(otel_trace.StatusCode.ERROR, str(e)))
                                            raise
                                        
                                        finally:
                                            # Extract final metrics for streaming
                                            try:
                                                metrics = self._extract_metrics({'streaming': True}, operation_name, (messages,),
                                                                               {'model': model, 'stream': stream, 'tools': tools})
                                                for key, value in metrics.items():
                                                    execution_span.set_attribute(key, value)
                                                    parent_span.set_attribute(key, value)
                                            except Exception as e:
                                                _logger.error(f"🔍 Ollama: Error extracting streaming metrics: {e}")
                                    
                                    return traced_generator()
                                else:
                                    # For non-streaming responses, extract metrics immediately
                                    metrics = self._extract_metrics(result, operation_name, (messages,),
                                                                    {'model': model, 'stream': stream, 'tools': tools})
                                    for key, value in metrics.items():
                                        execution_span.set_attribute(key, value)
                                        parent_span.set_attribute(key, value)
                                    
                                    # Create completion span for non-streaming response
                                    with tracer.start_as_current_span("llm.response.completion") as completion_span:
                                        completion_span.set_attribute("llm.streaming", False)
                                        
                                        if isinstance(result, dict) and 'message' in result:
                                            completion_span.add_event("llm.content.completion")
                                            
                                            message = result['message']
                                            content = message.get('content', '')
                                            if content:
                                                completion_span.set_attribute("output.value", content[:2000])
                                                completion_span.set_attribute("llm.response.model", str(model))
                                                parent_span.set_attribute("llm.response.content_length", len(content))
                                            
                                            # Handle tool calls for non-streaming with nested spans
                                            if message.get('tool_calls'):
                                                tool_calls = message['tool_calls']
                                                completion_span.add_event("llm.tool.calls")
                                                completion_span.set_attribute("llm.response.tool_calls", len(tool_calls))
                                                parent_span.set_attribute("llm.response.tool_calls", len(tool_calls))
                                                
                                                # Create nested spans for each tool call
                                                for i, tool_call in enumerate(tool_calls):
                                                    if isinstance(tool_call, dict) and 'function' in tool_call:
                                                        tool_name = tool_call['function'].get('name', f'tool_{i}')
                                                        
                                                        with tracer.start_as_current_span(f"llm.tool.call.{tool_name}") as tool_span:
                                                            tool_span.set_attribute("tool.name", tool_name)
                                                            tool_span.set_attribute("tool.call_id", tool_call.get('id', f'call_{i}'))
                                                            tool_span.set_attribute("tool.streaming", False)
                                                            
                                                            # Tool arguments
                                                            if 'arguments' in tool_call['function']:
                                                                args = tool_call['function']['arguments']
                                                                tool_span.set_attribute("tool.arguments", str(args)[:500])
                                                            
                                                            tool_span.add_event("tool.call.requested")
                                        
                                        parent_span.add_event("llm.response.complete")
                                    
                                    return result
                            
                            except Exception as e:
                                execution_span.record_exception(e)
                                execution_span.set_status(otel_trace.Status(otel_trace.StatusCode.ERROR, str(e)))
                                parent_span.record_exception(e)
                                parent_span.set_status(otel_trace.Status(otel_trace.StatusCode.ERROR, str(e)))
                                raise
                                
                            finally:
                                # Force flush spans to ensure they are exported immediately
                                self._force_flush_spans()
                                
                except Exception as e:
                    _logger.warning(f"Error in OpenTelemetry tracing: {e}, executing without tracing")
                    return self._ollama_chat_impl(messages, model, stream, tools, system_prompt, **kwargs)
            else:
                _logger.info("🔍 Ollama: No tracer available, falling back to non-observability execution")
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
                        # Force flush to ensure spans are exported immediately
                        self._force_flush_spans()
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


