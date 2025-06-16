import logging
from typing import Any, Dict, List, Optional

import requests
from odoo import http
from odoo.http import request

# Import OpenTelemetry observability for web tracing
try:
    from odoo.addons.llm_observability.models.mixins.opentelemetry_observability_mixin import \
        OpenTelemetryObservabilityMixin as ObservabilityMixin
    _has_observability = True
except ImportError:
    _has_observability = False
    # Create dummy mixin
    class ObservabilityMixin:
        def with_web_tracing(self, endpoint_name):
            def decorator(func):
                return func
            return decorator

_logger = logging.getLogger(__name__)


class PhoenixController(http.Controller):
    """Controller for Phoenix observability integration"""
    
    def _diagnose_phoenix_connectivity(self, phoenix_url: str) -> Dict[str, Any]:
        """Diagnose Phoenix connectivity and available endpoints"""
        diagnostics = {
            'base_url_accessible': False,
            'content_type': None,
            'status_code': None,
            'available_endpoints': [],
            'errors': []
        }
        
        try:
            # Test base URL
            response = requests.get(phoenix_url.rstrip('/'), timeout=5, allow_redirects=True)
            diagnostics['base_url_accessible'] = response.status_code == 200
            diagnostics['status_code'] = response.status_code
            diagnostics['content_type'] = response.headers.get('content-type', '')
            
            # Test common API endpoints
            api_paths = [
                '/api/v1/stats',
                '/api/stats', 
                '/stats',
                '/api/v1/traces',
                '/api/traces',
                '/traces',
                '/api/v1/health',
                '/health',
                '/api/v1',
                '/api'
            ]
            
            for path in api_paths:
                try:
                    endpoint_url = f"{phoenix_url.rstrip('/')}{path}"
                    resp = requests.get(endpoint_url, timeout=2, headers={'Accept': 'application/json'})
                    if resp.status_code == 200:
                        diagnostics['available_endpoints'].append({
                            'path': path,
                            'status': resp.status_code,
                            'content_type': resp.headers.get('content-type', ''),
                            'is_json': 'application/json' in resp.headers.get('content-type', '').lower()
                        })
                except Exception as e:
                    continue
                    
        except Exception as e:
            diagnostics['errors'].append(str(e))
            
        return diagnostics
    
    def _get_phoenix_traces_summary(self, phoenix_config, date_range: int) -> Dict[str, Any]:
        """Get traces summary from Phoenix GraphQL API"""
        try:
            # Use GraphQL API to get real data from Phoenix
            phoenix_graphql_url = f"{phoenix_config.phoenix_url.rstrip('/')}/graphql"
            
            # First, try to get basic project and span statistics from Phoenix
            try:
                # GraphQL query to get spans data
                graphql_query = {
                    "query": """
                    query GetProjectStats {
                        projects {
                            edges {
                                node {
                                    id
                                    name
                                    spans {
                                        edges {
                                            node {
                                                id
                                                name
                                                statusCode
                                                startTime
                                                latencyMs
                                                tokenCountTotal
                                                tokenCountPrompt
                                                tokenCountCompletion
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    """
                }
                
                _logger.info(f"Querying Phoenix GraphQL API: {phoenix_graphql_url}")
                response = requests.post(
                    phoenix_graphql_url,
                    json=graphql_query,
                    timeout=10,
                    headers={'Content-Type': 'application/json', 'Accept': 'application/json'}
                )
                
                _logger.info(f"Phoenix GraphQL response: status={response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    _logger.info(f"Phoenix GraphQL data received successfully")
                    
                    if 'data' in data and data['data'] and 'projects' in data['data']:
                        projects = data['data']['projects']['edges']
                        
                        # Calculate statistics from spans
                        total_spans = 0
                        error_spans = 0
                        total_duration_ms = 0
                        total_tokens = 0
                        span_count_with_duration = 0
                        
                        for project_edge in projects:
                            project = project_edge['node']
                            if 'spans' in project and project['spans']:
                                spans = project['spans']['edges']
                                total_spans += len(spans)
                                
                                for span_edge in spans:
                                    span = span_edge['node']
                                    
                                    # Count errors (statusCode != OK)
                                    if span.get('statusCode') == 'ERROR':
                                        error_spans += 1
                                    
                                    # Sum latency
                                    if span.get('latencyMs'):
                                        total_duration_ms += span['latencyMs']
                                        span_count_with_duration += 1
                                    
                                    # Sum token counts
                                    if span.get('tokenCountTotal'):
                                        total_tokens += span['tokenCountTotal']
                        
                        # Calculate metrics
                        success_rate = 100.0 if total_spans == 0 else ((total_spans - error_spans) / total_spans) * 100
                        avg_duration_ms = total_duration_ms / span_count_with_duration if span_count_with_duration > 0 else 0
                        error_rate = (error_spans / total_spans) * 100 if total_spans > 0 else 0
                        
                        return {
                            'total_traces': total_spans,
                            'success_rate': success_rate,
                            'avg_duration_ms': avg_duration_ms,
                            'total_tokens': total_tokens,
                            'total_cost_usd': 0.0,  # Phoenix doesn't track cost directly
                            'error_traces': error_spans,
                            'error_rate': error_rate,
                            'message': f'Live data from Phoenix GraphQL API - {len(projects)} projects'
                        }
                    else:
                        _logger.warning("Phoenix GraphQL returned unexpected data structure")
                        _logger.debug(f"Response data: {data}")
                else:
                    _logger.warning(f"Phoenix GraphQL API returned status {response.status_code}")
                    if response.text:
                        _logger.debug(f"Response body: {response.text[:200]}...")
                        
            except requests.exceptions.JSONDecodeError as json_err:
                _logger.warning(f"Phoenix GraphQL API returned invalid JSON: {json_err}")
                _logger.debug(f"Response body: {response.text[:200]}...")
            except requests.exceptions.RequestException as req_err:
                _logger.info(f"Phoenix GraphQL API not available: {req_err}")
                    
        except Exception as e:
            _logger.warning(f"Error querying Phoenix GraphQL API: {e}")
            
            # Fallback: return mock data indicating Phoenix integration is active but no data yet
            message = 'Phoenix observability active - traces are being sent via OpenTelemetry. Live dashboard available in Phoenix UI.'
            
            # Try a simple health check to see if Phoenix is running
            try:
                health_check_response = requests.get(
                    phoenix_config.phoenix_url.rstrip('/'),
                    timeout=2,
                    allow_redirects=True
                )
                if health_check_response.status_code == 200:
                    message += f" Phoenix is running at {phoenix_config.phoenix_url} but API endpoints may differ from expected format."
                else:
                    message += f" Phoenix health check returned status {health_check_response.status_code}."
            except requests.exceptions.RequestException as health_err:
                message += f" Phoenix may not be running at {phoenix_config.phoenix_url}: {health_err}"
                
            return {
                'total_traces': 0,
                'success_rate': 100.0,  # Percentage
                'avg_duration_ms': 0,
                'total_tokens': 0,
                'total_cost_usd': 0.0,
                'error_traces': 0,
                'error_rate': 0.0,
                'message': message
            }
            
        except Exception as e:
            _logger.error(f"Error getting Phoenix traces summary: {e}")
            return {
                'total_traces': 0,
                'success_rate': 0.0,
                'avg_duration_ms': 0,
                'total_tokens': 0,
                'total_cost_usd': 0.0,
                'error_traces': 0,
                'error_rate': 100.0,
                'message': f'Error connecting to Phoenix: {str(e)}'
            }
    
    @http.route('/llm_observability/dashboard_data', type='json', auth='user')
    def get_dashboard_data(self, **kwargs) -> Dict[str, Any]:
        """Get dashboard data for the observability interface"""
        # For now, skip the hybrid observability integration to avoid errors
        # TODO: Fix the OpenTelemetry observability integration properly
        return self._get_dashboard_data_impl(**kwargs)
    
    def _get_dashboard_data_impl(self, **kwargs) -> Dict[str, Any]:
        """Internal implementation of get_dashboard_data"""
        try:
            # Get Phoenix configuration
            phoenix_config = request.env['phoenix.config'].get_active_config()
            if not phoenix_config:
                return {
                    'error': 'No active Phoenix configuration found',
                    'phoenix_available': False
                }
            
            # Since we're using Phoenix-only tracing, get data from Phoenix API
            date_range = kwargs.get('date_range', 7)
            traces_summary = self._get_phoenix_traces_summary(phoenix_config, date_range)
            
            return {
                'phoenix_available': True,
                'phoenix_url': phoenix_config.phoenix_url,
                'connection_status': phoenix_config.connection_status,
                'traces_summary': traces_summary,
                'environment': phoenix_config.environment,
                'fullstack_tracing_enabled': phoenix_config.enable_fullstack_tracing,
            }
            
        except Exception as e:
            _logger.error(f"Error getting dashboard data: {e}")
            return {
                'error': str(e),
                'phoenix_available': False
            }
    
    @http.route('/llm_observability/phoenix_embed', type='http', auth='user')
    def phoenix_embed(self, **kwargs):
        """Embed Phoenix dashboard in Odoo"""
        phoenix_config = request.env['phoenix.config'].get_active_config()
        
        if not phoenix_config:
            return request.render('llm_observability.phoenix_not_configured')
        
        return request.render('llm_observability.phoenix_embed', {
            'phoenix_url': phoenix_config.phoenix_url,
            'connection_status': phoenix_config.connection_status,
        })
    
    @http.route('/llm_observability/test_connection', type='json', auth='user')
    def test_phoenix_connection(self, config_id: Optional[str] = None) -> Dict[str, Any]:
        """Test connection to Phoenix"""
        try:
            if config_id:
                config = request.env['phoenix.config'].browse(int(config_id))
            else:
                config = request.env['phoenix.config'].get_active_config()
            
            if not config:
                return {'success': False, 'error': 'No configuration found'}
            
            config.test_connection()
            return {
                'success': config.connection_status == 'connected',
                'status': config.connection_status,
                'error': config.error_message or None
            }
            
        except Exception as e:
            _logger.error(f"Error testing Phoenix connection: {e}")
            return {'success': False, 'error': str(e)}
    
    @http.route('/llm_observability/traces', type='json', auth='user')
    def get_traces(self, **kwargs) -> Dict[str, Any]:
        """Get traces data from Phoenix API"""
        try:
            phoenix_config = request.env['phoenix.config'].get_active_config()
            if not phoenix_config:
                return {'error': 'No active Phoenix configuration found'}
            
            # For now, return mock data since we need to implement Phoenix API integration
            # In a real implementation, this would query Phoenix's API for trace data
            return {
                'traces': [],
                'total_count': 0,
                'has_more': False,
                'message': 'Phoenix API integration pending - view traces directly in Phoenix dashboard'
            }
            
        except Exception as e:
            _logger.error(f"Error getting traces: {e}")
            return {'error': str(e)}
    
    @http.route('/llm_observability/webhook/trace', type='json', auth='public', csrf=False)
    def receive_trace_webhook(self, **kwargs) -> Dict[str, Any]:
        """Webhook endpoint to receive trace data from external systems"""
        try:
            # Since we're using Phoenix-only tracing, we no longer store traces in Odoo
            # This endpoint can be used for notifications or logging
            _logger.info(f"Received trace webhook data: {kwargs}")
            
            return {'success': True, 'message': 'Webhook received - traces are handled by Phoenix'}
            
        except Exception as e:
            _logger.error(f"Error processing trace webhook: {e}")
            return {'success': False, 'error': str(e)}
    
    @http.route('/llm_observability/diagnose_phoenix', type='json', auth='user')
    def diagnose_phoenix(self, **kwargs) -> Dict[str, Any]:
        """Diagnose Phoenix connectivity and available endpoints"""
        try:
            phoenix_config = request.env['phoenix.config'].get_active_config()
            if not phoenix_config:
                return {'error': 'No active Phoenix configuration found'}
            
            diagnostics = self._diagnose_phoenix_connectivity(phoenix_config.phoenix_url)
            
            return {
                'phoenix_url': phoenix_config.phoenix_url,
                'diagnostics': diagnostics,
                'recommendations': self._get_phoenix_recommendations(diagnostics)
            }
            
        except Exception as e:
            _logger.error(f"Error diagnosing Phoenix: {e}")
            return {'error': str(e)}
    
    def _get_phoenix_recommendations(self, diagnostics: Dict[str, Any]) -> List[str]:
        """Get recommendations based on diagnostics"""
        recommendations = []
        
        if not diagnostics['base_url_accessible']:
            recommendations.append("Phoenix is not accessible at the configured URL. Check if Phoenix is running.")
            
        if diagnostics['base_url_accessible'] and not diagnostics['available_endpoints']:
            recommendations.append("Phoenix is running but no API endpoints found. This may be a different version of Phoenix.")
            
        if diagnostics['available_endpoints']:
            json_endpoints = [ep for ep in diagnostics['available_endpoints'] if ep['is_json']]
            if json_endpoints:
                recommendations.append(f"Found {len(json_endpoints)} JSON API endpoints. Phoenix API integration is possible.")
            else:
                recommendations.append("API endpoints found but none return JSON. Check Phoenix version and API documentation.")
                
        return recommendations
