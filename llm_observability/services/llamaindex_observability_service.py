"""
LlamaIndex observability service for Phoenix-optimized LLM tracing
"""
import logging
from functools import wraps
from typing import Any, Dict, Optional

try:
    from llama_index.callbacks.arize_phoenix import ArizePhoenixCallback
    from llama_index.core import set_global_handler
    from llama_index.core.callbacks import CallbackManager
    from llama_index.core.instrumentation import get_dispatcher
    LLAMAINDEX_AVAILABLE = True
except ImportError:
    LLAMAINDEX_AVAILABLE = False

_logger = logging.getLogger(__name__)


class LlamaIndexObservabilityService:
    """Service for managing LlamaIndex-based observability"""
    
    _instance = None
    _initialized = False
    _phoenix_callback = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def initialize(self, phoenix_config):
        """Initialize LlamaIndex observability with Phoenix"""
        if self._initialized or not LLAMAINDEX_AVAILABLE:
            return
            
        if not phoenix_config or phoenix_config.llm_observability_strategy != 'llamaindex':
            _logger.info("LlamaIndex observability not selected")
            return
            
        try:
            # Extract Phoenix host and port from URL
            phoenix_url = phoenix_config.phoenix_url.rstrip('/')
            if '://' in phoenix_url:
                phoenix_url = phoenix_url.split('://', 1)[1]
            
            if ':' in phoenix_url:
                phoenix_host, phoenix_port = phoenix_url.split(':', 1)
                phoenix_port = int(phoenix_port)
            else:
                phoenix_host = phoenix_url
                phoenix_port = 6006
            
            # Set global handler for Phoenix
            set_global_handler(
                "arize_phoenix",
                project_name="odoo-llm",
                phoenix_host=phoenix_host,
                phoenix_port=phoenix_port,
            )
            
            # Create Phoenix callback for direct use
            self._phoenix_callback = ArizePhoenixCallback(
                project_name="odoo-llm",
                phoenix_host=phoenix_host,
                phoenix_port=phoenix_port,
            )
            
            self._initialized = True
            _logger.info(f"LlamaIndex observability initialized for Phoenix at {phoenix_host}:{phoenix_port}")
            
        except Exception as e:
            _logger.error(f"Failed to initialize LlamaIndex observability: {e}")
            self._phoenix_callback = None
    
    @property
    def is_available(self):
        """Check if LlamaIndex observability is available"""
        return LLAMAINDEX_AVAILABLE and self._initialized and self._phoenix_callback is not None
    
    def trace_llm_operation(self, operation_name: str, extract_model_name=None):
        """Decorator for tracing LLM operations with LlamaIndex"""
        def decorator(func):
            @wraps(func)
            def wrapper(self, *args, **kwargs):
                if not LlamaIndexObservabilityService().is_available:
                    return func(self, *args, **kwargs)
                
                try:
                    # Get the dispatcher for instrumentation
                    dispatcher = get_dispatcher()
                    
                    # Extract operation metadata
                    metadata = {
                        "operation": operation_name,
                        "provider": getattr(self, 'service', 'unknown'),
                        "odoo_model": getattr(self, '_name', 'unknown'),
                    }
                    
                    # Extract model name if function provided
                    if extract_model_name and callable(extract_model_name):
                        try:
                            model_name = extract_model_name(*args, **kwargs)
                            if model_name:
                                metadata["model"] = str(model_name)
                        except Exception as e:
                            _logger.debug(f"Could not extract model name: {e}")
                    
                    # Add Odoo context if available
                    if hasattr(self, 'env'):
                        metadata.update({
                            "user_id": self.env.user.id if self.env.user else None,
                            "database": self.env.cr.dbname if self.env.cr else None,
                        })
                    
                    # Dispatch start event
                    dispatcher.event(
                        "llm_operation_start",
                        payload={
                            "operation_name": operation_name,
                            "metadata": metadata
                        }
                    )
                    
                    # Execute the function
                    result = func(self, *args, **kwargs)
                    
                    # Dispatch end event
                    dispatcher.event(
                        "llm_operation_end",
                        payload={
                            "operation_name": operation_name,
                            "metadata": metadata,
                            "success": True
                        }
                    )
                    
                    return result
                    
                except Exception as e:
                    # Dispatch error event
                    if 'dispatcher' in locals():
                        dispatcher.event(
                            "llm_operation_error",
                            payload={
                                "operation_name": operation_name,
                                "metadata": metadata if 'metadata' in locals() else {},
                                "error": str(e)
                            }
                        )
                    raise
                    
            return wrapper
        return decorator
    
    def create_callback_manager(self) -> Optional[Any]:
        """Create a callback manager with Phoenix callback"""
        if not self.is_available:
            return None
            
        try:
            callback_manager = CallbackManager([self._phoenix_callback])
            return callback_manager
        except Exception as e:
            _logger.error(f"Failed to create callback manager: {e}")
            return None
    
    def with_phoenix_callback(self, operation_name: str):
        """Context manager for operations with Phoenix callback"""
        from contextlib import contextmanager
        
        @contextmanager
        def callback_context():
            if not self.is_available:
                yield None
                return
                
            try:
                # Start callback context
                self._phoenix_callback.start_trace(
                    trace_name=operation_name,
                    trace_type="llm_operation"
                )
                
                yield self._phoenix_callback
                
                # End callback context
                self._phoenix_callback.end_trace()
                
            except Exception as e:
                _logger.error(f"Error in Phoenix callback context: {e}")
                yield None
        
        return callback_context()


# Global service instance
llamaindex_observability_service = LlamaIndexObservabilityService()
