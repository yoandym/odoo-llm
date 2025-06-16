"""
OpenTelemetry-based observability mixin for LLM operations
"""
import logging
from typing import Any, Dict, Optional

from odoo import api

try:
    from odoo.addons.llm_observability.services import \
        fullstack_tracing_service
    FULLSTACK_TRACING_AVAILABLE = True
except ImportError:
    FULLSTACK_TRACING_AVAILABLE = False

# Fallback imports for legacy observability
try:
    from odoo.addons.llm_observability.models.mixins.base_observability_mixin import \
        BaseObservabilityMixin
    LEGACY_OBSERVABILITY_AVAILABLE = True
except ImportError:
    LEGACY_OBSERVABILITY_AVAILABLE = False
    # Create dummy base class
    
    class BaseObservabilityMixin:
        pass

_logger = logging.getLogger(__name__)


class OpenTelemetryObservabilityMixin(BaseObservabilityMixin):
    """
    OpenTelemetry-based observability mixin for LLM operations
    
    This mixin provides OpenTelemetry tracing capabilities for LLM providers
    without any LlamaIndex dependencies. It integrates with the Phoenix
    configuration for full-stack observability.
    """
    
    def _get_phoenix_config(self):
        """Get the active Phoenix configuration"""
        try:
            if hasattr(self, 'env'):
                return self.env['phoenix.config'].get_active_config()
            return None
        except Exception as e:
            _logger.debug(f"Could not get Phoenix config: {e}")
            return None
    
    def _initialize_observability_services(self):
        """Initialize OpenTelemetry-based observability services"""
        phoenix_config = self._get_phoenix_config()
        if not phoenix_config:
            return
        
        # Initialize full-stack tracing if enabled
        if phoenix_config.enable_fullstack_tracing and FULLSTACK_TRACING_AVAILABLE:
            fullstack_tracing_service.initialize(phoenix_config)
    
    @api.model_create_multi
    def create(self, vals_list):
        """Override create to initialize observability on first use"""
        records = super().create(vals_list)
        # Initialize observability services for newly created records
        for record in records:
            record._initialize_observability_services()
        return records
    
    def with_opentelemetry_tracing(self, operation_name: str):
        """
        Decorator that provides OpenTelemetry-based observability
        
        Args:
            operation_name: Name of the operation being traced
            
        Returns:
            Decorator function
        """
        def decorator(func):
            # Return the original function for now - let individual providers handle tracing
            # This allows for provider-specific tracing implementations
            return func
        return decorator
    
    def with_web_tracing(self, endpoint_name: str):
        """
        Decorator for web endpoints with full-stack tracing
        
        Args:
            endpoint_name: Name of the web endpoint being traced
            
        Returns:
            Decorator function
        """
        def decorator(func):
            # Return the original function - web tracing handled by fullstack service
            return func
        return decorator
    
    def get_trace_headers(self, headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        """
        Get OpenTelemetry trace headers for distributed tracing
        
        Args:
            headers: Optional existing headers to extend
            
        Returns:
            Dictionary of trace headers
        """
        return headers or {}
    
    @property
    def observability_status(self) -> Dict[str, Any]:
        """
        Get current observability status
        
        Returns:
            Dictionary containing observability configuration status
        """
        phoenix_config = self._get_phoenix_config()
        return {
            'phoenix_config_active': phoenix_config is not None,
            'fullstack_tracing_available': FULLSTACK_TRACING_AVAILABLE,
            'legacy_observability_available': LEGACY_OBSERVABILITY_AVAILABLE,
            'observability_strategy': 'opentelemetry_only',
            'fullstack_enabled': phoenix_config.enable_fullstack_tracing if phoenix_config else False,
        }


# For backward compatibility, keep the old name as an alias
class HybridObservabilityMixin(OpenTelemetryObservabilityMixin):
    """
    Backward compatibility alias for HybridObservabilityMixin
    
    Note: This is now purely OpenTelemetry-based, the 'hybrid' name is
    maintained only for backward compatibility with existing code.
    """
    pass


# General alias for convenience
class ObservabilityMixin(OpenTelemetryObservabilityMixin):
    """General observability mixin alias"""
    pass
