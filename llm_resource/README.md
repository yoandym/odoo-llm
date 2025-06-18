# LLM Resource

This Odoo module provides base document resource management for LLM modules, enabling Retrieval Augmented Generation (RAG) capabilities.

## Features

- **Resource Management**: Base document resource model for tracking and managing various document types
- **Flexible Retrieval**: Extensible retrieval interfaces for different content sources
- **Content Parsing**: Intelligent parsing of various content types into markdown format
- **HTTP Retrieval**: Built-in support for retrieving content from external URLs
- **Process Pipeline**: Structured workflow for retrieving, parsing, and managing resources

## Installation

1. Clone the repository into your Odoo addons directory.
2. Install the module via the Odoo Apps menu.
3. Install the required Python packages:
   ```
   pip install docling pandas markdownify pymupdf python-docx python-pptx beautifulsoup4 camelot-py[cv]
   ```

## Document Parsers

The module provides different parsers to convert retrieved content into markdown format:

1. **Simple Parser - Markdownify**: (Default) Basic parser for HTML and plain text with low resource requirements
2. **Smart Parser**: Advanced parser using specialized libraries to extract text, tables and images from various document formats
3. **Smart Parser - Docling**: AI-powered parser with advanced layout analysis (requires significant system resources)
4. **JSON Parser**: Specialized parser for JSON content

### Parser Selection Guide

Choose the appropriate parser based on your document complexity and system resources:

| Parser | Best for | Resource Requirements | Formats | Features |
|--------|---------|---------------------|---------|----------|
| Simple Parser - Markdownify | Simple documents, web content | Low | HTML, Text | Basic text extraction |
| Smart Parser | Most document types | Moderate | PDF, DOCX, PPTX, HTML | Tables and images extraction |
| Smart Parser - Docling | Complex layouts | High (4GB+ RAM) | PDF, DOCX, PPTX, HTML | Advanced layout analysis, semantic understanding |
| JSON Parser | API responses, data files | Low | JSON | Structured data formatting |

### Smart Parser Features

The Smart Parser provides enhanced document processing using specialized libraries:

- **PDF processing**: Uses PyMuPDF for text/image extraction and Camelot for table extraction
- **Word documents**: Uses python-docx to extract text, tables, and images
- **PowerPoint files**: Uses python-pptx to extract slides, text, and images
- **HTML content**: Uses BeautifulSoup for structure preservation and content extraction
- **Table extraction**: Converts tables to markdown format
- **Image handling**: Extracts and stores images from documents

### Docling Parser Features

The Docling parser provides AI-powered document processing capabilities:

- **Structured extraction**: Preserves document hierarchy and semantic structure
- **Table recognition**: Extracts tables with their structure intact
- **Multiple format support**: Works with PDF, DOCX, PPTX, HTML, and more
- **Image extraction**: Preserves images and figures with their captions
- **Layout analysis**: Recognizes headers, footers, and other layout elements

Note: The Docling parser requires significant system resources and may not work on ARM64 systems due to dependency constraints.

## Configuration

No special configuration is needed after installation. The module will be available for use by other LLM modules.

## Usage

### Creating Resources

Resources can be created from various sources:

1. From Odoo records using the model and record ID
2. From external URLs using the HTTP retriever
3. Programmatically through the API

### Processing Resources

Resources go through a defined processing pipeline:

1. **Retrieval**: Content is retrieved from the source (draft → retrieved)
2. **Parsing**: Content is parsed into markdown format (retrieved → parsed)

### Extending for Custom Models

To make your custom models compatible with LLM Resource:

1. Implement the `llm_get_retrieval_details` method to provide retrieval information
2. Optionally implement `llm_get_fields` to customize field extraction

```python
def llm_get_retrieval_details(self):
    """Return retrieval details for this record"""
    return {
        "type": "url",  # or other type
        "url": self.external_url,
        # other details as needed
    }
```

## Dependencies

- Odoo 16.0 or later
- Python 3.8 or later
- Python libraries:
  - requests
  - markdownify

## Contributing

Contributions are welcome! Please follow the contribution guidelines in the repository.

## License

This module is licensed under the LGPL-3 license.
