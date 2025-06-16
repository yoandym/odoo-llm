import logging

import requests
from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class PhoenixConfig(models.Model):
    """Configuration model for Phoenix observability platform"""
    _name = 'phoenix.config'
    _description = 'Phoenix Configuration'
    _order = 'name'

    name = fields.Char('Configuration Name', required=True)
    phoenix_url = fields.Char(
        'Phoenix URL',
        required=True,
        default='http://phoenix:6006',
        help='URL of the Phoenix observability platform'
    )
    otlp_endpoint = fields.Char(
        'OTLP Endpoint',
        required=True,
        default='http://phoenix:4317',
        help='OpenTelemetry Protocol endpoint for tracing'
    )
    is_active = fields.Boolean('Active', default=True)
    environment = fields.Selection([
        ('development', 'Development'),
        ('staging', 'Staging'),
        ('production', 'Production'),
    ], string='Environment', default='development')
    
    # Connection status
    connection_status = fields.Selection([
        ('connected', 'Connected'),
        ('disconnected', 'Disconnected'),
        ('error', 'Error'),
    ], string='Connection Status', default='disconnected', readonly=True)
    last_check = fields.Datetime('Last Check', readonly=True)
    error_message = fields.Text('Error Message', readonly=True)
    
    # Tracing settings
    trace_sampling_rate = fields.Float(
        'Trace Sampling Rate',
        default=1.0,
        help='Sampling rate for traces (0.0 to 1.0)'
    )
    
    # Span processor configuration
    force_simple_processor = fields.Boolean(
        'Force Simple Processor',
        default=False,
        help='Force use of SimpleSpanProcessor even in production (not recommended)'
    )
    batch_size = fields.Integer(
        'Batch Size',
        default=512,
        help='Maximum number of spans to batch before exporting (BatchSpanProcessor only)'
    )
    export_timeout = fields.Integer(
        'Export Timeout (ms)',
        default=30000,
        help='Timeout in milliseconds for export operations'
    )
    queue_size = fields.Integer(
        'Queue Size',
        default=2048,
        help='Maximum number of spans to queue in memory'
    )
    export_interval = fields.Integer(
        'Export Interval (ms)',
        default=5000,
        help='Interval in milliseconds between batch exports'
    )
    
    # Full-stack tracing (always OpenTelemetry)
    enable_fullstack_tracing = fields.Boolean(
        'Enable Full-Stack Tracing',
        default=True,
        help='Enable end-to-end tracing (web → database → LLM → response) using OpenTelemetry'
    )
    enable_web_tracing = fields.Boolean(
        'Trace Web Requests',
        default=True,
        help='Trace HTTP requests and responses'
    )
    enable_database_tracing = fields.Boolean(
        'Trace Database Operations',
        default=True,
        help='Trace database queries and operations'
    )
    enable_external_api_tracing = fields.Boolean(
        'Trace External API Calls',
        default=True,
        help='Trace calls to external APIs (Ollama, OpenAI, etc.)'
    )
    
    # Add SQL constraint to ensure only one active configuration
    _sql_constraints = [
        ('unique_active_config',
         'EXCLUDE (is_active WITH =) WHERE (is_active = true)',
         'Only one configuration can be active at a time.')
    ]
    
    @api.model_create_multi
    def create(self, vals_list):
        """Override create to handle active configuration uniqueness"""
        for vals in vals_list:
            if vals.get('is_active'):
                # Deactivate all other configurations
                self.search([('is_active', '=', True)]).write({'is_active': False})
        return super().create(vals_list)
    
    def write(self, vals):
        """Override write to handle active configuration uniqueness"""
        if vals.get('is_active'):
            # Deactivate all other configurations
            other_configs = self.search([('is_active', '=', True), ('id', 'not in', self.ids)])
            other_configs.write({'is_active': False})
        return super().write(vals)
    
    @api.model
    def get_active_config(self):
        """Get the active Phoenix configuration"""
        config = self.search([('is_active', '=', True)], limit=1)
        if not config:
            _logger.warning("No active Phoenix configuration found")
            return None
        return config
    
    def test_connection(self):
        """Test connection to Phoenix"""
        self.ensure_one()
        try:
            response = requests.get(f"{self.phoenix_url}/health", timeout=5)
            if response.status_code == 200:
                self.connection_status = 'connected'
                self.error_message = False
                return {
                    'type': 'ir.actions.client',
                    'tag': 'display_notification',
                    'params': {
                        'message': 'Connection successful!',
                        'type': 'success',
                        'sticky': False,
                    }
                }
            else:
                self.connection_status = 'error'
                self.error_message = f"HTTP {response.status_code}: {response.text}"
        except Exception as e:
            self.connection_status = 'error'
            self.error_message = str(e)
            _logger.error(f"Phoenix connection test failed: {e}")
            
        self.last_check = fields.Datetime.now()
        
        if self.connection_status == 'error':
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'message': f'Connection failed: {self.error_message}',
                    'type': 'danger',
                    'sticky': True,
                }
            }
    
    def action_open_phoenix_dashboard(self):
        """Open Phoenix dashboard in a new tab"""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_url',
            'url': self.phoenix_url,
            'target': 'new',
        }
    
    @api.model
    def get_phoenix_dashboard_url(self):
        """Get Phoenix dashboard URL for embedding"""
        config = self.get_active_config()
        if config:
            return config.phoenix_url
        return None
    
    @api.model
    def get_tracing_config(self):
        """Get tracing configuration for instrumentation"""
        config = self.get_active_config()
        if not config or not config.is_active:
            return None
            
        return {
            'endpoint': config.otlp_endpoint,
            'sampling_rate': config.trace_sampling_rate,
            'environment': config.environment,
            'fullstack_enabled': config.enable_fullstack_tracing,
            'force_simple_processor': config.force_simple_processor,
            'batch_size': config.batch_size,
            'export_timeout': config.export_timeout,
            'queue_size': config.queue_size,
            'export_interval': config.export_interval,
        }
