# LLM ComfyUI Integration

This module integrates Odoo with the ComfyUI API for AI image generation. It provides a new provider type that can be used with the LLM framework.

## Features

- Connect to any ComfyUI instance via its HTTP API
- Submit ComfyUI workflows for execution
- Retrieve generated images
- Integrate with the LLM framework for media generation

## Configuration

1. Go to LLM > Configuration > Providers
2. Create a new provider with service type "ComfyUI"
3. Set the API Base URL to your ComfyUI instance (e.g., `http://localhost:8188`)
4. Optionally set an API key if your ComfyUI instance requires authentication
5. Create a model that uses this provider

## Usage

The module expects ComfyUI workflow JSON in the API format. You can obtain this by using the "Save (API Format)" button in the ComfyUI interface (requires "Dev mode options" to be enabled in settings).

## Security

This module follows the standard two-tier security model:

- Regular users (base.group_user) have read-only access
- LLM Managers (llm.group_llm_manager) have full CRUD access
