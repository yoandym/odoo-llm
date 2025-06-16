{
    'name': 'LLM Observability',
    'version': '17.0.1.0.1',
    'summary': 'LLM observability integration with Phoenix and OpenTelemetry',
    'description': """
        LLM Observability Module
        =======================
        
        This module provides comprehensive observability for LLM operations in Odoo with:
        
        Key Features:
        * OpenTelemetry-based observability for all LLM operations
        * Full-stack tracing (web → database → LLM → response)
        * Phoenix dashboard integration for LLM-specific insights
        * Tool calling and usage tracking
        * Token estimation and performance metrics
        * Compatible with Phoenix, Jaeger, DataDog, and other OTLP backends
        
        Observability Approach:
        * Pure OpenTelemetry implementation for maximum compatibility
        * Comprehensive LLM tracing including tool execution
        * No external dependencies beyond standard OpenTelemetry
        
        The module provides enterprise-ready observability with vendor-agnostic
        OpenTelemetry for comprehensive monitoring and debugging capabilities.
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
    'external_dependencies': {
        'python': [
            'opentelemetry-api',
            'opentelemetry-sdk',
            'opentelemetry-exporter-otlp-proto-grpc',
            'opentelemetry-instrumentation-requests',
            'opentelemetry-instrumentation-psycopg2',
            'openinference-semantic-conventions',
        ],
    },
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
    'post_init_hook': 'post_init_hook',
    'installable': True,
    'auto_install': False,
    'application': False,
    'sequence': 90,
}
