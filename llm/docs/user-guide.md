# User Guide

This guide provides detailed instructions for using the LLM Core module.

## Overview

The LLM Core module is the foundation for all LLM integrations in Odoo. It provides the base models and interfaces that other modules build upon.

## Provider Management

### Setting Up Providers

1. Navigate to Settings > LLM > Providers
2. Click "Create" to add a new provider
3. Select the provider type (OpenAI, Anthropic, etc.)
4. Enter your API credentials
5. Click "Test Connection" to verify
6. Save the provider configuration

### Model Configuration

1. Navigate to Settings > LLM > Models
2. Select the provider you want to configure
3. Choose the model (e.g., gpt-3.5-turbo, claude-3-opus)
4. Configure model parameters:
   - Temperature
   - Max tokens
   - Top P
   - Presence/Frequency penalty

## Message Handling

### Creating Messages

Messages can be created programmatically:

1. Use the `llm.message` model to create new messages
2. Associate messages with threads
3. Configure message attributes:
   - Content
   - Role (system, user, assistant)
   - Metadata

### Processing Messages

The LLM Core module handles:
- Message queueing
- Response formatting
- Token counting
- Error handling

## Prompt Templates

### Creating Templates

1. Navigate to LLM > Prompt Templates
2. Click "Create" to add a new template
3. Define your template with variables using `{{variable}}` syntax
4. Add descriptions for each variable
5. Save the template

### Using Templates

Templates can be used:
- In code via the `llm.prompt.template` model
- In the LLM chat interface
- In custom implementations

## Administration

### Monitoring Usage

1. Navigate to LLM > Usage Statistics
2. View usage by:
   - Provider
   - Model
   - User
   - Time period

### Managing API Keys

1. Navigate to Settings > LLM > Security
2. Manage API keys and access controls
3. Set up usage limits and quotas

## Integration

The LLM Core module provides integration points for other modules:

- Provider API
- Message processing hooks
- Event system
- Extensible model system
