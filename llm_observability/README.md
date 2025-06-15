# LLM Observability Module

## Overview

The LLM Observability module provides comprehensive monitoring and observability for LLM (Large Language Model) interactions in Odoo through integration with Phoenix, an open-source observability platform. This lightweight module acts as a bridge between Odoo and Phoenix, enabling real-time monitoring, tracing, and analytics of LLM operations.

## Features

### 🔍 **Observability Integration**
- **Phoenix Dashboard**: Embedded Phoenix dashboard within Odoo interface
- **Real-time Monitoring**: Live monitoring of LLM interactions and performance
- **OpenTelemetry Integration**: Industry-standard tracing and metrics collection
- **Distributed Tracing**: End-to-end trace visibility across LLM operations

### 📊 **Performance Monitoring**
- **Response Time Tracking**: Monitor latency and performance metrics
- **Token Usage Analytics**: Track input/output tokens and costs
- **Error Rate Monitoring**: Identify and track failures and issues
- **Model Performance Comparison**: Compare different LLM models and providers

### 🚨 **Alerting & Notifications**
- **Real-time Alerts**: Automated alerts for performance issues
- **Custom Thresholds**: Configurable alerting rules
- **Integration Ready**: Built-in Odoo notification system integration

### 📈 **Analytics & Reporting**
- **Usage Trends**: Historical analysis of LLM usage patterns
- **Cost Analysis**: Track and analyze LLM operational costs
- **Performance Insights**: Detailed performance analytics and recommendations
- **Export Capabilities**: Data export for external analysis

### 🔐 **Security & Compliance**
- **Access Control**: Role-based access to observability data
- **Data Retention**: Configurable data retention policies
- **Privacy Protection**: Data anonymization options
- **Audit Trail**: Complete audit trail of LLM interactions

## Architecture

### Components

1. **Phoenix Container**: Separate Docker container running Phoenix observability platform
2. **Odoo Module**: Lightweight interface module within Odoo
3. **OpenTelemetry**: Instrumentation layer for data collection
4. **LlamaIndex Integration**: Native observability hooks in existing LLM modules

### Data Flow

```
LLM Modules → OpenTelemetry → Phoenix Container → Odoo Dashboard
     ↓              ↓              ↓              ↓
  Trace Data → OTLP Endpoint → Storage → Visualization
```

## Installation

### Prerequisites

- Odoo 17.0+
- Docker and Docker Compose
- Python 3.9+
- PostgreSQL database

### 1. Container Setup

The Phoenix container is included in the Docker Compose configuration:

```yaml
phoenix:
  image: arizephoenix/phoenix:latest
  container_name: phoenix
  restart: unless-stopped
  environment:
    - PHOENIX_HOST=0.0.0.0
    - PHOENIX_PORT=6006
    - PHOENIX_GRPC_PORT=4317
    - PHOENIX_SQL_DATABASE_URL=postgresql://odoo:odoo@postgres:5432/phoenix
  ports:
    - "6006:6006"    # Phoenix UI
    - "4317:4317"    # OTLP gRPC receiver
    - "4318:4318"    # OTLP HTTP receiver
  depends_on:
    - postgres
  volumes:
    - phoenix_data:/app/data
```

### 2. Dependencies Installation

Install required Python packages:

```bash
pip install arize-phoenix opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp opentelemetry-instrumentation llama-index-callbacks-arize-phoenix
```

### 3. Module Installation

1. Install the `llm_observability` module in Odoo
2. Configure Phoenix connection settings
3. Test the connection to Phoenix
4. Enable tracing in existing LLM modules

## Configuration

### Phoenix Configuration

Navigate to **LLM Observability > Phoenix Configuration** and configure:

- **Phoenix URL**: `http://phoenix:6006` (default)
- **OTLP Endpoint**: `http://phoenix:4317` (default)
- **Environment**: Development/Staging/Production
- **Tracing Settings**: Enable/disable tracing and set sampling rates

### Security Groups

The module provides two security groups:

- **LLM Observability User**: Can view traces and observability data
- **LLM Observability Manager**: Can manage Phoenix configuration and settings

## Usage

### Dashboard Access

Access the observability dashboard through:
- **Menu**: LLM Observability > Phoenix Dashboard
- **Direct URL**: `/web#action=llm_observability.action_phoenix_dashboard`

### Viewing Traces

1. Navigate to **LLM Observability > LLM Traces**
2. Use filters to find specific traces
3. Click on traces to view details
4. Use "View in Phoenix" to see detailed trace information

### Configuration Management

1. Go to **LLM Observability > Phoenix Configuration**
2. Test connection to ensure Phoenix is accessible
3. Adjust tracing settings as needed
4. Monitor connection status

## Integration with Existing LLM Modules

### LlamaIndex Integration

For existing LlamaIndex-based modules, add observability hooks:

```python
from llama_index.callbacks.arize_phoenix import arize_phoenix_callback_handler

# Configure Phoenix callback
callback_manager = CallbackManager([arize_phoenix_callback_handler])

# Use with LlamaIndex components
service_context = ServiceContext.from_defaults(callback_manager=callback_manager)
```

### Custom Integration

For custom LLM implementations, use OpenTelemetry directly:

```python
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

# Configure tracing
trace.set_tracer_provider(TracerProvider())
tracer = trace.get_tracer(__name__)

otlp_exporter = OTLPSpanExporter(endpoint="http://phoenix:4317", insecure=True)
span_processor = BatchSpanProcessor(otlp_exporter)
trace.get_tracer_provider().add_span_processor(span_processor)

# Create traces
with tracer.start_as_current_span("llm_operation"):
    # Your LLM code here
    pass
```

## API Endpoints

### REST API

- `GET /llm_observability/dashboard_data`: Get dashboard metrics
- `GET /llm_observability/traces`: Get traces with pagination
- `POST /llm_observability/test_connection`: Test Phoenix connection
- `POST /llm_observability/webhook/trace`: Webhook for external trace data

### Example API Usage

```javascript
// Get dashboard data
const response = await fetch('/llm_observability/dashboard_data', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({date_range: 7})
});
const data = await response.json();
```

## Monitoring & Maintenance

### Data Retention

The module automatically cleans up old trace data:
- Default retention: 30 days
- Configurable through cron job settings
- Manual cleanup available through model methods

### Performance Considerations

- Phoenix runs in a separate container to avoid resource conflicts
- Trace sampling can be adjusted to reduce overhead
- Data is stored in PostgreSQL for optimal performance
- Automatic cleanup prevents database bloat

### Troubleshooting

Common issues and solutions:

1. **Connection Failed**: Check Phoenix container status and network connectivity
2. **No Traces Visible**: Verify tracing is enabled and instrumentation is active
3. **Performance Issues**: Adjust trace sampling rate or increase resources
4. **Dashboard Not Loading**: Check Phoenix URL configuration and firewall settings

## Development

### Custom Trace Processing

Extend the `llm.trace` model to add custom trace processing:

```python
class LLMTrace(models.Model):
    _inherit = 'llm.trace'
    
    def custom_process_trace(self, trace_data):
        # Custom processing logic
        pass
```

### Adding Custom Metrics

Create custom dashboard widgets by extending the Phoenix dashboard component.

### Testing

Use the test connection feature to verify setup:

```python
# Test from Python code
config = env['phoenix.config'].get_active_config()
result = config.test_connection()
```

## Support & Resources

- **Documentation**: `/docs/modules/llm-observability/`
- **Phoenix Documentation**: https://docs.arize.com/phoenix/
- **OpenTelemetry**: https://opentelemetry.io/docs/
- **Issue Tracking**: Internal FIME issue tracker

## License

This module is licensed under LGPL-3, consistent with Odoo's licensing.

---

**Version**: 17.0.1.0.0  
**Author**: FIME Development Team  
**Last Updated**: June 2025
