# Models Documentation

This section provides detailed documentation for the core models in the LLM Integration Base module.

## llm.provider

### Overview
The `llm.provider` model manages connections to external AI service providers (OpenAI, Anthropic, Ollama, etc.). It implements a dispatch pattern for provider-specific functionality.

### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | Char (required) | Provider display name |
| `service` | Selection (required) | Provider service type (e.g., 'ollama', 'openai') |
| `active` | Boolean | Active/archived status |
| `company_id` | Many2one | Company isolation for multi-company setups |
| `api_key` | Char | API key for authentication (encrypted display) |
| `api_base` | Char | Base URL for API calls |
| `model_ids` | One2many | Related models from this provider |

### Key Methods

#### `client` (property)
Returns a configured client instance for the provider service.

#### `_dispatch(method, *args, record=None, **kwargs)`
Core dispatch mechanism that routes method calls to service-specific implementations.
- Pattern: `{service}_{method}` (e.g., `ollama_chat`, `openai_embedding`)
- Raises `NotImplementedError` if method not found

#### `chat(messages, model=None, stream=False, **kwargs)`
Sends chat messages to the provider.
- `messages`: List of message dictionaries
- `model`: Optional specific model to use
- `stream`: Enable streaming responses
- Returns: Provider response

#### `embedding(texts, model=None)`
Generates embeddings for given texts.
- `texts`: List of strings to embed
- `model`: Optional specific embedding model
- Returns: List of embedding vectors

#### `list_models(model_id=None)`
Fetches available models from the provider.
- `model_id`: Optional specific model to fetch
- Returns: List of model dictionaries with details

#### `get_model(model=None, model_use="chat")`
Retrieves appropriate model for a given use case.
- Falls back to default models if none specified
- Raises `ValueError` if no suitable model found

#### `format_messages(messages, system_prompt=None)`
Formats messages for provider-specific requirements.

### Constraints
- Provider names must be unique (case-insensitive)

---

## llm.model

### Overview
The `llm.model` represents individual AI models with their configurations, parameters, and capabilities.

### Key Fields

#### Basic Information
| Field | Type | Description |
|-------|------|-------------|
| `name` | Char (required) | Model identifier/name |
| `provider_id` | Many2one (required) | Link to provider |
| `publisher_id` | Many2one | Organization that published the model |
| `model_use` | Selection (required) | Type: chat/embedding/completion/multimodal |
| `default` | Boolean | Default model for its use type |
| `active` | Boolean | Active/archived status |

#### Model Metadata
| Field | Type | Description |
|-------|------|-------------|
| `details` | Json | Technical details from provider |
| `details_str` | Text (computed) | Formatted JSON display |
| `model_info` | Json | Additional metadata |
| `model_info_str` | Text (computed) | Formatted JSON display |
| `parameters` | Text | Custom parameters (JSON format) |
| `template` | Text | Model-specific prompt template |

#### Inference Parameters
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `context_window` | Integer | 4096 | Max tokens for input+output |
| `temperature` | Float | 0.7 | Creativity control (0.0-2.0) |
| `max_tokens` | Integer | 2048 | Max response length |
| `top_p` | Float | 0.9 | Nucleus sampling (0.0-1.0) |
| `top_k` | Integer | 40 | Top-K sampling |
| `repeat_penalty` | Float | 1.1 | Repetition penalty (1.0-2.0) |
| `request_timeout` | Float | 60.0 | Request timeout in seconds |

### Key Methods

#### `chat(messages, stream=False, **kwargs)`
Convenience method that delegates to provider's chat method.

#### `embedding(texts)`
Convenience method that delegates to provider's embedding method.

#### `action_open_fetch_this_model_wizard()`
Opens wizard to fetch latest model information from provider.

### Validation Rules
- Temperature: 0.0 ≤ value ≤ 2.0
- Top-P: 0.0 ≤ value ≤ 1.0
- Top-K: value ≥ 1
- Repeat Penalty: 1.0 ≤ value ≤ 2.0
- Context Window: value ≥ 1
- Max Tokens: value ≥ 1
- Parameters field must contain valid JSON if not empty

### Business Logic
- Only one model per provider/use combination can be marked as default
- When creating a default model, other defaults are automatically unset

---

## llm.publisher

### Overview
The `llm.publisher` model tracks organizations that create and publish AI models (e.g., OpenAI, Anthropic, Meta).

### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | Char (required) | Publisher name |
| `logo` | Image | Publisher logo (max 1024x1024) |
| `description` | Text | Publisher description |
| `meta` | Json | Additional metadata |
| `official` | Boolean | Official model publisher |
| `frontier` | Boolean | Working on frontier AI models |
| `model_ids` | One2many | Published models |
| `model_count` | Integer (computed) | Count of published models |

### Features
- Tracks model publishers for attribution
- Distinguishes official vs community publishers
- Identifies frontier AI research organizations
- Provides branding via logo field

---

## Transient Models (Wizards)

### llm.fetch.models.wizard

#### Overview
Wizard for discovering and importing models from providers.

#### Fields
| Field | Type | Description |
|-------|------|-------------|
| `provider_id` | Many2one (required) | Target provider |
| `line_ids` | One2many | Discovered models |
| `model_count` | Integer (computed) | Total models found |
| `new_count` | Integer (computed) | New models count |
| `modified_count` | Integer (computed) | Modified models count |
| `has_selectable_lines` | Boolean (computed) | Has importable models |

#### Workflow
1. Fetches available models from provider
2. Compares with existing models in database
3. Categorizes as: new, existing, or modified
4. User selects models to import/update
5. Creates or updates selected models

### llm.fetch.models.line

#### Overview
Represents a single model in the fetch wizard.

#### Fields
| Field | Type | Description |
|-------|------|-------------|
| `wizard_id` | Many2one (required) | Parent wizard |
| `name` | Char (required) | Model name |
| `model_use` | Selection | Model type |
| `status` | Selection | new/existing/modified |
| `selected` | Boolean | Selected for import |
| `details` | Json | Model details |
| `model_info` | Json | Model metadata |
| `existing_model_id` | Many2one | Link to existing model |

---

## Relationships Diagram

```{mermaid}
erDiagram
    llm_publisher ||--o{ llm_model : "publishes"
    llm_provider ||--o{ llm_model : "provides"
    
    llm_publisher {
        int id PK
        string name
        image logo
        text description
        json meta
        boolean official
        boolean frontier
    }
    
    llm_provider {
        int id PK
        string name
        string service
        string api_key
        string api_base
        boolean active
        int company_id FK
    }
    
    llm_model {
        int id PK
        string name
        int provider_id FK
        int publisher_id FK
        string model_use
        boolean default
        boolean active
        json details
        json model_info
        text parameters
        text template
        int context_window
        float temperature
        int max_tokens
        float top_p
        int top_k
        float repeat_penalty
        float request_timeout
    }
```

---

For implementation details and code examples, refer to:
- `models/llm_provider.py`
- `models/llm_model.py`
- `models/llm_publisher.py`
- `wizards/fetch_models_wizard.py`