# Architecture

The LLM Thread module provides a comprehensive AI chat integration for Odoo, enabling real-time conversations with multiple AI providers while leveraging Odoo's native components and architecture.

## High-Level Overview

The module follows Odoo's MVC architecture and integrates deeply with Odoo's mail system to provide AI chat capabilities. It supports multiple AI providers (OpenAI, Anthropic, Grok, Ollama, DeepSeek) and enables real-time streaming responses with tool/function calling capabilities.

```{mermaid}
graph TB
    subgraph "Frontend Layer"
        UI[Chat UI Components]
        CS[Chat Service]
        CA[Client Actions]
    end
    
    subgraph "Backend Layer"
        CTRL[Controllers]
        MODELS[Models]
        SEC[Security]
    end
    
    subgraph "Integration Layer"
        MAIL[Mail System]
        LLM[LLM Base Module]
        TOOLS[LLM Tools]
    end
    
    subgraph "External"
        AI[AI Providers]
    end
    
    UI --> CS
    CS --> CA
    CA --> CTRL
    CTRL --> MODELS
    MODELS --> MAIL
    MODELS --> LLM
    MODELS --> TOOLS
    LLM --> AI
```

## Core Design Principles

1. **Native Odoo Integration**: The module extends Odoo's mail system rather than creating a separate messaging infrastructure
2. **Service-Oriented Frontend**: Uses OWL's service pattern for centralized state management
3. **Streaming Architecture**: Real-time responses using Server-Sent Events (SSE)
4. **Modular Tool System**: Extensible tool/function calling framework
5. **Multi-Provider Support**: Abstracted provider interface for AI flexibility

## Module Structure

```
llm_thread/
├── models/              # Backend models extending mail system
├── controllers/         # HTTP endpoints for streaming and operations
├── static/src/
│   ├── components/      # OWL UI components
│   ├── services/        # Frontend services
│   └── core/           # Core patches and extensions
├── security/           # Access control and permissions
└── views/              # XML views and menus
```

## Integration Architecture

The module integrates with several Odoo modules to provide its functionality:

```{mermaid}
graph BT
    LLM_THREAD[llm_thread<br/>AI Chat Module]
    BASE[base<br/>Core Framework]
    MAIL[mail<br/>Messaging System]
    WEB[web<br/>Web Framework]
    LLM[llm<br/>Provider Management]
    LLM_TOOL[llm_tool<br/>Tool System]
    LLM_MSG[llm_mail_message_subtypes<br/>Message Types]
    
    LLM_THREAD --> BASE
    LLM_THREAD --> MAIL
    LLM_THREAD --> WEB
    LLM_THREAD --> LLM
    LLM_THREAD --> LLM_TOOL
    LLM_THREAD --> LLM_MSG
```

## Key Architectural Decisions

### 1. Mail System Extension
Instead of building a custom messaging system, the module extends Odoo's `mail.thread` and `mail.message` models. This provides:
- Existing UI components and views
- Activity tracking and notifications
- Attachment handling
- Search and filtering capabilities

### 2. Streaming Over Polling
The module uses Server-Sent Events for real-time streaming rather than polling or websockets:
- Lower server resource usage
- Better compatibility with proxies
- Natural fit for one-way data flow
- Built-in reconnection handling

### 3. Service-Based State Management
Frontend state is managed through a centralized service (`LLMChatService`) rather than component-level state:
- Single source of truth
- Easier testing and debugging
- Better performance with OWL's reactive system
- Simplified component communication

### 4. Tool Abstraction
Tools are implemented as separate records with a unified interface:
- Dynamic tool loading per thread
- Extensible without code changes
- Permission-based tool access
- Automatic result handling

## Data Flow Overview

```{mermaid}
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant AI
    
    User->>Frontend: Send Message
    Frontend->>Backend: HTTP Request
    Backend->>Backend: Lock Thread
    Backend->>AI: Stream Request
    
    loop Streaming
        AI-->>Backend: Content/Tools
        Backend-->>Frontend: SSE Event
        Frontend-->>User: Update UI
    end
    
    Backend->>Backend: Unlock Thread
    Backend-->>Frontend: Complete
```

## Extension Points

The module is designed to be extended through:

1. **Custom Tools**: Add new AI capabilities via the tool system
2. **Message Hooks**: Pre/post-processing of messages
3. **UI Components**: Override or extend frontend components
4. **Provider Integration**: Add new AI providers through the base module

## Component Documentation

For detailed documentation on specific components:

- **Backend Models**: See [models.md](./models.md)
- **Controllers**: See [controllers.md](./controllers.md)
- **Frontend Components**: See [js-components.md](./js-components.md)
- **Security**: See [security.md](./security.md)
- **Performance**: See [performance.md](./performance.md)
- **Extension Guide**: See [extending.md](./extending.md)