"""
Hybrid observability mixin that combines full-stack OpenTelemetry tracing
with configurable LLM observability (OpenTelemetry or LlamaIndex)
"""
import logging
from typing import Any, Dict, Optional

from odoo import api

try:
    from odoo.addons.llm_observability.services import (
        fullstack_tracing_service, llamaindex_observability_service)
    SERVICES_AVAILABLE = True
except ImportError:
    SERVICES_AVAILABLE = False

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


class HybridObservabilityMixin(BaseObservabilityMixin):
    """
    Hybrid observability mixin that provides:
    1. Full-stack tracing (always OpenTelemetry)
    2. Configurable LLM observability (OpenTelemetry or LlamaIndex)
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
        """Initialize observability services based on configuration"""
        phoenix_config = self._get_phoenix_config()
        if not phoenix_config:
            return
        
        # Always initialize full-stack tracing if enabled
        if phoenix_config.enable_fullstack_tracing:
            fullstack_tracing_service.initialize(phoenix_config)
        
        # Initialize LLM observability based on strategy
        if phoenix_config.llm_observability_strategy == 'llamaindex':
            llamaindex_observability_service.initialize(phoenix_config)
    
    @api.model_create_multi
    def create(self, vals_list):
        """Override create to initialize observability on first use"""
        records = super().create(vals_list)
        # Initialize observability services for newly created records
        for record in records:
            record._initialize_observability_services()
        return records
    
    def with_hybrid_observability(self, operation_name: str, extract_model_name=None):
        """
        DISABLED: Main decorator that provides hybrid observability
        - Currently disabled due to context issues with mail.message objects
        """
        def decorator(func):
            # Return the original function without any decoration to avoid errors
            return func
        return decorator
    
    def with_web_tracing(self, endpoint_name: str):
        """DISABLED: Decorator for web endpoints with full-stack tracing"""
        def decorator(func):
            # Return the original function without any decoration to avoid errors
            return func
        return decorator
    
    def get_trace_headers(self, headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        """Get headers - disabled to avoid errors"""
        return headers or {}
    
    @property
    def observability_status(self) -> Dict[str, Any]:
        """Get current observability status - disabled"""
        return {
            'phoenix_config_active': False,
            'fullstack_tracing_available': False,
            'llamaindex_available': False,
            'legacy_observability_available': False,
            'llm_strategy': None,
            'fullstack_enabled': False,
        }


# For backward compatibility, create aliases
class ObservabilityMixin(HybridObservabilityMixin):
    """Alias for backward compatibility"""
    pass
