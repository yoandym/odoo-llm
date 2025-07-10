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

