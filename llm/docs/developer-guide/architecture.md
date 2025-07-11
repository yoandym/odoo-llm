# Architecture Overview

The LLM module provides a foundation for integrating various Large Language Model (LLM) providers into Odoo. It follows a modular, extensible architecture that enables seamless integration with providers like OpenAI, Anthropic, Ollama, and Replicate.

## Design Principles

### 1. Provider Abstraction
The module uses a **dispatch pattern** to abstract provider-specific implementations:

> **Dispatch Pattern:**
> A design approach where a base model (here, `llm.provider`) defines a generic method (e.g., `_dispatch()`), which dynamically calls provider-specific implementations based on the provider's `service` field. This allows new providers to be added by simply implementing methods named `{service}_{method}` (e.g., `openai_chat`, `ollama_chat`), without changing the base logic. The pattern enables flexible, modular integration and easy extension for new services.

- Base `llm.provider` model defines the common interface
- Provider-specific methods follow naming convention: `{service}_{method}`
- Dynamic method dispatch via `_dispatch()` method

### 2. Model-Provider-Publisher Separation
- **Models** (`llm.model`): Individual AI models with their configurations
- **Providers** (`llm.provider`): Service connections and API management
- **Publishers** (`llm.publisher`): Organizations that create/publish models

### 3. Extensibility
- New providers can be added by implementing service-specific methods
- Models support custom parameters via JSON fields
- Views use standard Odoo inheritance for customization

## Component Architecture

```{mermaid}
:zoom:
graph TB
    subgraph "Wizard Layer"
        W1[Fetch Models Wizard]
    end
    subgraph "Core Models Layer"
        M1[llm.provider]
        M2[llm.model]
        M3[llm.publisher]
    end
    subgraph "Provider Services Layer"
        S1[Ollama]
        S2[OpenAI]
        S3[Anthropic/Replicate]
    end
    W1 --> M1
    W1 --> M2
    W1 --> M3
    M1 --> S1
    M1 --> S2
    M1 --> S3
    M2 -.->|belongs to| M1
    M2 -.->|published by| M3
    %% Wizard description as a comment for clarity
    %% Discovers available models, compares with existing, imports/updates configs
    classDef wizardClass fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef modelClass fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef serviceClass fill:#fff3e0,stroke:#e65100,stroke-width:2px
    class W1 wizardClass
    class M1,M2,M3 modelClass
    class S1,S2,S3 serviceClass
```

## Key Features

### 1. Model Management
- **Model Discovery**: Automatic fetching of available models from providers
- **Model Configuration**: Detailed parameters for each model including:
  - Context window size
  - Temperature, Top-P, Top-K settings
  - Repeat penalty
  - Request timeout
  - Custom parameters via JSON

### 2. Provider Management
- **Multi-Provider Support**: Unified interface for different LLM services
- **API Key Management**: Secure storage of provider credentials
- **Company Isolation**: Multi-company support for provider configurations

### 3. Security Model
- **Role-Based Access**: 
  - Regular users: Read-only access to providers and models
  - LLM Managers: Full CRUD operations
- **Record Rules**: Automatic access control based on user groups

## Data Flow

### Model Discovery Flow

```{mermaid}
:zoom:
sequenceDiagram
    participant User
    participant UI as Provider Form View
    participant Wizard as Fetch Models Wizard
    participant Provider as llm.provider
    participant Service as Provider Service
    participant DB as Database
    
    User->>UI: Click "Fetch Models"
    UI->>Wizard: Open wizard
    Wizard->>Provider: list_models()
    Provider->>Service: _dispatch('models')
    Service->>Service: Call external API
    Service-->>Provider: Return model data
    Provider-->>Wizard: Models with details/metadata
    Wizard->>DB: Query existing models
    DB-->>Wizard: Existing model records
    Wizard->>Wizard: Compare & categorize
    Wizard->>User: Display models (new/existing/modified)
    User->>Wizard: Select models to import
    Wizard->>DB: Create/Update selected models
    DB-->>Wizard: Success
    Wizard->>User: Display success notification
```

### Chat/Completion Flow

```{mermaid}
:zoom:
sequenceDiagram
    participant Client
    participant Model as llm.model
    participant Provider as llm.provider
    participant Dispatcher as _dispatch()
    participant Service as Service Implementation
    participant API as External LLM API
    
    Client->>Model: chat(messages, **kwargs)
    Model->>Provider: chat(messages, model=self, **kwargs)
    Provider->>Provider: get_model() if needed
    Provider->>Dispatcher: _dispatch('chat', messages, ...)
    Dispatcher->>Service: {service}_chat(messages, ...)
    Service->>Service: format_messages()
    Service->>API: HTTP POST /chat/completions
    API-->>Service: Response (streaming or complete)
    Service-->>Dispatcher: Formatted response
    Dispatcher-->>Provider: Response object
    Provider-->>Model: Response
    Model-->>Client: Chat response
```

## Integration Points

### With Odoo Core
- **mail.thread**: Chatter integration for tracking changes
- **res.company**: Multi-company support
- **ir.model.access**: Access control management
- **ir.actions**: Wizard and action integration

### With Other Modules
- Provides base models for dependent modules
- Extensible through model inheritance
- Service methods can be overridden or extended

## Scalability Considerations

### Horizontal Scaling
- Provider abstraction allows load distribution
- Stateless design enables multiple Odoo instances
- API calls are independent and parallelizable

### Performance Optimization
- Model metadata cached in database
- Lazy loading of provider clients
- Configurable timeouts per model

---
For implementation details, see:
- [Models Guide](models.md) - Detailed model documentation
- [Views Guide](views.md) - UI components and customization
- [Extending Guide](extending.md) - How to add new providers