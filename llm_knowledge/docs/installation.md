# Installation Guide

This guide covers the installation and setup of the LLM Knowledge module.

## Prerequisites

- Odoo 17.0 or higher
- Python 3.9+
- Access to install Python packages

## Installation Steps

1. **Install the module**
   
   Install the LLM Knowledge module from the Apps menu in Odoo.

2. **Install Python Dependencies**
   
   ```bash
   pip install -r requirements.txt
   ```
   
   Key dependencies include:
   - sentence-transformers
   - numpy
   - scikit-learn

3. **Configure Embedding Models**
   
   Navigate to Settings > LLM > Embedding Models and configure at least one embedding model.

4. **Set Up Access Rights**
   
   Assign appropriate access rights to users who will manage knowledge collections.

## Configuration

### Embedding Models

The module supports various embedding models:

| Model | Description | Requirements |
|-------|-------------|-------------|
| Sentence Transformers | Open-source embeddings | 4GB+ RAM |
| OpenAI Embeddings | Cloud-based embeddings | API key |
| Mistral Embeddings | Self-hosted or cloud | API key optional |

### Storage Options

Configure your vector storage:

1. Navigate to Settings > LLM > Knowledge
2. Choose from:
   - Default database storage
   - External Qdrant storage
   - External ChromaDB storage

## Troubleshooting

Common installation issues:

- **Missing dependencies**: Ensure all Python packages are installed
- **Embedding errors**: Check model configuration and access
- **Permission issues**: Verify user access rights
