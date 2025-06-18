# Document Parsing with AI Parser - Docling

This guide explains how to use the AI Parser - Docling to extract structured content from documents in the LLM Resource module.

## Overview

Docling is a powerful AI-powered document processing library that provides advanced capabilities for extracting structured content from various document formats. It preserves document hierarchy, semantic structure, tables, images, and other layout elements.

## Requirements

- Install the Docling library and dependencies:
  ```
  pip install docling pandas
  ```

- System requirements:
  - 4GB+ RAM recommended
  - x86_64 architecture preferred (may have compatibility issues on ARM64)
  - Sufficient disk space for temporary files during processing

## Using the AI Parser - Docling

### Setting the Parser for New Resources

When creating a new LLM Resource, you can select "AI Parser - Docling" from the Parser dropdown:

1. Navigate to LLM Resources
2. Click "Create"
3. Fill in the required information
4. Select "AI Parser - Docling" in the Parser field
5. Save and process the resource

### Updating Existing Resources

To change the parser for an existing resource:

1. Navigate to the resource
2. Edit the resource
3. Change the Parser field to "AI Parser - Docling"
4. Save the changes
5. Re-process the resource to apply the new parser

### Batch Processing with Docling

To update multiple resources to use the AI Parser - Docling:

```python
# Example code to update multiple resources
resources = env['llm.resource'].search([('state', '=', 'retrieved')])
resources.write({'parser': 'docling'})
resources.parse()
```

## Supported Document Types

The AI Parser - Docling handles various document formats, including:

- PDF documents
- Word documents (DOCX)
- PowerPoint presentations (PPTX)
- HTML content
- Plain text
- RTF documents
- And more

## Advanced Features

- **Layout Analysis**: Understands document structure and layout elements
- **Table Extraction**: Preserves table structure and content
- **Image Recognition**: Extracts and processes images with context
- **Semantic Understanding**: Recognizes headings, lists, and other semantic elements
- **Document Hierarchy**: Preserves document structure in output

## Troubleshooting

### Error: Library not available

If you see "Docling library is not installed", install the required dependencies:

```
pip install docling pandas
```

### Error: Memory Issues

If the parser fails due to memory constraints, consider:

- Processing smaller documents
- Increasing system memory
- Using an alternative parser for large documents

### ARM64 Architecture Issues

Some Docling dependencies (like scipy, OpenCV, transformers) may have compatibility issues on ARM64 architectures. If you encounter problems:

1. Try using the "Smart Parser" instead, which provides advanced features without the ARM64 compatibility issues
2. Consider running on an x86_64 system for full Docling functionality

## No Automatic Fallback

Note: The system does not automatically fall back to another parser if AI Parser - Docling fails. If an error occurs during parsing, you will need to manually select a different parser and reprocess the document.
