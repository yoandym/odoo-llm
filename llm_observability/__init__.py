from . import controllers, models, services


def post_init_hook(cr, registry):
    """Initialize observability services after module installation"""
    import logging

    from odoo.api import Environment
    
    _logger = logging.getLogger(__name__)
    
    try:
        # Create environment with superuser to access phoenix.config
        env = Environment(cr, 1, {})
        
        from .services.fullstack_tracing_service import \
            fullstack_tracing_service

        # Get Phoenix configuration
        phoenix_config = env['phoenix.config'].get_active_config()
        
        if phoenix_config and phoenix_config.enable_fullstack_tracing:
            fullstack_tracing_service.initialize(phoenix_config)
            _logger.info("✅ LLM Observability: Fullstack tracing service initialized successfully")
        else:
            _logger.info("ℹ️  LLM Observability: No active Phoenix configuration found, tracing disabled")
            
    except Exception as e:
        _logger.warning(f"⚠️  LLM Observability: Failed to initialize tracing service: {e}")
        _logger.exception("Full exception details:")
