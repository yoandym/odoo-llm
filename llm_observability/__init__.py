from . import controllers, models, services


def post_init_hook(*args, **kwargs):
    """Initialize observability services after module installation"""
    import logging

    from odoo.api import Environment
    
    _logger = logging.getLogger(__name__)
    
    try:
        if len(args) == 1 and hasattr(args[0], 'cr') and hasattr(args[0], 'registry'):
            env = args[0]
        elif len(args) == 2:
            cr, registry = args
            env = Environment(cr, 1, {})
        else:
            raise ValueError("Unsupported post_init_hook signature")
        
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
