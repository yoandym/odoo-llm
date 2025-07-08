# Installation Guide

This guide covers the installation and setup of the LLM Core module.

## Prerequisites

- Odoo 17.0 or higher
- Python 3.9+
- Access to install Python packages

## Installation Steps

1. **Install the module**
   
   Install the LLM Core module from the Apps menu in Odoo.

2. **Install Python Dependencies**
   
   ```bash
   pip install -r requirements.txt
   ```
   
   Key dependencies include:
   - requests
   - pydantic
   - python-dotenv

3. **Configure Environment**
   
   Set up your environment variables for API keys and endpoints:
   
   ```
   # .env file example
   OPENAI_API_KEY=your_api_key
   ANTHROPIC_API_KEY=your_api_key
   ```

## Configuration

### Provider Configuration

Configure LLM providers through the UI:

1. Navigate to Settings > LLM > Providers
2. Add credentials for each provider you plan to use
3. Test connections to ensure they work properly

## Troubleshooting

Common installation issues:

- **Missing dependencies**: Ensure all Python packages are installed
- **API key errors**: Verify your API keys are correct and properly configured
- **Permission issues**: Verify user access rights
