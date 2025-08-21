import ast
import json
import logging
import uuid

import ollama
from odoo import api, models, tools

from ..utils.ollama_message_validator import OllamaMessageValidator
from ..utils.ollama_tool_call_id_utils import OllamaToolCallIdUtils

_logger = logging.getLogger(__name__)

# Optional observability support
try:
    from llm_observability.models.mixins.base_observability_mixin import BaseObservabilityMixin

    _has_base_observability = True
except ImportError:
    # Create a no-op base class if observability is not available
    class BaseObservabilityMixin:
        def _has_observability(self):
            return False

        def _get_phoenix_config(self):
            return None

        def _init_opentelemetry_tracing(self):
            return None

        @staticmethod
        def with_observability(operation_name, extract_model_name=None):
            def decorator(func):
                return func  # No-op decorator

            return decorator

        def _extract_metrics(self, result, operation_name, args, kwargs):
            return {}

        def _get_trace_attributes(self, operation_name, args, kwargs):
            return {}

    _has_base_observability = False


class LLMProvider(models.Model):
    _inherit = "llm.provider"

    # Add observability methods if available
    if _has_base_observability:

        def _has_observability(self):
            return BaseObservabilityMixin._has_observability(self)

        def _get_phoenix_config(self):
            return BaseObservabilityMixin._get_phoenix_config(self)

        def _init_opentelemetry_tracing(self):
            return BaseObservabilityMixin._init_opentelemetry_tracing(self)

    def _extract_metrics(self, result, operation_name, args, kwargs):
        """Extract Ollama-specific metrics for observability"""
        metrics = {}

        if not _has_base_observability:
            return metrics

        try:
            if operation_name == "chat_completion":
                # Handle streaming vs non-streaming responses
                is_streaming = kwargs.get("stream", False)

                if is_streaming and hasattr(result, "__iter__"):
                    # For streaming, we can't get the full response content yet
                    # But we can extract input information
                    _logger.debug("🔍 Ollama: Handling streaming response")

                    # Add input data from args (messages)
                    if len(args) > 0 and isinstance(args[0], list):
                        messages = args[0]
                        input_text = ""
                        user_messages = []

                        for msg in messages:
                            if isinstance(msg, dict):
                                if "content" in msg:
                                    input_text += msg["content"]
                                    if msg.get("role") == "user":
                                        user_messages.append(msg["content"])
                                        user_messages.append(msg["content"])

                        if input_text:
                            metrics["llm.usage.input_tokens"] = len(input_text) // 4

                        if user_messages:
                            metrics["llm.request.user_messages"] = str(user_messages[-3:])  # Last 3 user messages

                        # Message count and conversation info
                        metrics["llm.messages.count"] = len(messages)

                        # Count by role
                        role_counts = {}
                        for msg in messages:
                            if isinstance(msg, dict) and "role" in msg:
                                role = msg["role"]
                                role_counts[role] = role_counts.get(role, 0) + 1

                        for role, count in role_counts.items():
                            metrics[f"llm.messages.{role}_count"] = count

                        # Conversation length
                        conversation_length = sum(len(str(msg.get("content", ""))) for msg in messages if isinstance(msg, dict))
                        metrics["llm.conversation.total_length"] = conversation_length

                    # Note: For streaming, we can't capture output content/tokens here
                    # This would need to be done in a separate callback when the stream completes

                elif isinstance(result, dict) and "message" in result:
                    # Non-streaming response
                    _logger.info("🔍 Ollama: Handling non-streaming response")
                    content = result["message"].get("content", "")
                    if content:
                        metrics["llm.usage.output_tokens"] = len(content) // 4  # Rough estimation
                        metrics["llm.response.content"] = content[:500]  # First 500 chars

                    # Check for tool calls
                    message = result["message"]
                    if message.get("tool_calls"):
                        tool_calls = []
                        for tool_call in message["tool_calls"]:
                            if isinstance(tool_call, dict):
                                tool_calls.append(
                                    {
                                        "name": tool_call.get("function", {}).get("name", "unknown"),
                                        "args": str(tool_call.get("function", {}).get("arguments", ""))[:200],
                                    }
                                )
                        metrics["llm.response.tool_calls"] = str(tool_calls)

                    # Add input data (same as streaming)
                    if len(args) > 0 and isinstance(args[0], list):
                        messages = args[0]
                        input_text = ""
                        user_messages = []

                        for msg in messages:
                            if isinstance(msg, dict):
                                if "content" in msg:
                                    input_text += msg["content"]
                                    if msg.get("role") == "user":
                                        user_messages.append(msg["content"])

                        if input_text:
                            metrics["llm.usage.input_tokens"] = len(input_text) // 4

                        if user_messages:
                            metrics["llm.request.user_messages"] = str(user_messages[-3:])

                    # Calculate total tokens
                    if "llm.usage.input_tokens" in metrics and "llm.usage.output_tokens" in metrics:
                        metrics["llm.usage.total_tokens"] = metrics["llm.usage.input_tokens"] + metrics["llm.usage.output_tokens"]

                # Add tool information (works for both streaming and non-streaming)
                if kwargs.get("tools"):
                    _logger.info(f"🔍 Ollama: Tools found: {type(kwargs['tools'])}, length: {len(kwargs['tools'])}")
                    tools_info = []
                    for i, tool in enumerate(kwargs["tools"]):
                        _logger.info(f"🔍 Ollama: Tool {i}: {type(tool)}, keys: {list(tool.keys()) if isinstance(tool, dict) else 'not dict'}")
                        if isinstance(tool, dict) and "function" in tool:
                            tool_name = tool["function"].get("name", "unknown")
                            tools_info.append(tool_name)
                        elif hasattr(tool, "name"):
                            # Handle Odoo tool objects
                            tools_info.append(str(tool.name))
                        else:
                            tools_info.append(str(tool))
                    metrics["llm.tools.available"] = str(tools_info)
                    _logger.info(f"🔍 Ollama: Extracted tools: {tools_info}")
                else:
                    _logger.info("🔍 Ollama: No tools found in kwargs")

            elif operation_name == "embedding":
                if isinstance(result, list):
                    metrics["llm.embeddings.count"] = len(result)
                    if result and isinstance(result[0], list):
                        metrics["llm.embeddings.dimension"] = len(result[0])

                # Add input text for embedding
                if len(args) > 0:
                    input_texts = args[0] if isinstance(args[0], list) else [args[0]]
                    metrics["llm.request.texts"] = str(input_texts[:3])  # First 3 texts

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
            attributes["llm.provider.type"] = "ollama"
            attributes["llm.operation"] = operation_name

            # Extract model information
            model = kwargs.get("model")
            if not model and len(args) > 1:
                model = args[1]

            if model:
                model_name = str(model.name if hasattr(model, "name") else model)
                attributes["ollama.model.full_name"] = model_name
                attributes["llm.model"] = model_name

                # Detect model family
                model_lower = model_name.lower()
                if "llama" in model_lower:
                    attributes["ollama.model.family"] = "llama"
                elif "mistral" in model_lower:
                    attributes["ollama.model.family"] = "mistral"
                elif "qwen" in model_lower:
                    attributes["ollama.model.family"] = "qwen"
                elif "deepseek" in model_lower:
                    attributes["ollama.model.family"] = "deepseek"
                else:
                    attributes["ollama.model.family"] = "other"

            # Add operation-specific attributes
            if operation_name == "chat_completion":
                # Tools information
                if kwargs.get("tools"):
                    attributes["ollama.tools.enabled"] = True
                    attributes["llm.tools.count"] = len(kwargs["tools"])

                    # Tool names
                    tool_names = []
                    for tool in kwargs["tools"]:
                        if isinstance(tool, dict) and "function" in tool:
                            tool_names.append(tool["function"].get("name", "unknown"))
                    attributes["llm.tools.names"] = str(tool_names)

                attributes["ollama.streaming"] = kwargs.get("stream", False)
                attributes["llm.streaming"] = kwargs.get("stream", False)

                if kwargs.get("system_prompt"):
                    attributes["ollama.system_prompt.length"] = len(kwargs["system_prompt"])
                    attributes["llm.system_prompt"] = kwargs["system_prompt"][:200]  # First 200 chars

                # Message count and conversation length
                if len(args) > 0 and isinstance(args[0], list):
                    messages = args[0]
                    attributes["llm.messages.count"] = len(messages)

                    # Count by role
                    role_counts = {}
                    for msg in messages:
                        if isinstance(msg, dict) and "role" in msg:
                            role = msg["role"]
                            role_counts[role] = role_counts.get(role, 0) + 1

                    for role, count in role_counts.items():
                        attributes[f"llm.messages.{role}_count"] = count

                    # Add conversation summary
                    conversation_length = sum(len(str(msg.get("content", ""))) for msg in messages if isinstance(msg, dict))
                    attributes["llm.conversation.total_length"] = conversation_length

            elif operation_name == "embedding":
                # Embedding-specific attributes
                if len(args) > 0:
                    texts = args[0] if isinstance(args[0], list) else [args[0]]
                    attributes["llm.embeddings.input_count"] = len(texts)
                    total_chars = sum(len(str(text)) for text in texts)
                    attributes["llm.embeddings.total_chars"] = total_chars

        except Exception as e:
            _logger.debug(f"Error getting Ollama trace attributes: {e}")

        return attributes

    @api.model
    def _get_available_services(self):
        services = super()._get_available_services()
        return services + [("ollama", "Ollama")]

    def ollama_get_client(self):
        """Get Ollama client instance with optional Bearer authentication"""
        client_kwargs = {"host": self.api_base or "http://localhost:11434"}

        # Add Bearer token authentication if api_key is configured
        if self.api_key:
            client_kwargs["headers"] = {"Authorization": f"Bearer {self.api_key}"}

        return ollama.Client(**client_kwargs)

    @property
    def client(self):
        """Property to access the Ollama client"""
        return self.ollama_get_client()

    # Ollama specific implementation
    def ollama_format_tools(self, tools):
        """Format tools for Ollama"""
        return [self._ollama_format_tool(tool) for tool in tools]

    @tools.ormcache("tool.id", "tool.write_date")
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
                schema = json.loads(tool.input_schema)
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

        # Apply observability if available
        if _has_base_observability and hasattr(self, "_init_opentelemetry_tracing"):
            try:
                tracer = self._init_opentelemetry_tracing()

                if tracer:
                    from opentelemetry import context as otel_context
                    from opentelemetry import trace as otel_trace

                    # Start span
                    span = tracer.start_span("llm.chat_completion")
                    ctx = otel_trace.set_span_in_context(span)
                    token = otel_context.attach(ctx)

                    try:
                        # Set span attributes
                        span.set_attribute("llm.provider", "ollama")
                        span.set_attribute("llm.operation", "chat_completion")
                        if model:
                            span.set_attribute("llm.model", str(model))

                        # Execute the operation
                        result = self._ollama_chat_impl(messages, model, stream, tools, system_prompt, **kwargs)

                        # Extract metrics
                        metrics = self._extract_metrics(result, "chat_completion", (messages,), {"model": model, "stream": stream, "tools": tools})
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
                else:
                    return self._ollama_chat_impl(messages, model, stream, tools, system_prompt, **kwargs)
            except Exception as e:
                _logger.debug(f"Error in observability: {e}")
                return self._ollama_chat_impl(messages, model, stream, tools, system_prompt, **kwargs)
        else:
            return self._ollama_chat_impl(messages, model, stream, tools, system_prompt, **kwargs)

    def _ollama_chat_impl(self, messages, model=None, stream=False, tools=None, system_prompt=None, prepend_messages=None, **kwargs):
        """Internal implementation of ollama_chat"""
        model = self.get_model(model, "chat")

        params = self._prepare_chat_params(model, messages, stream, tools=tools, system_prompt=system_prompt, prepend_messages=prepend_messages)

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
                tool_id = OllamaToolCallIdUtils.create_tool_id(tool_name, str(uuid.uuid4()))

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
                            tool_call_data["function"]["arguments"] = json.dumps(arguments)
                        except (TypeError, ValueError):
                            _logger.warning(f"Could not serialize arguments of type {type(arguments)}")
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
                        assembled_tool_calls = self._ollama_update_tool_call_chunk(assembled_tool_calls, tool_call_delta, i)

            if stream_has_tools and is_done:
                for _, call_data in sorted(assembled_tool_calls.items()):
                    if call_data.get("_complete"):
                        tool_name = call_data["function"]["name"]
                        tool_id = OllamaToolCallIdUtils.create_tool_id(tool_name, str(uuid.uuid4()))
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

    def _ollama_update_tool_call_chunk(self, assembled_tool_calls, tool_call_delta, index):
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
                _logger.warning(f"Unexpected argument type in Ollama stream chunk: {type(new_args_part)}")

        # Use the common helper to determine completeness for Ollama
        current_call["_complete"] = self._is_tool_call_complete(current_call["function"], expected_endings=("]", "}"))
        return assembled_tool_calls

    def ollama_embedding(self, texts, model=None):
        """Generate embeddings using Ollama with optional observability"""
        _logger.info(f"ollama_embedding called with model={model}")

        # Apply observability if available
        if _has_base_observability and hasattr(self, "_init_opentelemetry_tracing"):
            try:
                tracer = self._init_opentelemetry_tracing()

                if tracer:
                    from opentelemetry import context as otel_context
                    from opentelemetry import trace as otel_trace

                    # Start span
                    span = tracer.start_span("llm.embedding")
                    ctx = otel_trace.set_span_in_context(span)
                    token = otel_context.attach(ctx)

                    try:
                        # Set span attributes
                        span.set_attribute("llm.provider", "ollama")
                        span.set_attribute("llm.operation", "embedding")
                        if model:
                            span.set_attribute("llm.model", str(model))

                        # Execute the operation
                        result = self._ollama_embedding_impl(texts, model)

                        # Extract metrics
                        metrics = self._extract_metrics(result, "embedding", (texts,), {"model": model})
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
                else:
                    return self._ollama_embedding_impl(texts, model)
            except Exception as e:
                _logger.debug(f"Error in observability: {e}")
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
        """
        Parse an Ollama model into a format that can be stored in llm.model.
        This function needs to return simple, flat, JSON-serializable data structures.
        """
        model_name = model_name or model.model
        _logger.info(f"Ollama model parse for '{model_name}': ")

        # Simple list of capabilities for this model
        capabilities = ["chat"]
        if "embedding" in model_name.lower():
            capabilities.append("embedding")

        # Create a flat, simple details dictionary with only simple values
        details = {
            "id": model_name,
            "capabilities": capabilities,
            "modified_at": str(getattr(model, "modified_at", None)),
            "size": getattr(model, "size", None),
            "digest": getattr(model, "digest", None),
        }

        # Create model info with only simple values
        model_info = {"name": model_name, "provider": "ollama", "model_details": details, "parameters": {}}

        # Log the JSON-serialized versions to verify they're properly formatted
        details_json = json.dumps(details)
        model_info_json = json.dumps(model_info)

        _logger.info(f"details_json={details_json} ")
        _logger.info(f"model_info_json={model_info_json} ")

        # Return a simple structure with all values properly serialized
        return {
            "name": model_name,
            "details": details,
            "model_info": model_info,
        }

    def _determine_model_family(self, model_name):
        """Determine the model family based on the name"""
        model_lower = model_name.lower()
        if "llama" in model_lower:
            return "llama"
        elif "mistral" in model_lower:
            return "mistral"
        elif "qwen" in model_lower:
            return "qwen"
        elif "phi" in model_lower:
            return "phi"
        elif "gemma" in model_lower:
            return "gemma"
        elif "deepseek" in model_lower:
            return "deepseek"
        else:
            return "unknown"

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
