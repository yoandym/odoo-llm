# Performance Guide

This guide covers performance considerations, optimization techniques, and best practices for the LLM Integration Base module.

## Performance Challenges

### 1. External API Latency

**Challenge**: LLM provider APIs can have significant latency (1-30+ seconds per request).

**Solutions**:

```python
# 1. Implement configurable timeouts per model
class LLMModel(models.Model):
    _inherit = 'llm.model'
    
    request_timeout = fields.Float(
        string="Request Timeout (seconds)",
        default=60.0,
        help="How long to wait for a response from the model"
    )

# 2. Use streaming for real-time responses
def chat_with_streaming(self, messages):
    """Stream responses for better UX"""
    for chunk in self.provider_id.chat(messages, model=self, stream=True):
        yield chunk.choices[0].delta.content

# 3. Implement retry logic with exponential backoff
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def _call_provider_api(self, *args, **kwargs):
    return self.provider_id.chat(*args, **kwargs)
```

### 2. Large JSON Field Storage

**Challenge**: Model `details` and `model_info` JSON fields can become large.

**Solutions**:

```python
# 1. Use computed fields for display
details_str = fields.Text(
    string="Model Details",
    compute="_compute_details_str",
    store=False,  # Don't store computed display
)

# 2. Implement lazy loading for large fields
@api.model
def read(self, fields=None, load='_classic_read'):
    """Exclude large JSON fields unless specifically requested"""
    if fields and 'details' not in fields and 'model_info' not in fields:
        # Skip loading large fields for list views
        return super().read(fields, load)
    return super().read(fields, load)

# 3. Consider archiving old model versions
@api.model
def archive_old_models(self, days=90):
    """Archive models not used in X days"""
    cutoff_date = fields.Date.today() - timedelta(days=days)
    old_models = self.search([
        ('write_date', '<', cutoff_date),
        ('active', '=', True)
    ])
    old_models.write({'active': False})
```

### 3. Bulk Model Discovery

**Challenge**: Fetching hundreds of models from providers can be slow.

**Solutions**:

```python
class FetchModelsWizard(models.TransientModel):
    _inherit = 'llm.fetch.models.wizard'
    
    @api.model
    def _fetch_models_batch(self, provider, batch_size=50):
        """Fetch models in batches to avoid timeouts"""
        all_models = []
        offset = 0
        
        while True:
            batch = provider.list_models(limit=batch_size, offset=offset)
            if not batch:
                break
            all_models.extend(batch)
            offset += batch_size
            
            # Update progress for user feedback
            self._update_progress(len(all_models))
            
        return all_models
    
    def _process_models_parallel(self, models_data):
        """Process model comparisons in parallel"""
        from concurrent.futures import ThreadPoolExecutor
        
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = []
            for model_data in models_data:
                future = executor.submit(self._process_single_model, model_data)
                futures.append(future)
            
            results = [f.result() for f in futures]
        
        return results
```

## Database Optimization

### 1. Indexing Strategy

```sql
-- Add indexes for common queries
CREATE INDEX idx_llm_model_provider_use ON llm_model(provider_id, model_use);
CREATE INDEX idx_llm_model_default ON llm_model(default) WHERE default = true;
CREATE INDEX idx_llm_provider_service ON llm_provider(service) WHERE active = true;

-- For text search on model names
CREATE INDEX idx_llm_model_name_trgm ON llm_model USING gin(name gin_trgm_ops);
```

### 2. Query Optimization

```python
# Bad: N+1 query problem
for model in self.env['llm.model'].search([]):
    provider_name = model.provider_id.name  # Extra query per model
    publisher_name = model.publisher_id.name  # Another query

# Good: Prefetch related fields
models = self.env['llm.model'].search([])
models.mapped('provider_id')  # Prefetch all providers
models.mapped('publisher_id')  # Prefetch all publishers

for model in models:
    provider_name = model.provider_id.name  # No extra query
    publisher_name = model.publisher_id.name  # No extra query

# Better: Use read_group for aggregations
model_counts = self.env['llm.model'].read_group(
    domain=[('active', '=', True)],
    fields=['provider_id'],
    groupby=['provider_id']
)
```

### 3. Caching Strategies

```python
from functools import lru_cache
from odoo.tools import ormcache

class LLMProvider(models.Model):
    _inherit = 'llm.provider'
    
    @ormcache('self.id')
    def _get_client_config(self):
        """Cache client configuration"""
        return {
            'api_key': self.api_key,
            'api_base': self.api_base,
            'timeout': self.env['ir.config_parameter'].sudo().get_param(
                'llm.request_timeout', 60
            )
        }
    
    @api.model
    @lru_cache(maxsize=128)
    def _parse_model_capabilities(self, capabilities_json):
        """Cache parsed capabilities"""
        return json.loads(capabilities_json) if capabilities_json else []
    
    def clear_caches(self):
        """Clear caches when configuration changes"""
        self._get_client_config.clear_cache(self.env[self._name])
```

## Resource Management

### 1. Connection Pooling

```python
import httpx
from contextlib import contextmanager

class ConnectionPool:
    """Manage HTTP client connections for providers"""
    
    def __init__(self):
        self._clients = {}
    
    @contextmanager
    def get_client(self, provider_id, timeout=60):
        """Get or create a client for the provider"""
        if provider_id not in self._clients:
            self._clients[provider_id] = httpx.Client(
                timeout=timeout,
                limits=httpx.Limits(max_connections=10)
            )
        
        try:
            yield self._clients[provider_id]
        finally:
            # Keep connection alive for reuse
            pass
    
    def close_all(self):
        """Close all connections"""
        for client in self._clients.values():
            client.close()
        self._clients.clear()

# Global connection pool
connection_pool = ConnectionPool()
```

### 2. Rate Limiting

```python
import time
from collections import defaultdict
from threading import Lock

class RateLimiter:
    """Rate limiter for provider API calls"""
    
    def __init__(self):
        self._calls = defaultdict(list)
        self._lock = Lock()
    
    def check_rate_limit(self, provider_id, max_calls=60, window=60):
        """Check if call is within rate limit"""
        with self._lock:
            now = time.time()
            calls = self._calls[provider_id]
            
            # Remove old calls outside window
            calls[:] = [t for t in calls if now - t < window]
            
            if len(calls) >= max_calls:
                sleep_time = window - (now - calls[0])
                if sleep_time > 0:
                    time.sleep(sleep_time)
                    return self.check_rate_limit(provider_id, max_calls, window)
            
            calls.append(now)
            return True

# Usage in provider
class LLMProvider(models.Model):
    _inherit = 'llm.provider'
    
    rate_limiter = RateLimiter()
    
    def chat(self, messages, **kwargs):
        """Rate-limited chat method"""
        self.rate_limiter.check_rate_limit(self.id)
        return super().chat(messages, **kwargs)
```

## Monitoring and Profiling

### 1. Performance Logging

```python
import logging
import time
from contextlib import contextmanager

_logger = logging.getLogger(__name__)

@contextmanager
def log_performance(operation_name, threshold=1.0):
    """Log operations that exceed threshold"""
    start_time = time.time()
    
    try:
        yield
    finally:
        duration = time.time() - start_time
        if duration > threshold:
            _logger.warning(
                "Slow operation '%s' took %.2f seconds",
                operation_name, duration
            )

# Usage
def list_models(self):
    with log_performance(f"list_models_{self.service}", threshold=5.0):
        return self._dispatch('models')
```

### 2. Metrics Collection

```python
class LLMMetrics(models.Model):
    _name = 'llm.metrics'
    _description = 'LLM Usage Metrics'
    
    provider_id = fields.Many2one('llm.provider', required=True)
    model_id = fields.Many2one('llm.model')
    operation = fields.Selection([
        ('chat', 'Chat'),
        ('embedding', 'Embedding'),
        ('list_models', 'List Models')
    ])
    duration = fields.Float('Duration (seconds)')
    tokens_used = fields.Integer()
    success = fields.Boolean()
    error_message = fields.Text()
    timestamp = fields.Datetime(default=fields.Datetime.now)
    
    @api.model
    def record_operation(self, provider, operation, duration, **kwargs):
        """Record metrics for monitoring"""
        self.create({
            'provider_id': provider.id,
            'operation': operation,
            'duration': duration,
            **kwargs
        })
    
    @api.model
    def get_performance_stats(self, date_from, date_to):
        """Get performance statistics"""
        domain = [
            ('timestamp', '>=', date_from),
            ('timestamp', '<=', date_to)
        ]
        
        return {
            'avg_duration': self.search(domain).mapped('duration'),
            'success_rate': len(self.search(domain + [('success', '=', True)])) / len(self.search(domain)),
            'by_provider': self.read_group(
                domain,
                ['duration:avg', 'provider_id'],
                ['provider_id']
            )
        }
```

## Best Practices

### 1. Batch Operations

```python
# Bad: Individual API calls
for text in texts:
    embedding = model.embedding([text])
    process_embedding(embedding)

# Good: Batch API call
embeddings = model.embedding(texts)  # Single API call
for embedding in embeddings:
    process_embedding(embedding)
```

### 2. Async Processing

```python
from odoo.addons.queue_job.job import job

class LLMModel(models.Model):
    _inherit = 'llm.model'
    
    @job(default_channel='llm_operations')
    def process_large_batch(self, texts):
        """Process large batches asynchronously"""
        batch_size = 100
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            self.with_delay().process_batch(batch)
    
    def process_batch(self, texts):
        """Process a single batch"""
        embeddings = self.embedding(texts)
        # Store or process embeddings
        return embeddings
```

### 3. Resource Cleanup

```python
class LLMProvider(models.Model):
    _inherit = 'llm.provider'
    
    @api.ondelete(at_uninstall=False)
    def _unlink_cleanup_resources(self):
        """Clean up resources before deletion"""
        for record in self:
            # Close any open connections
            if hasattr(record, '_client'):
                record._client.close()
            
            # Clear caches
            record.clear_caches()
```

## Performance Checklist

- [ ] Implement request timeouts for all API calls
- [ ] Use connection pooling for HTTP clients
- [ ] Add appropriate database indexes
- [ ] Implement rate limiting for provider APIs
- [ ] Use batch operations where possible
- [ ] Monitor slow operations with logging
- [ ] Cache frequently accessed data
- [ ] Implement progress feedback for long operations
- [ ] Use async processing for large batches
- [ ] Regular cleanup of old/unused data

---

For more optimization strategies, see:
- [Architecture Guide](architecture.md)
- [Security Guide](security.md) for secure caching
- Odoo's performance documentation
