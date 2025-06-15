{
    'name': 'LLM Observability',
    'version': '17.0.1.0.0',
    'summary': 'LLM observability integration with Phoenix and OpenTelemetry',
    'description': """
        LLM Observability Module
        =======================
        
        This module provides hybrid observability for LLM operations in Odoo with:
        
        Key Features:
        * Hybrid observability strategy selection (OpenTelemetry or LlamaIndex)
        * Full-stack tracing (web → database → LLM → response) via OpenTelemetry
        * Phoenix dashboard integration for LLM-specific insights
        * Configurable tracing strategies per deployment needs
        * Enterprise-ready observability with vendor-agnostic options
        
        Observability Strategies:
        * OpenTelemetry (Generic): Compatible with any OTLP backend
        * LlamaIndex (Phoenix-optimized): Rich LLM insights and evaluation metrics
        
        The module provides both strategies while maintaining full-stack tracing
        for comprehensive monitoring and debugging capabilities.
    """,
    'category': 'Extra Tools',
    'author': 'FIME Development Team',
    'website': 'https://www.fime.cl',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'web',
        'mail',
        'llm'
    ],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'data/phoenix_config.xml',
        'views/phoenix_config_views.xml',
        'views/phoenix_dashboard_views.xml',
        'views/llm_observability_menu.xml'
    ],
    'assets': {
        'web.assets_backend': [
            'llm_observability/static/src/js/phoenix_dashboard.js',
            'llm_observability/static/src/css/phoenix_dashboard.css',
            'llm_observability/static/src/xml/phoenix_dashboard.xml',
        ],
    },
    'installable': True,
    'auto_install': False,
    'application': False,
    'sequence': 90,
}
