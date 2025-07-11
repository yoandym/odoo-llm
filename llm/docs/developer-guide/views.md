# Views Documentation

This section lists the key views and actions provided or inherited by the LLM Integration Base module.

## Main Views
- **Provider Form View** (`llm_provider_view_form`): Manage provider details, API keys, and company assignment.
- **Provider Tree View** (`llm_provider_view_tree`): List all providers.
- **Model Form View** (`llm_model_view_form`): Configure model parameters, provider, and publisher.
- **Model Tree View** (`llm_model_view_tree`): List all models.
- **Publisher Form View** (`llm_publisher_view_form`): Manage publisher info and related models.
- **Publisher Tree View** (`llm_publisher_view_tree`): List all publishers.
- **Fetch Models Wizard** (`view_fetch_models_wizard`): Import and update models from providers.

## Key Actions
- **Fetch Models**: Wizard action to discover/import models from a provider.
- **Archive/Unarchive**: Toggle active status for providers, models, and publishers.

## Inherited Features
- **mail.thread**: Chatter integration for all main models.
- **Standard Odoo search, filter, and group-by**: For providers, models, and publishers.

---
For XML source code, see:
- `views/llm_provider_views.xml`
- `views/llm_model_views.xml`
- `views/llm_publisher_views.xml`
- `wizards/fetch_models_wizard.xml`