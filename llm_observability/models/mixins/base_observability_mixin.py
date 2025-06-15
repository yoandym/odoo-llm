import logging
from functools import wraps
from typing import Any, Dict, Optional

_logger = logging.getLogger(__name__)


class BaseObservabilityMixin:
    """Base observability functionality that sends traces only to Phoenix
    
    This mixin provides OpenTelemetry integration for sending traces directly
    to Phoenix without storing them in the Odoo database.
    
    This mixin should be used by classes that inherit from models.Model.
    """
    
    def _has_observability(self) -> bool:
        """Check if observability module is available and configured"""
        try:
            if not hasattr(self, 'env'):
                return False
            self.env['phoenix.config']  # type: ignore
            return True
        except KeyError:
            return False
    
    def _get_phoenix_config(self) -> Optional[Any]:
        """Get active Phoenix configuration if available"""
        if not self._has_observability():
            return None
        
        try:
            return self.env['phoenix.config'].get_active_config()  # type: ignore
        except Exception as e:
            _logger.debug(f"Could not get Phoenix config: {e}")
            return None
    
    def _init_opentelemetry_tracing(self) -> Optional[Any]:
        """Initialize OpenTelemetry tracing if available
        
        Returns:
            tracer instance or None
        """
        phoenix_config = self._get_phoenix_config()
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
            if isinstance(current_tracer, TracerProvider):
                # Already configured, just get a tracer
                module_name = str(getattr(self, '_name', 'llm_provider'))
                return trace.get_tracer(
                    instrumenting_module_name=module_name,
                    instrumenting_library_version="1.0.0"
                )
            
            # Configure resource
            module_name = str(getattr(self, '_name', 'provider'))
            service_name = f"odoo-llm-{module_name}"
            resource = Resource.create({
                "service.name": service_name,
                "service.version": "1.0.0",
                "deployment.environment": phoenix_config.environment,
                "service.namespace": "odoo-llm",
            })
            
            # Set up tracer provider
            provider = TracerProvider(resource=resource)
            trace.set_tracer_provider(provider)
            
            # Configure OTLP exporter
            otlp_exporter = OTLPSpanExporter(
                endpoint=phoenix_config.otlp_endpoint,
                insecure=True  # TODO: Make this configurable for production
            )
            
            # Add span processor with sampling
            span_processor = BatchSpanProcessor(otlp_exporter)
            provider.add_span_processor(span_processor)
            
            return trace.get_tracer(
                instrumenting_module_name=module_name,
                instrumenting_library_version="1.0.0"
            )
            
        except ImportError:
            _logger.debug("OpenTelemetry not available, skipping tracing initialization")
            return None
        except Exception as e:
            _logger.debug(f"Could not initialize OpenTelemetry: {e}")
            return None
    
    @staticmethod
    def with_observability(operation_name, extract_model_name=None):
        """Decorator to add observability to LLM provider methods
        
        Args:
            operation_name: Name of the operation for tracing
            extract_model_name: Optional function to extract model name from args/kwargs
                               Signature: (args, kwargs) -> model_name
        
        Usage:
            @BaseObservabilityMixin.with_observability("chat_completion")
            def ollama_chat(self, messages, model=None, **kwargs):
                ...
        """
        def decorator(func):
            @wraps(func)
            def wrapper(self, *args, **kwargs):
                # Extract model name
                if extract_model_name:
                    model_name = extract_model_name(args, kwargs)
                else:
                    # Default extraction logic
                    model_name = kwargs.get('model')
                    if not model_name and len(args) > 1:
                        model_name = args[1]
                
                # Handle model objects
                if model_name and hasattr(model_name, 'name'):
                    model_name = model_name.name
                
                # Get provider-specific module name
                module_name = getattr(self, '_name', 'unknown')
                if hasattr(self, 'service'):
                    module_name = f"llm_{self.service}"
                
                # Initialize OpenTelemetry
                tracer = None
                span = None
                token = None
                
                if hasattr(self, '_init_opentelemetry_tracing'):
                    tracer = self._init_opentelemetry_tracing()
                
                if tracer:
                    try:
                        # Import OpenTelemetry modules
                        from opentelemetry import context as otel_context
                        from opentelemetry import trace as otel_trace

                        # Start OpenTelemetry span
                        span = tracer.start_span(f"{module_name}.{operation_name}")
                        ctx = otel_trace.set_span_in_context(span)
                        token = otel_context.attach(ctx)
                        
                        # Set common span attributes
                        span.set_attribute("llm.provider", getattr(self, 'service', 'unknown'))
                        span.set_attribute("llm.operation", operation_name)
                        if model_name:
                            span.set_attribute("llm.model", str(model_name))
                        
                        # Add user information if available
                        if hasattr(self, 'env') and hasattr(self.env, 'user'):
                            span.set_attribute("user.id", self.env.user.id)  # type: ignore
                            span.set_attribute("user.name", self.env.user.name)  # type: ignore
                        
                        # Add provider-specific attributes
                        if hasattr(self, '_get_trace_attributes'):
                            extra_attrs = self._get_trace_attributes(operation_name, args, kwargs)
                            for key, value in extra_attrs.items():
                                span.set_attribute(key, value)
                                
                    except Exception as e:
                        _logger.debug(f"Error setting span attributes: {e}")
                
                try:
                    # Execute the actual method
                    result = func(self, *args, **kwargs)
                    
                    # Process result for metrics and update span
                    if hasattr(self, '_extract_metrics') and span:
                        try:
                            metrics = self._extract_metrics(result, operation_name, args, kwargs)
                            
                            # Update span attributes with metrics
                            for key, value in metrics.items():
                                if key.startswith('llm.') or key in ['input_tokens', 'output_tokens', 'total_tokens', 'cost_usd']:
                                    # Map common metrics to OpenTelemetry attributes
                                    if key == 'input_tokens':
                                        span.set_attribute('llm.usage.prompt_tokens', value)
                                    elif key == 'output_tokens':
                                        span.set_attribute('llm.usage.completion_tokens', value)
                                    elif key == 'total_tokens':
                                        span.set_attribute('llm.usage.total_tokens', value)
                                    elif key == 'cost_usd':
                                        span.set_attribute('llm.usage.cost', value)
                                    else:
                                        span.set_attribute(key, value)
                        except Exception as e:
                            _logger.debug(f"Error extracting metrics: {e}")
                    
                    return result
                    
                except Exception as e:
                    # Record error in span
                    if span:
                        try:
                            from opentelemetry import trace as otel_trace
                            span.record_exception(e)
                            span.set_status(otel_trace.Status(otel_trace.StatusCode.ERROR, str(e)))
                        except Exception as otel_e:
                            _logger.debug(f"Error recording exception in span: {otel_e}")
                    raise
                
                finally:
                    # Clean up OpenTelemetry
                    if span:
                        span.end()
                    if token:
                        try:
                            from opentelemetry import context as otel_context
                            otel_context.detach(token)
                        except Exception as e:
                            _logger.debug(f"Error detaching context: {e}")
            
            return wrapper
        return decorator
    
    def _extract_metrics(self, result, operation_name, args, kwargs):
        """Extract metrics from operation result
        
        Override this method in provider-specific mixins to extract
        provider-specific metrics from responses.
        
        Args:
            result: The result from the LLM operation
            operation_name: Name of the operation
            args: Original args passed to the method
            kwargs: Original kwargs passed to the method
            
        Returns:
            dict: Metrics to record (e.g., input_tokens, output_tokens, cost_usd)
        """
        return {}
    
    def _get_trace_attributes(self, operation_name, args, kwargs):
        """Get additional trace attributes
        
        Override this method in provider-specific mixins to add
        provider-specific attributes to traces.
        
        Args:
            operation_name: Name of the operation
            args: Original args passed to the method
            kwargs: Original kwargs passed to the method
            
        Returns:
            dict: Additional attributes for the trace
        """
        return {}
