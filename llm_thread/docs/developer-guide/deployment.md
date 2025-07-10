# Deployment

This guide covers deployment considerations and best practices for the LLM Thread module in production environments.

## Production Checklist

- [ ] Configure production AI API keys
- [ ] Set appropriate timeouts
- [ ] Enable response caching
- [ ] Configure rate limiting
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Test scaling scenarios
- [ ] Review security settings
- [ ] Optimize database indexes
- [ ] Configure logging levels

## Environment Configuration

### Environment Variables

```bash
# Production settings
export LLM_THREAD_TIMEOUT=300
export LLM_THREAD_MAX_TOKENS=4000
export LLM_THREAD_CACHE_TTL=3600
export LLM_THREAD_RATE_LIMIT=100
export LLM_THREAD_LOG_LEVEL=INFO
```

### Odoo Configuration

```ini
# odoo.conf
[options]
# Worker configuration for streaming
workers = 4
max_cron_threads = 2
limit_time_cpu = 600
limit_time_real = 1200

# Database optimizations
db_maxconn = 64
db_template = template0

# Memory limits
limit_memory_hard = 2684354560
limit_memory_soft = 2147483648

# Logging
log_level = info
log_handler = :INFO
```

## API Key Management

### Secure Storage

```python
# Use environment variables
import os

class LLMProvider(models.Model):
    _inherit = 'llm.provider'
    
    @api.model
    def _get_api_key(self):
        """Get API key from secure storage"""
        if self.provider_type == 'openai':
            return os.environ.get('OPENAI_API_KEY')
        elif self.provider_type == 'anthropic':
            return os.environ.get('ANTHROPIC_API_KEY')
        # Add other providers
```

### Key Rotation

```python
# Scheduled action for key rotation monitoring
@api.model
def _check_api_key_expiry(self):
    """Check and notify about expiring API keys"""
    providers = self.search([('api_key_expiry', '!=', False)])
    for provider in providers:
        days_until_expiry = (provider.api_key_expiry - fields.Date.today()).days
        if days_until_expiry <= 7:
            # Send notification
            self._send_expiry_notification(provider, days_until_expiry)
```

## Performance Optimization

### Database Indexes

```sql
-- Add indexes for common queries
CREATE INDEX idx_llm_thread_user_active ON llm_thread(user_id, active);
CREATE INDEX idx_llm_thread_model_res ON llm_thread(model, res_id);
CREATE INDEX idx_mail_message_thread_subtype ON mail_message(res_id, model, subtype_id);
CREATE INDEX idx_mail_message_tool_calls ON mail_message(res_id) WHERE tool_calls IS NOT NULL;
```

### Caching Configuration

```python
# Redis caching for responses
CACHE_CONFIG = {
    'host': os.environ.get('REDIS_HOST', 'localhost'),
    'port': int(os.environ.get('REDIS_PORT', 6379)),
    'db': int(os.environ.get('REDIS_DB', 0)),
    'password': os.environ.get('REDIS_PASSWORD'),
    'decode_responses': True,
    'socket_timeout': 5,
    'socket_connect_timeout': 5,
}
```

### Response Caching

```python
import hashlib
import json
from odoo.tools import cache

class LLMThread(models.Model):
    _inherit = 'llm.thread'
    
    @cache.memoize(timeout=3600)
    def _get_cached_response(self, message_hash):
        """Cache common responses"""
        # Implementation
        pass
    
    def _generate_message_hash(self, messages):
        """Generate hash for cache key"""
        content = json.dumps(messages, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()
```

## Scaling Strategies

### Horizontal Scaling

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  odoo:
    image: odoo:17
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
    environment:
      - WORKERS=4
      - MAX_CRON_THREADS=2
    volumes:
      - odoo-data:/var/lib/odoo
      - ./addons:/mnt/extra-addons
    depends_on:
      - db
      - redis

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - odoo

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=odoo
      - POSTGRES_USER=odoo
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data

volumes:
  odoo-data:
  postgres-data:
  redis-data:
```

### Nginx Configuration

```nginx
# nginx.conf
upstream odoo {
    least_conn;
    server odoo1:8069;
    server odoo2:8069;
    server odoo3:8069;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # Increase timeouts for streaming
    proxy_read_timeout 3600s;
    proxy_connect_timeout 3600s;
    proxy_send_timeout 3600s;
    
    # Disable buffering for SSE
    proxy_buffering off;
    proxy_cache off;
    
    location / {
        proxy_pass http://odoo;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Host $http_host;
    }
    
    # Special handling for streaming endpoints
    location ~ ^/llm/thread/generate {
        proxy_pass http://odoo;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_cache off;
    }
}
```

## Monitoring

### Health Checks

```python
@http.route('/llm/health', type='json', auth='none')
def health_check(self):
    """Health check endpoint"""
    try:
        # Check database
        request.env['llm.thread'].search_count([])
        
        # Check providers
        providers = request.env['llm.provider'].sudo().search([])
        provider_status = {}
        for provider in providers:
            provider_status[provider.name] = provider._test_connection()
        
        return {
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'providers': provider_status,
        }
    except Exception as e:
        return {
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat(),
        }
```

### Metrics Collection

```python
import time
from prometheus_client import Counter, Histogram, Gauge

# Define metrics
message_counter = Counter('llm_messages_total', 'Total messages processed')
response_time = Histogram('llm_response_duration_seconds', 'Response generation time')
active_threads = Gauge('llm_active_threads', 'Number of active threads')
tool_executions = Counter('llm_tool_executions_total', 'Tool executions', ['tool_name'])

class LLMThread(models.Model):
    _inherit = 'llm.thread'
    
    def generate(self, user_message_body, **kwargs):
        """Add metrics to generation"""
        start_time = time.time()
        active_threads.inc()
        
        try:
            for event in super().generate(user_message_body, **kwargs):
                if event['type'] == 'message_create':
                    message_counter.inc()
                yield event
        finally:
            active_threads.dec()
            response_time.observe(time.time() - start_time)
```

### Logging Configuration

```python
# logging.conf
[loggers]
keys=root,odoo,llm_thread

[handlers]
keys=console,file,error_file

[formatters]
keys=standard

[logger_root]
level=INFO
handlers=console,file

[logger_odoo]
level=INFO
handlers=console,file
qualname=odoo
propagate=0

[logger_llm_thread]
level=DEBUG
handlers=console,file,error_file
qualname=odoo.addons.llm_thread
propagate=0

[handler_console]
class=StreamHandler
level=INFO
formatter=standard
args=(sys.stdout,)

[handler_file]
class=handlers.TimedRotatingFileHandler
level=INFO
formatter=standard
args=('/var/log/odoo/odoo.log', 'D', 1, 30)

[handler_error_file]
class=handlers.RotatingFileHandler
level=ERROR
formatter=standard
args=('/var/log/odoo/error.log', 'a', 10485760, 5)

[formatter_standard]
format=%(asctime)s %(pid)s %(levelname)s %(name)s: %(message)s
```

## Backup Strategy

### Database Backup

```bash
#!/bin/bash
# backup.sh

# Configuration
DB_NAME="odoo"
DB_USER="odoo"
BACKUP_DIR="/backups"
RETENTION_DAYS=30

# Create backup
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/odoo_$DATE.sql.gz"

pg_dump -U $DB_USER -d $DB_NAME | gzip > $BACKUP_FILE

# Upload to S3 (optional)
aws s3 cp $BACKUP_FILE s3://your-backup-bucket/odoo/

# Clean old backups
find $BACKUP_DIR -name "odoo_*.sql.gz" -mtime +$RETENTION_DAYS -delete
```

### File Storage Backup

```python
# Backup attachments and generated content
@api.model
def backup_llm_data(self):
    """Backup LLM-specific data"""
    backup_data = {
        'threads': [],
        'tools': [],
        'configurations': [],
    }
    
    # Export threads
    threads = self.env['llm.thread'].search([])
    for thread in threads:
        backup_data['threads'].append({
            'name': thread.name,
            'messages': thread._export_messages(),
            'tools': thread.tool_ids.mapped('name'),
            'metadata': thread._get_metadata(),
        })
    
    # Save to file
    timestamp = fields.Datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'llm_backup_{timestamp}.json'
    with open(f'/backups/{filename}', 'w') as f:
        json.dump(backup_data, f, indent=2)
```

## Security Hardening

### Rate Limiting

```python
from odoo.tools import cache
import time

class RateLimiter:
    def __init__(self, max_requests=100, window=3600):
        self.max_requests = max_requests
        self.window = window
    
    def is_allowed(self, user_id):
        key = f'rate_limit_{user_id}'
        current = cache.get(key, 0)
        
        if current >= self.max_requests:
            return False
        
        cache.set(key, current + 1, timeout=self.window)
        return True

# Apply to controller
@http.route('/llm/thread/generate', type='http', auth='user')
def llm_thread_generate(self, thread_id, message=None, **kwargs):
    limiter = RateLimiter()
    if not limiter.is_allowed(request.uid):
        return Response("Rate limit exceeded", status=429)
    
    # Continue with normal processing
```

### Input Validation

```python
import re
from odoo.exceptions import ValidationError

class LLMThread(models.Model):
    _inherit = 'llm.thread'
    
    def _validate_message_content(self, content):
        """Validate and sanitize user input"""
        # Check length
        if len(content) > 10000:
            raise ValidationError(_("Message too long"))
        
        # Check for injection attempts
        suspicious_patterns = [
            r'<script[^>]*>',
            r'javascript:',
            r'on\w+\s*=',
        ]
        
        for pattern in suspicious_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                raise ValidationError(_("Invalid content detected"))
        
        return content.strip()
```

## Disaster Recovery

### Failover Configuration

```python
class LLMProvider(models.Model):
    _inherit = 'llm.provider'
    
    fallback_provider_id = fields.Many2one('llm.provider', 'Fallback Provider')
    
    def _call_api(self, *args, **kwargs):
        """Call API with automatic failover"""
        try:
            return super()._call_api(*args, **kwargs)
        except Exception as e:
            if self.fallback_provider_id:
                _logger.warning("Primary provider failed, using fallback: %s", e)
                return self.fallback_provider_id._call_api(*args, **kwargs)
            raise
```

## Maintenance Mode

```python
@http.route('/llm/maintenance', type='json', auth='user')
def set_maintenance_mode(self, enabled=False):
    """Enable/disable maintenance mode"""
    if not request.env.user.has_group('base.group_system'):
        return {'error': 'Access denied'}
    
    config_param = request.env['ir.config_parameter'].sudo()
    config_param.set_param('llm_thread.maintenance_mode', str(enabled))
    
    return {'success': True, 'maintenance_mode': enabled}
```

This deployment guide covers the essential aspects of running the LLM Thread module in production, from configuration and scaling to monitoring and disaster recovery.
