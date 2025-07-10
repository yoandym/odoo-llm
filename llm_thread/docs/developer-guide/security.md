# Security

The LLM Thread module implements comprehensive security measures following Odoo's security model to ensure data privacy and access control.

## Access Control Lists (ACL)

### Model Access Rights

Defined in `security/ir.model.access.csv`:

| Model | Group | Read | Write | Create | Unlink |
|-------|-------|------|-------|--------|--------|
| llm.thread | base.group_user | ✓ | ✓ | ✓ | ✓ |

Users can fully manage their own threads while system administrators have unrestricted access.

## Record Rules

### Thread Access Rules

Defined in `security/llm_thread_security.xml`:

```xml
<record id="llm_thread_user_rule" model="ir.rule">
    <field name="name">User can only access own threads</field>
    <field name="model_id" ref="model_llm_thread"/>
    <field name="domain_force">[('user_id', '=', user.id)]</field>
    <field name="groups" eval="[(4, ref('base.group_user'))]"/>
    <field name="perm_read" eval="True"/>
    <field name="perm_write" eval="True"/>
    <field name="perm_create" eval="True"/>
    <field name="perm_unlink" eval="True"/>
</record>
```

This ensures users can only access threads they created, providing complete data isolation between users.

### System Administrator Override

```xml
<record id="llm_thread_admin_rule" model="ir.rule">
    <field name="name">Admin can access all threads</field>
    <field name="model_id" ref="model_llm_thread"/>
    <field name="domain_force">[(1, '=', 1)]</field>
    <field name="groups" eval="[(4, ref('base.group_system'))]"/>
</record>
```

System administrators can access all threads for support and maintenance purposes.

## Security Considerations

### 1. Data Isolation

```mermaid
graph TD
    subgraph "User A Space"
        UA[User A]
        TA1[Thread 1]
        TA2[Thread 2]
        UA --> TA1
        UA --> TA2
    end
    
    subgraph "User B Space"
        UB[User B]
        TB1[Thread 3]
        TB2[Thread 4]
        UB --> TB1
        UB --> TB2
    end
    
    subgraph "Admin Space"
        ADMIN[System Admin]
        ADMIN -.-> TA1
        ADMIN -.-> TA2
        ADMIN -.-> TB1
        ADMIN -.-> TB2
    end
    
    UA -.X TB1
    UA -.X TB2
    UB -.X TA1
    UB -.X TA2
```

### 2. Thread Locking Mechanism

The module implements a sophisticated locking system to prevent race conditions:

```python
@execute_with_new_cursor
def _lock(self):
    """
    Acquires lock with immediate commit to prevent concurrent generation.
    Uses a separate cursor to ensure lock visibility across transactions.
    """
    self.ensure_one()
    if self._read_is_locked_decorated():
        raise UserError(_("Thread is already generating a response"))
    self._write_vals_decorated({"is_locked": True})
```

**Security Benefits**:
- Prevents multiple simultaneous AI requests for the same thread
- Protects against resource exhaustion attacks
- Ensures data consistency during generation

### 3. Tool Execution Security

Tool execution is wrapped in savepoints for safe rollback:

```python
# Read-only tools skip savepoint for performance
if tool and tool.read_only_hint:
    result = thread._execute_tool(name, args)
else:
    # Savepoint isolates tool execution
    with self.env.cr.savepoint():
        result = thread._execute_tool(name, args)
```

**Security Features**:
- Tool errors don't corrupt the database transaction
- Malicious tools can't affect other data
- Read-only operations are optimized

### 4. Message Voting Security

Only AI-generated messages can be voted on:

```python
def set_user_vote(self, message_id, vote_value):
    message = self.env["mail.message"].browse(message_id)
    
    if message.is_llm_assistant_message() or message.is_llm_tool_result_message():
        message.sudo().write({"user_vote": vote_value})
    else:
        raise UserError(_("Voting is only allowed on AI messages"))
```

### 5. Controller Security

All controllers implement proper authentication and CSRF protection:

```python
@http.route("/llm/thread/generate", type="http", auth="user", csrf=True)
# auth="user" - Requires authenticated user
# csrf=True - Protects against CSRF attacks
```

### 6. Input Validation

The module validates all user inputs:

```python
# Thread ID validation
thread = request.env["llm.thread"].browse(thread_id)
if not thread.exists():
    raise MissingError(_("LLM Thread not found."))

# Vote value validation
if vote_value not in [-1, 0, 1]:
    raise ValidationError(_("Invalid vote value"))
```

## API Security

### RPC Method Access

The `send_message` method is exposed for RPC calls but respects access rights:

```python
def send_message(self, message_content):
    """
    RPC-exposed method that respects security rules.
    Users can only send messages to their own threads.
    """
    self.ensure_one()  # Ensures record exists and user has access
    # ... send message logic
```

### Streaming Security

Server-Sent Events implementation includes:

1. **Connection Management**: Proper cleanup on client disconnect
2. **Resource Protection**: Thread unlocking on connection loss
3. **Error Isolation**: Errors sent to specific client only

## Related Record Security

When threads are linked to other Odoo records:

```python
thread = self.env['llm.thread'].create({
    'model': 'sale.order',
    'res_id': sale_order.id,
    # ...
})
```

The module respects the security of the related model:
- Users need access to both the thread AND the related record
- Related record access is checked when displaying context

## Best Practices for Extensions

When extending the module, follow these security guidelines:

### 1. Always Check Permissions

```python
# Good
def custom_method(self):
    self.ensure_one()  # Triggers access rights check
    # ... method logic

# Bad
def custom_method(self):
    self.sudo()  # Bypasses security - avoid unless necessary
    # ... method logic
```

### 2. Validate User Input

```python
# Good
@api.model
def process_user_data(self, data):
    if not isinstance(data, dict):
        raise ValidationError(_("Invalid data format"))
    
    allowed_fields = ['name', 'description']
    cleaned_data = {k: v for k, v in data.items() if k in allowed_fields}
    # ... process cleaned data

# Bad
@api.model
def process_user_data(self, data):
    self.write(data)  # Dangerous - allows any field update
```

### 3. Use Savepoints for External Operations

```python
# Good
def call_external_api(self):
    with self.env.cr.savepoint():
        try:
            result = external_api.call()
            self.process_result(result)
        except Exception as e:
            # Automatic rollback to savepoint
            raise UserError(_("External API failed: %s") % str(e))
```

### 4. Implement Rate Limiting

For resource-intensive operations:

```python
from odoo.tools import mute_logger
from datetime import datetime, timedelta

def check_rate_limit(self):
    last_generation = self.env.user.last_llm_generation
    if last_generation and datetime.now() - last_generation < timedelta(seconds=10):
        raise UserError(_("Please wait before generating another response"))
```

## Security Audit Checklist

When reviewing security:

- [ ] All controllers have proper `auth` parameter
- [ ] CSRF protection enabled on state-changing endpoints
- [ ] User input is validated and sanitized
- [ ] SQL injection is prevented (use ORM, not raw SQL)
- [ ] XSS prevention (use `markupsafe.Markup` carefully)
- [ ] Access rights properly configured
- [ ] Record rules implement proper domain filters
- [ ] Sensitive operations use savepoints
- [ ] Error messages don't leak sensitive information
- [ ] Rate limiting implemented where needed

## Common Security Pitfalls

### 1. Sudo Abuse

```python
# Avoid
messages = self.env['mail.message'].sudo().search([])  # Bypasses all security

# Prefer
messages = self.env['mail.message'].search([])  # Respects access rights
```

### 2. Unsafe Dynamic Execution

```python
# Never do this
eval(user_provided_code)  # Code injection vulnerability

# Safe alternative
allowed_operations = {'sum': sum, 'len': len}
if operation in allowed_operations:
    result = allowed_operations[operation](data)
```

### 3. Information Disclosure

```python
# Bad - Reveals system information
except Exception as e:
    raise UserError(str(e))  # May contain sensitive details

# Good - Generic user-facing error
except Exception as e:
    _logger.error("Detailed error: %s", str(e))  # Log full details
    raise UserError(_("An error occurred. Please contact support."))
```