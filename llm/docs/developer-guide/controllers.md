# Controllers

The LLM Integration Base module does not implement HTTP controllers directly. Instead, it provides core models and services that can be used by other modules to build API endpoints.

## Architecture Decision

The base module focuses on:
- Data models (`llm.provider`, `llm.model`, `llm.publisher`)
- Business logic and provider abstraction
- Security and access control

Controllers are implemented in dependent modules that need specific API functionality.
