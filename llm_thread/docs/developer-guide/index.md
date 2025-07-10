# Developer Guide

## Overview

This guide provides comprehensive information for developers working with the Easy AI Chat module. Learn how to extend functionality, create custom tools, integrate with other modules, and build on top of the AI chat framework.

## Development Setup

### Prerequisites

```bash
# Development dependencies
pip install -r requirements-dev.txt

# Install pre-commit hooks
pre-commit install

# JavaScript dependencies
npm install
```

### Development Environment

1. **Enable Developer Mode** in Odoo
2. **Install developer tools**:
   ```bash
   pip install pytest pytest-odoo coverage
   ```
3. **Configure IDE** for Odoo development

## Contents

```{toctree}
:maxdepth: 3
:caption: Contents

architecture
models
views
controllers
js-components
performance
security
extending
testing
deployment
```

## Quick Links

- **Architecture**: Understanding the module structure and design
- **Models**: Backend models and their relationships
- **Controllers**: HTTP endpoints and streaming implementation
- **JS Components**: Frontend OWL components and services
- **Extending**: How to extend and customize the module
- **Security**: Access control and security considerations
- **Performance**: Optimization techniques and best practices

## Resources

- [Odoo Development Docs](https://www.odoo.com/documentation/17.0/developer.html)
- [OWL Documentation](https://github.com/odoo/owl)
- [AI Provider APIs](https://platform.openai.com/docs)
- [Module Repository](https://github.com/apexive/odoo-llm)









