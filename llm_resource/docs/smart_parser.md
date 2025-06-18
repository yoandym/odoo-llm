# Document Parsing with Smart Parser

This guide explains how to use the Smart Parser to extract structured content from documents in the LLM Resource module.

## Overview

The Smart Parser is a versatile document processing solution that uses specialized libraries to extract text, tables, and images from various document formats. It provides a balance between advanced features and resource efficiency.

## Requirements

- Install the required libraries:
  ```
  pip install pymupdf python-docx python-pptx beautifulsoup4 camelot-py[cv] pandas
  ```

- System requirements:
  - Moderate memory usage (2GB+ RAM recommended)
  - Works on all architectures (x86_64, ARM64, etc.)

## Using the Smart Parser

### Setting the Parser for New Resources

When creating a new LLM Resource, you can select "Smart Parser" from the Parser dropdown:

1. Navigate to LLM Resources
2. Click "Create"
3. Fill in the required information
4. Select "Smart Parser" in the Parser field
5. Save and process the resource

### Updating Existing Resources

To change the parser for an existing resource:

1. Navigate to the resource
2. Edit the resource
3. Change the Parser field to "Smart Parser"
4. Save the changes
5. Re-process the resource to apply the new parser

### Batch Processing with Smart Parser

To update multiple resources to use the Smart Parser:

```python
# Example code to update multiple resources
resources = env['llm.resource'].search([('state', '=', 'retrieved')])
resources.write({'parser': 'smart'})
resources.parse()
```

## Supported Document Types

The Smart Parser handles various document formats, including:

- PDF documents (using PyMuPDF and Camelot)
- Word documents (using python-docx)
- PowerPoint presentations (using python-pptx)
- HTML content (using BeautifulSoup)
- Plain text

## Format-Specific Features

### PDF Processing

- Text extraction with formatting preservation
- Table extraction using Camelot
- Image extraction and storage
- Page-by-page processing

### Word Documents (DOCX)

- Text extraction with formatting
- Table extraction
- Image extraction
- Document structure preservation

### PowerPoint Presentations (PPTX)

- Slide-by-slide extraction
- Text content extraction
- Shape and textbox processing
- Image extraction

### HTML Content

- Structure preservation
- Table extraction
- Image handling
- Link processing

## Troubleshooting

### Missing Libraries

If you see errors about missing libraries, install the required dependencies:

```
pip install pymupdf python-docx python-pptx beautifulsoup4 camelot-py[cv] pandas
```

### Table Extraction Issues

If table extraction fails:

1. Ensure you have all the dependencies for Camelot installed (including OpenCV)
2. Try with different table detection settings
3. Some complex tables may not be detected correctly

### No Automatic Fallback

Note: The system does not automatically fall back to another parser if Smart Parser fails. If an error occurs during parsing, you will need to manually select a different parser and reprocess the document.
