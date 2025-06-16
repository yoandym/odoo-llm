"""
Observability services for LLM operations
"""
import logging

from .fullstack_tracing_service import (FullStackTracingService,
                                        fullstack_tracing_service)

_logger = logging.getLogger(__name__)

# Try to initialize the service on import
try:
    _logger.info("🔭 LLM Observability: Services module loading...")
    # Note: Full initialization will happen when Phoenix config is available
except Exception as e:
    _logger.warning(f"⚠️  LLM Observability: Service loading issue: {e}")

__all__ = [
    'fullstack_tracing_service',
    'FullStackTracingService',
]
