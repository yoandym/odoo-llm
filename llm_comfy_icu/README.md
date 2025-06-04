# LLM ComfyICU Integration

This module integrates Odoo with the ComfyICU API for media generation capabilities.

## Features

- Adds ComfyICU as a provider option in the LLM framework
- Supports media generation through ComfyICU workflows
- Follows the same provider model pattern as other LLM integrations

## Configuration

1. Install the module
2. Create a provider with type "ComfyICU"
3. Configure the API key
4. Create models with the appropriate workflow IDs

## Security

This module follows the standard two-tier security model:

- Regular users (base.group_user) have read-only access to models
- LLM Managers (llm.group_llm_manager) have full CRUD access
