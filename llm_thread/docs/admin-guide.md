# Admin Guide

## Overview

This guide provides administrators with comprehensive information for configuring, managing, and maintaining the Easy AI Chat module in production environments.

## System Configuration

### Module Settings

Navigate to **Settings > LLM Configuration** to access:

1. **Provider Management**
   - Add/edit AI providers
   - Configure API credentials
   - Set rate limits and timeouts

2. **Model Configuration**
   - Fetch available models
   - Set default models
   - Configure model parameters

3. **Tool Management**
   - Enable/disable tools
   - Set default tools
   - Configure tool permissions

### Provider Configuration

#### OpenAI Setup

```python
# Configuration example
{
    'name': 'OpenAI Production',
    'provider_type': 'openai',
    'api_key': 'sk-...',  # Store securely
    'api_url': 'https://api.openai.com/v1',
    'timeout': 60,
    'max_retries': 3,
    'rate_limit': 100,  # requests per minute
}
```

#### Anthropic Setup

```python
{
    'name': 'Anthropic Claude',
    'provider_type': 'anthropic',
    'api_key': 'sk-ant-...',
    'api_url': 'https://api.anthropic.com',
    'timeout': 120,
    'max_tokens': 4000,
}
```

#### Local Ollama Setup

```python
{
    'name': 'Local Ollama',
    'provider_type': 'ollama',
    'api_url': 'http://localhost:11434',
    'timeout': 300,  # Longer for local processing
}
```

### Security Configuration

#### Access Rights Management

1. **User Groups**:
   ```xml
   <!-- Basic User -->
   <record id="group_llm_user" model="res.groups">
       <field name="name">AI Chat / User</field>
       <field name="implied_ids" eval="[(4, ref('base.group_user'))]"/>
       <field name="category_id" ref="module_category_llm"/>
   </record>
   
   <!-- Manager -->
   <record id="group_llm_manager" model="res.groups">
       <field name="name">AI Chat / Manager</field>
       <field name="implied_ids" eval="[(4, ref('group_llm_user'))]"/>
       <field name="users" eval="[(4, ref('base.user_admin'))]"/>
   </record>
   ```

2. **Record Rules**:
   ```xml
   <!-- Personal threads only -->
   <record id="llm_thread_personal_rule" model="ir.rule">
       <field name="name">Personal AI Threads</field>
       <field name="model_id" ref="model_llm_thread"/>
       <field name="domain_force">[('user_id', '=', user.id)]</field>
       <field name="groups" eval="[(4, ref('group_llm_user'))]"/>
   </record>
   ```

#### API Key Security

Best practices for API key management:

1. **Environment Variables**:
   ```bash
   # .env file (not in version control)
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   ```

2. **Odoo System Parameters**:
   ```python
   # Set via UI or code
   self.env['ir.config_parameter'].sudo().set_param(
       'llm.openai.api_key', 
       os.environ.get('OPENAI_API_KEY')
   )
   ```

3. **Encrypted Storage**:
   ```python
   # Use Odoo's encryption
   from odoo.tools import config
   encrypted_key = encrypt(api_key, config['admin_passwd'])
   ```

### Performance Configuration

#### Database Optimization

1. **Indexes**:
   ```sql
   -- Add indexes for better performance
   CREATE INDEX idx_llm_thread_user_date 
   ON llm_thread(user_id, write_date DESC);
   
   CREATE INDEX idx_mail_message_llm 
   ON mail_message(model, res_id) 
   WHERE model = 'llm.thread';
   ```

2. **Archiving Old Threads**:
   ```python
   # Scheduled action to archive old threads
   def _archive_old_threads(self):
       cutoff_date = fields.Date.today() - timedelta(days=90)
       old_threads = self.search([
           ('write_date', '<', cutoff_date),
           ('active', '=', True)
       ])
       old_threads.write({'active': False})
   ```

#### Caching Configuration

```python
# System parameters for caching
{
    'llm.cache.enabled': True,
    'llm.cache.ttl': 3600,  # 1 hour
    'llm.cache.max_size': 1000,  # entries
}
```

### Resource Management

#### Rate Limiting

Implement rate limiting to prevent API abuse:

```python
# Per-user rate limiting
class LLMRateLimit(models.Model):
    _name = 'llm.rate.limit'
    
    user_id = fields.Many2one('res.users')
    requests_today = fields.Integer()
    last_request = fields.Datetime()
    
    def check_rate_limit(self, user_id):
        limit = self.env['ir.config_parameter'].sudo().get_param(
            'llm.daily_limit', 1000
        )
        # Implementation
```

#### Concurrent Request Management

```python
# System parameters
{
    'llm.max_concurrent_threads': 10,
    'llm.queue_timeout': 300,
    'llm.max_queue_size': 100,
}
```

## Monitoring and Maintenance

### Health Checks

#### System Health Dashboard

Create automated health checks:

```python
def check_system_health(self):
    """Comprehensive health check"""
    health_status = {
        'providers': self._check_providers(),
        'database': self._check_database(),
        'queues': self._check_queues(),
        'errors': self._check_recent_errors(),
    }
    return health_status

def _check_providers(self):
    """Check all provider connections"""
    results = {}
    for provider in self.env['llm.provider'].search([]):
        try:
            provider.test_connection()
            results[provider.name] = 'OK'
        except Exception as e:
            results[provider.name] = str(e)
    return results
```

### Logging Configuration

#### Structured Logging

```python
# logging.conf
[logger_llm]
level = INFO
handlers = llm_file
qualname = odoo.addons.llm_thread

[handler_llm_file]
class = handlers.RotatingFileHandler
args = ('/var/log/odoo/llm.log', 'a', 10485760, 5)
formatter = detailed
```

#### Log Analysis

Important log patterns to monitor:

```bash
# Failed API calls
grep "ERROR.*llm.*API" /var/log/odoo/llm.log

# Slow queries
grep "WARNING.*llm.*slow" /var/log/odoo/llm.log

# Rate limit hits
grep "INFO.*rate.limit" /var/log/odoo/llm.log
```

### Backup and Recovery

#### Backup Strategy

1. **Database Backup**:
   ```bash
   # Daily backup script
   pg_dump -U odoo -d odoo_db > backup_$(date +%Y%m%d).sql
   
   # Backup LLM-specific tables
   pg_dump -U odoo -d odoo_db \
     -t llm_thread -t llm_provider -t llm_model \
     > llm_backup_$(date +%Y%m%d).sql
   ```

2. **Configuration Backup**:
   ```python
   # Export configuration
   def export_llm_config(self):
       return {
           'providers': self._export_providers(),
           'models': self._export_models(),
           'tools': self._export_tools(),
           'parameters': self._export_parameters(),
       }
   ```

#### Disaster Recovery

1. **Recovery Procedures**:
   - Restore database from backup
   - Reimport configuration
   - Verify API connections
   - Test thread creation

2. **Failover Configuration**:
   ```python
   # Multiple provider fallback
   PROVIDER_FALLBACK_CHAIN = [
       'openai_primary',
       'openai_secondary', 
       'anthropic_backup',
   ]
   ```

## Advanced Configuration

### Multi-tenant Setup

Configure for multiple companies:

```python
class LLMProvider(models.Model):
    _inherit = 'llm.provider'
    
    company_id = fields.Many2one(
        'res.company',
        default=lambda self: self.env.company
    )
    
    @api.model
    def _get_company_provider(self):
        """Get provider for current company"""
        return self.search([
            ('company_id', '=', self.env.company.id),
            ('active', '=', True)
        ], limit=1)
```

### Load Balancing

Distribute requests across multiple providers:

```python
class LoadBalancer:
    def __init__(self, providers):
        self.providers = providers
        self.current = 0
    
    def get_next_provider(self):
        provider = self.providers[self.current]
        self.current = (self.current + 1) % len(self.providers)
        return provider
```

### Custom Integrations

#### Webhook Configuration

```python
# Send notifications on events
def _send_webhook(self, event_type, data):
    webhook_url = self.env['ir.config_parameter'].sudo().get_param(
        'llm.webhook.url'
    )
    if webhook_url:
        requests.post(webhook_url, json={
            'event': event_type,
            'data': data,
            'timestamp': fields.Datetime.now(),
        })
```

#### External Authentication

```python
# OAuth2 for API access
class OAuth2Provider(models.Model):
    _name = 'llm.oauth2.provider'
    
    def get_access_token(self):
        """Get OAuth2 access token"""
        # Implementation
```

## Troubleshooting

### Common Issues

#### High Memory Usage

**Symptoms**: Server slowdown, OOM errors

**Solutions**:
1. Limit concurrent threads
2. Reduce message history size
3. Enable message archiving
4. Increase server memory

#### API Timeouts

**Symptoms**: Incomplete responses, timeout errors

**Solutions**:
1. Increase timeout values
2. Use faster models
3. Implement retry logic
4. Check network connectivity

#### Database Lock Issues

**Symptoms**: Thread lock errors, deadlocks

**Solutions**:
1. Review locking mechanism
2. Add database indexes
3. Optimize queries
4. Monitor long transactions

### Diagnostic Tools

#### Built-in Diagnostics

```python
# Diagnostic endpoint
@http.route('/llm/diagnostics', auth='user', type='json')
def diagnostics(self):
    if not request.env.user.has_group('llm_thread.group_llm_manager'):
        raise AccessDenied()
    
    return {
        'version': self._get_module_version(),
        'providers': self._test_all_providers(),
        'database': self._check_db_stats(),
        'queue': self._check_queue_status(),
        'errors': self._get_recent_errors(),
    }
```

#### Performance Profiling

```python
# Profile slow operations
from odoo.tools.profiler import profile

@profile
def generate_response(self):
    """Profile AI generation"""
    # Method implementation
```

## Maintenance Tasks

### Scheduled Actions

1. **Daily Maintenance**:
   ```xml
   <record id="ir_cron_llm_daily_maintenance" model="ir.cron">
       <field name="name">LLM Daily Maintenance</field>
       <field name="model_id" ref="model_llm_thread"/>
       <field name="state">code</field>
       <field name="code">model._daily_maintenance()</field>
       <field name="interval_type">days</field>
       <field name="interval_number">1</field>
   </record>
   ```

2. **Cleanup Tasks**:
   ```python
   def _daily_maintenance(self):
       """Daily cleanup and optimization"""
       # Archive old threads
       self._archive_old_threads()
       
       # Clean up orphaned messages
       self._cleanup_orphaned_messages()
       
       # Update statistics
       self._update_usage_statistics()
       
       # Optimize database
       self._vacuum_tables()
   ```

### Update Procedures

1. **Pre-update Checklist**:
   - [ ] Backup database
   - [ ] Export configuration
   - [ ] Note custom modifications
   - [ ] Test in staging

2. **Post-update Verification**:
   - [ ] Verify all providers connect
   - [ ] Test thread creation
   - [ ] Check tool functionality
   - [ ] Validate permissions

## Security Best Practices

1. **API Key Rotation**:
   - Rotate keys every 90 days
   - Use separate keys for dev/prod
   - Monitor key usage

2. **Access Control**:
   - Principle of least privilege
   - Regular permission audits
   - Log access attempts

3. **Data Privacy**:
   - Implement data retention policies
   - Anonymize old conversations
   - Comply with regulations

## Support and Resources

### Getting Help

1. **Documentation**: Full documentation at `/docs`
2. **Logs**: Check `/var/log/odoo/llm.log`
3. **Support**: Email support@apexive.com
4. **Community**: GitHub discussions

### Useful Commands

```bash
# Check module status
odoo shell -d dbname -c odoo.conf << EOF
env['ir.module.module'].search([('name', '=', 'llm_thread')]).state
EOF

# Run diagnostics
curl -X POST http://localhost:8069/llm/diagnostics \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "call", "params": {}}'

# Monitor real-time logs
tail -f /var/log/odoo/llm.log | grep -E "(ERROR|WARNING)"
```
