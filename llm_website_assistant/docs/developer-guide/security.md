
# Security Documentation

This module implements security measures to safely expose LLM assistants to website visitors while maintaining control over access and data.

## Security Architecture

```{mermaid}
graph TB
    subgraph "Public Access Layer"
        WV[Website Visitors]
        PC[Public Controllers]
    end
    
    subgraph "Security Controls"
        UUID[UUID Validation]
        VIS[Visibility Checks]
        KC[Knowledge Control]
        SUDO[Sudo Operations]
    end
    
    subgraph "Protected Resources"
        LA[LLM Assistants]
        LK[Knowledge Collections]
        DC[Discuss Channels]
        MSG[Messages]
    end
    
    WV -->|Request| PC
    PC -->|Validates| UUID
    PC -->|Checks| VIS
    VIS -->|Filters| LA
    LA -->|Restricted by| KC
    KC -->|Access| LK
    UUID -->|Protects| DC
    SUDO -->|Creates| MSG
    
    classDef public fill:#ffebee,stroke:#c62828
    classDef control fill:#e8f5e9,stroke:#2e7d32
    classDef resource fill:#e3f2fd,stroke:#1565c0
    
    class WV,PC public
    class UUID,VIS,KC,SUDO control
    class LA,LK,DC,MSG resource
```

## Access Control Implementation

### 1. Public Endpoint Security

#### Controller Authentication
```python
@http.route('/im_livechat/init', type='json', auth='public')
@http.route('/chatbot/step/process', type='json', auth='public', cors='*')
```

**Security Measures:**
- `auth='public'`: Allows unauthenticated access
- Channel UUID validation prevents unauthorized access
- CORS enabled for embedded widgets

#### Channel Validation
```python
discuss_channel = request.env['discuss.channel']\
    .sudo()\
    .search([('uuid', '=', channel_uuid)], limit=1)

if not discuss_channel:
    return None
```

### 2. Assistant Visibility Control

#### Model-Level Security
```python
# llm.assistant
is_website_visible = fields.Boolean(
    string="Available on public Website",
    default=False,  # Secure by default
    tracking=True,  # Audit trail
)
```

#### Domain Filtering
```python
# chatbot.script
llm_assistant_id = fields.Many2one(
    "llm.assistant",
    domain="[('is_website_visible', '=', True)]"
)
```

### 3. Knowledge Access Restrictions

```python
# llm.assistant
allowed_knowledge_collection_ids = fields.Many2many(
    "llm.knowledge.collection",
    string="Allowed Knowledge Collections",
    help="Knowledge collections that this assistant can access."
)
```

**Implementation:**
- Empty = No knowledge access (secure default)
- Explicitly grant collections
- Enforced at tool execution level

### 4. Sudo Usage Pattern

```python
# Correct pattern for public operations
def process_llm_step(self, discuss_channel, user_input):
    # Search with sudo for public access
    thread = self.env["llm.thread"].sudo().search([
        ("res_id", "=", discuss_channel.id),
        ("model", "=", "discuss.channel"),
    ], limit=1)
    
    if not thread:
        # Create with sudo and context marker
        thread = self.env["llm.thread"]\
            .sudo()\
            .with_context(from_website_livechat=True)\
            .create({...})
    
    # Operations on thread use sudo
    thread.sudo().add_user_message(plaintext_message)
```

## Security Rules (ir.model.access.csv)

The module inherits access rights from dependencies:

# From im_livechat
chatbot.script - Public read via website user
chatbot.script.step - Public read via website user
discuss.channel - Created with sudo for visitors

# From llm_assistant  
llm.assistant - No public access, filtered by code
llm.thread - Created/accessed with sudo
llm.tool - Executed with sudo in context

## Data Isolation

### Session Isolation
```python
# Each chat session has unique UUID
channel_uuid = str(uuid.uuid4())

# Thread linked to specific channel
thread = self.env["llm.thread"].create({
    "res_id": discuss_channel.id,
    "model": "discuss.channel",
    "source": "website_livechat"
})
```

### Message Privacy
```python
# Messages posted with specific context
context = {"mail_create_nosubscribe": True}
discuss_channel.with_context(**context).message_post(
    author_id=chatbot_operator_id,
    body=response_html,
    message_type="comment",
    subtype_xmlid="mail.mt_comment"
)
```

## Security Threats and Mitigations

### 1. Unauthorized Assistant Access

**Threat:** Visitor tries to use non-public assistant

**Mitigation:**
```python
if not self.chatbot_script_id.llm_assistant_id.is_website_visible:
    return "Assistant not available"
```

### 2. Knowledge Data Leakage

**Threat:** Assistant accesses unauthorized knowledge

**Mitigation:**
```python
# In tool execution
if collection not in assistant.allowed_knowledge_collection_ids:
    raise AccessError("Knowledge collection not allowed")
```

### 3. Channel Hijacking

**Threat:** Attacker guesses channel UUID

**Mitigation:**
- UUIDs are cryptographically random
- Channels expire after inactivity
- No sensitive data in channel itself

### 4. Prompt Injection

**Threat:** Malicious prompts to extract data

**Mitigation:**
- System prompts define boundaries
- Knowledge access restrictions
- Tool execution validation

## Best Practices

### 1. Secure Defaults
```python
is_website_visible = fields.Boolean(default=False)
allowed_knowledge_collection_ids = fields.Many2many()  # Empty by default
```

### 2. Explicit Sudo Usage
```python
# Good: Specific sudo for public operations
thread = self.env['llm.thread'].sudo().create({...})

# Bad: Blanket sudo on self
self.sudo().process_message(...)
```

### 3. Context Markers
```python
# Mark operations from website
.with_context(from_website_livechat=True)
```

### 4. Audit Trails
```python
# Track security-relevant changes
is_website_visible = fields.Boolean(tracking=True)
```

## Security Checklist

- [ ] All public endpoints validate channel UUID
- [ ] Assistants require `is_website_visible=True`
- [ ] Knowledge collections explicitly allowed
- [ ] Sudo used only where necessary
- [ ] No sensitive data in public responses
- [ ] Error messages don't leak information
- [ ] All changes to visibility are tracked
- [ ] Session data properly isolated
- [ ] Tools validate permissions before execution
- [ ] System prompts enforce boundaries

## Monitoring and Logging

```python
import logging
_logger = logging.getLogger(__name__)

# Log security-relevant events
_logger.info(f"LLM chat session created for visitor {anonymous_name}")
_logger.warning(f"Unauthorized assistant access attempt: {assistant_id}")
_logger.error(f"Security validation failed for channel {channel_uuid}")
```

## Emergency Response

If security breach suspected:

1. **Disable Public Access**
   ```python
   # Set all assistants to non-visible
   self.env['llm.assistant'].search([]).write({'is_website_visible': False})
   ```

2. **Review Audit Logs**
   - Check message history
   - Review thread creation logs
   - Analyze tool execution history

3. **Revoke Compromised Sessions**
   ```python
   # Close active channels
   suspect_channels = self.env['discuss.channel'].search([
       ('channel_type', '=', 'livechat'),
       ('create_date', '>=', suspect_time)
   ])
   suspect_channels.unlink()
   ```