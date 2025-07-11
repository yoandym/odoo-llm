# Security Documentation

This section documents the security model and access control implementation in the LLM Integration Base module.

## Security Architecture

### Group-Based Access Control

The module implements a role-based security model with two primary user groups:

#### 1. Regular Users (`base.group_user`)
- **Read-only access** to all LLM resources
- Can view providers, models, and publishers
- Cannot create, modify, or delete any records
- Suitable for users who need to use LLM features but not configure them

#### 2. LLM Managers (`group_llm_manager`)
- **Full CRUD access** to all LLM resources
- Can manage providers, models, and publishers
- Can execute wizard actions (fetch models)
- Inherits from `base.group_user`
- Admin user is automatically added to this group

### Module Category

The module creates a dedicated category for LLM permissions:

```xml
<record id="module_category_llm" model="ir.module.category">
    <field name="name">LLM</field>
    <field name="description">Manage access to LLM features</field>
    <field name="sequence">25</field>
</record>
```

## Access Rights Matrix

### Model Access (`ir.model.access.csv`)

| Model | Group | Read | Write | Create | Delete |
|-------|-------|------|-------|--------|--------|
| llm.provider | Regular Users | ✓ | ✗ | ✗ | ✗ |
| llm.provider | LLM Managers | ✓ | ✓ | ✓ | ✓ |
| llm.model | Regular Users | ✓ | ✗ | ✗ | ✗ |
| llm.model | LLM Managers | ✓ | ✓ | ✓ | ✓ |
| llm.publisher | Regular Users | ✓ | ✗ | ✗ | ✗ |
| llm.publisher | LLM Managers | ✓ | ✓ | ✓ | ✓ |
| llm.fetch.models.wizard | LLM Managers | ✓ | ✓ | ✓ | ✓ |
| llm.fetch.models.line | LLM Managers | ✓ | ✓ | ✓ | ✓ |

### Record Rules

The module implements record rules to enforce access policies:

#### Provider Rules
```xml
<!-- Read-only for all users -->
<record id="llm_provider_rule_all" model="ir.rule">
    <field name="name">LLM Providers: read-only for all users</field>
    <field name="model_id" ref="model_llm_provider"/>
    <field name="domain_force">[(1, '=', 1)]</field>
    <field name="perm_read" eval="True"/>
    <field name="perm_write" eval="False"/>
    <field name="perm_create" eval="False"/>
    <field name="perm_unlink" eval="False"/>
    <field name="groups" eval="[(4, ref('base.group_user'))]"/>
</record>

<!-- Full access for managers -->
<record id="llm_provider_rule_manager" model="ir.rule">
    <field name="name">LLM Providers: full access for managers</field>
    <field name="model_id" ref="model_llm_provider"/>
    <field name="domain_force">[(1, '=', 1)]</field>
    <field name="perm_read" eval="True"/>
    <field name="perm_write" eval="True"/>
    <field name="perm_create" eval="True"/>
    <field name="perm_unlink" eval="True"/>
    <field name="groups" eval="[(4, ref('group_llm_manager'))]"/>
</record>
```

Similar rules apply to `llm.model` records.

## Data Protection

### API Key Security

1. **Storage**
   - API keys are stored in the `api_key` field of `llm.provider`
   - Field uses `password="True"` widget for masked display
   - Keys are never displayed in plain text in the UI

2. **Access Control**
   - Only LLM Managers can view/modify API keys
   - Keys are encrypted at rest (depends on Odoo configuration)

3. **Best Practices**
   - Use environment variables for production API keys
   - Rotate keys regularly
   - Audit access to provider records

### Multi-Company Isolation

Providers support multi-company configuration:
- Each provider linked to a specific company
- Users only see providers for their allowed companies
- Default company assignment prevents accidental cross-company access

## Security Considerations

### External API Calls

1. **Network Security**
   - All provider APIs should use HTTPS
   - Validate SSL certificates
   - Use secure API endpoints only

2. **Request Validation**
   - Sanitize user inputs before sending to providers
   - Implement request size limits
   - Use timeouts to prevent hanging requests

### Data Privacy

1. **Message Content**
   - Chat messages may contain sensitive information
   - Consider implementing data retention policies
   - Log API calls appropriately (without sensitive data)

2. **Model Information**
   - Model details may reveal internal configurations
   - Restrict model parameter access as needed

## Security Checklist

- [ ] API keys are never logged or displayed in plain text
- [ ] All external API calls use HTTPS
- [ ] User inputs are validated before API calls
- [ ] Access rights properly configured for all models
- [ ] Record rules enforce proper data isolation
- [ ] Sensitive operations require appropriate permissions
- [ ] Audit trails enabled for configuration changes
- [ ] Multi-company rules properly implemented
- [ ] Wizard access restricted to authorized users
- [ ] Error messages don't reveal sensitive information

---

For implementation details, see:
- `security/ir.model.access.csv`
- `security/llm_security.xml`