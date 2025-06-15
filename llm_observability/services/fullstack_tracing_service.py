"""
Full-stack tracing service using OpenTelemetry
Always active regardless of LLM observability strategy
"""
import logging
import time
from contextlib import contextmanager
from functools import wraps
from typing import Any, Dict, Optional

from odoo import http

try:
    from opentelemetry import propagate, trace
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import \
        OTLPSpanExporter
    from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor
    from opentelemetry.instrumentation.requests import RequestsInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.sdk.trace.sampling import TraceIdRatioBasedSampler
    from opentelemetry.trace.status import Status, StatusCode
    OTEL_AVAILABLE = True
except ImportError:
    OTEL_AVAILABLE = False

_logger = logging.getLogger(__name__)


class FullStackTracingService:
    """Service for managing full-stack OpenTelemetry tracing"""
    
    _instance = None
    _tracer = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def initialize(self, phoenix_config):
        """Initialize full-stack tracing with Phoenix configuration"""
        if self._initialized or not OTEL_AVAILABLE:
            return
            
        if not phoenix_config or not phoenix_config.enable_fullstack_tracing:
            _logger.info("Full-stack tracing disabled in configuration")
            return
            
        try:
            # Create resource with service information
            resource = Resource.create({
                "service.name": "odoo-llm-fullstack",
                "service.version": "17.0.1.0.0",
                "service.instance.id": f"odoo-{phoenix_config.id}",
                "deployment.environment": phoenix_config.environment,
            })
            
            # Set up tracer provider with sampling
            sampler = TraceIdRatioBasedSampler(phoenix_config.trace_sampling_rate)
            tracer_provider = TracerProvider(resource=resource, sampler=sampler)
            
            # Configure OTLP exporter for Phoenix
            otlp_exporter = OTLPSpanExporter(
                endpoint=phoenix_config.otlp_endpoint,
                insecure=True  # Use insecure for local development
            )
            
            # Add span processor
            span_processor = BatchSpanProcessor(otlp_exporter)
            tracer_provider.add_span_processor(span_processor)
            
            # Set global tracer provider
            trace.set_tracer_provider(tracer_provider)
            
            # Auto-instrument libraries based on configuration
            if phoenix_config.enable_external_api_tracing:
                try:
                    RequestsInstrumentor().instrument()
                    _logger.info("Requests instrumentation enabled")
                except Exception as e:
                    _logger.warning(f"Failed to instrument requests: {e}")
                    
            if phoenix_config.enable_database_tracing:
                try:
                    Psycopg2Instrumentor().instrument()
                    _logger.info("PostgreSQL instrumentation enabled")
                except Exception as e:
                    _logger.warning(f"Failed to instrument PostgreSQL: {e}")
            
            # Get tracer instance
            self._tracer = trace.get_tracer(
                instrumenting_module_name="odoo.fullstack",
                instrumenting_library_version="1.0.0"
            )
            
            self._initialized = True
            _logger.info("Full-stack tracing initialized successfully")
            
        except Exception as e:
            _logger.error(f"Failed to initialize full-stack tracing: {e}")
            self._tracer = None
    
    @property
    def tracer(self):
        """Get the tracer instance"""
        return self._tracer
    
    @property
    def is_available(self):
        """Check if tracing is available"""
        return OTEL_AVAILABLE and self._tracer is not None
    
    @contextmanager
    def trace_operation(self, operation_name: str, **attributes):
        """Context manager for tracing operations with full context"""
        if not self.is_available:
            yield None
            return
            
        # Extract trace context from HTTP headers if available
        context = None
        if hasattr(http, 'request') and http.request:
            try:
                context = propagate.extract(http.request.httprequest.headers)
            except Exception as e:
                _logger.debug(f"Could not extract trace context: {e}")
        
        with self._tracer.start_as_current_span(
            operation_name, 
            context=context,
            attributes=attributes
        ) as span:
            try:
                yield span
                if span:
                    span.set_status(Status(StatusCode.OK))
            except Exception as e:
                if span:
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    span.record_exception(e)
                raise
    
    def trace_web_request(self, operation_name: str):
        """Decorator for tracing web requests"""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                if not self.is_available:
                    return func(*args, **kwargs)
                
                # Prepare span attributes
                attributes = {
                    "operation.type": "web_request",
                    "web.endpoint": operation_name,
                }
                
                # Add HTTP request context if available
                if hasattr(http, 'request') and http.request:
                    req = http.request.httprequest
                    attributes.update({
                        "http.method": req.method,
                        "http.url": req.url,
                        "http.scheme": req.scheme,
                        "http.host": req.host,
                        "http.target": req.path,
                        "http.user_agent": req.headers.get('User-Agent', ''),
                        "http.remote_addr": req.remote_addr,
                    })
                    
                    # Add Odoo context
                    if hasattr(http.request, 'env'):
                        env = http.request.env
                        attributes.update({
                            "odoo.user_id": env.user.id if env.user else None,
                            "odoo.database": env.cr.dbname if env.cr else None,
                            "odoo.company_id": env.company.id if env.company else None,
                        })
                
                # Execute with tracing
                with self.trace_operation(f"http.{operation_name}", **attributes) as span:
                    start_time = time.time()
                    
                    try:
                        result = func(*args, **kwargs)
                        
                        # Add response metrics to span
                        if span:
                            duration = time.time() - start_time
                            span.set_attribute("http.duration_ms", int(duration * 1000))
                            
                            # Try to extract status code from result
                            if hasattr(result, 'status_code'):
                                span.set_attribute("http.status_code", result.status_code)
                            elif isinstance(result, dict) and 'error' in result:
                                span.set_attribute("http.error", True)
                                span.set_attribute("error.message", str(result['error']))
                        
                        return result
                        
                    except Exception as e:
                        if span:
                            span.set_attribute("http.error", True)
                            span.set_attribute("error.message", str(e))
                        raise
                        
            return wrapper
        return decorator
    
    def trace_llm_operation(self, operation_name: str, provider: str = None, model: str = None):
        """Decorator for tracing LLM operations"""
        def decorator(func):
            @wraps(func)
            def wrapper(self, *args, **kwargs):
                if not FullStackTracingService().is_available:
                    return func(self, *args, **kwargs)
                
                # Prepare span attributes
                attributes = {
                    "operation.type": "llm_operation",
                    "llm.operation": operation_name,
                    "llm.provider": provider or getattr(self, 'service', 'unknown'),
                    "odoo.model": getattr(self, '_name', 'unknown'),
                }
                
                # Extract model name
                if model:
                    attributes["llm.model"] = str(model)
                elif len(args) >= 2:  # messages, model pattern
                    model_arg = args[1] if args[1] else kwargs.get('model')
                    if model_arg:
                        attributes["llm.model"] = str(model_arg)
                
                # Add Odoo context if available
                if hasattr(self, 'env'):
                    attributes.update({
                        "odoo.user_id": self.env.user.id if self.env.user else None,
                        "odoo.database": self.env.cr.dbname if self.env.cr else None,
                    })
                
                # Execute with tracing
                tracing_service = FullStackTracingService()
                with tracing_service.trace_operation(f"llm.{operation_name}", **attributes) as span:
                    start_time = time.time()
                    
                    try:
                        result = func(self, *args, **kwargs)
                        
                        # Add result metrics to span
                        if span:
                            duration = time.time() - start_time
                            span.set_attribute("llm.duration_ms", int(duration * 1000))
                            
                            # Determine if streaming or single response
                            if hasattr(result, '__iter__') and not isinstance(result, (str, bytes, dict)):
                                span.set_attribute("llm.response_type", "stream")
                            else:
                                span.set_attribute("llm.response_type", "single")
                        
                        return result
                        
                    except Exception as e:
                        if span:
                            span.set_attribute("llm.error", True)
                            span.set_attribute("error.message", str(e))
                        raise
                        
            return wrapper
        return decorator
    
    def inject_trace_headers(self, headers: Dict[str, str] = None) -> Dict[str, str]:
        """Inject trace context into HTTP headers for downstream services"""
        if not self.is_available:
            return headers or {}
            
        headers = headers or {}
        
        try:
            # Inject current trace context into headers
            propagate.inject(headers)
        except Exception as e:
            _logger.debug(f"Could not inject trace headers: {e}")
            
        return headers


# Global service instance
fullstack_tracing_service = FullStackTracingService()
