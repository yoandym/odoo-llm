# User Guide

This guide provides detailed instructions for using the LLM Knowledge module.

## Overview

The LLM Knowledge module allows you to create and manage knowledge collections that can be used to enhance LLM responses with domain-specific information.

## Knowledge Collections

### Creating a Collection

1. Navigate to LLM > Knowledge > Collections
2. Click "Create"
3. Provide a name and description
4. Select an embedding model
5. Choose default chunking strategy
6. Save the collection

### Adding Resources

Resources can be added to collections in several ways:

1. **Upload files directly**:
   - In the collection view, click "Add Resources"
   - Select files to upload
   - Configure processing options
   - Click "Upload"

2. **Add existing resources**:
   - Navigate to the Resources tab
   - Select resources
   - Click "Add to Collection"

3. **Create resources manually**:
   - Navigate to LLM > Knowledge > Resources
   - Create a new resource
   - Add content directly
   - Assign to collections

## Search and Retrieval

### Basic Search

1. Open a collection
2. Use the search bar at the top
3. Enter your query
4. View results ranked by relevance

### Advanced Search

1. Click "Advanced Search" in the collection view
2. Configure search parameters:
   - Similarity threshold
   - Number of results
   - Include metadata
   - Filter by tags
3. Run the search

## Integration with Assistants

### Setting up Knowledge for Assistants

1. Create an assistant (LLM > Assistants)
2. In the Knowledge tab, add collections
3. Configure retrieval settings
4. Save changes

### Testing Knowledge Integration

1. Open the assistant chat
2. Ask questions related to your knowledge
3. Observe how the assistant incorporates information

## Maintenance

### Refreshing Embeddings

If you change the embedding model:

1. Open the collection
2. Click "Actions > Refresh Embeddings"
3. Confirm the operation

### Collection Analytics

Monitor collection usage:

1. Open the collection
2. Navigate to the Analytics tab
3. View usage statistics and search patterns
