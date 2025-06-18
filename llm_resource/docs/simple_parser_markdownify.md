# Document Parsing with Simple Parser - Markdownify

This guide explains how to use the Simple Parser - Markdownify to convert content to markdown format in the LLM Resource module.

## Overview

Simple Parser - Markdownify is the default parser in the LLM Resource module. It's designed for efficient and lightweight processing of HTML and text content, converting it to clean markdown format.

## Requirements

- Install the Markdownify library:
  ```
  pip install markdownify
  ```

- System requirements:
  - Low memory usage
  - Works on all architectures

## Using Simple Parser - Markdownify

### Setting the Parser for New Resources

When creating a new LLM Resource, "Simple Parser - Markdownify" is the default selection in the Parser dropdown:

1. Navigate to LLM Resources
2. Click "Create"
3. Fill in the required information
4. "Simple Parser - Markdownify" should be selected by default
5. Save and process the resource

### Updating Existing Resources

To change the parser for an existing resource:

1. Navigate to the resource
2. Edit the resource
3. Change the Parser field to "Simple Parser - Markdownify"
4. Save the changes
5. Re-process the resource to apply the new parser

### Batch Processing with Markdownify

To update multiple resources to use Simple Parser - Markdownify:

```python
# Example code to update multiple resources
resources = env['llm.resource'].search([('state', '=', 'retrieved')])
resources.write({'parser': 'default'})
resources.parse()
```

## Supported Content Types

Simple Parser - Markdownify works best with:

- HTML content
- Plain text
- Simple web pages
- Basic document structures

## Features

- **HTML Conversion**: Transforms HTML tags to equivalent markdown
- **Text Preservation**: Maintains text content and basic formatting
- **Link Processing**: Preserves hyperlinks in markdown format
- **Lightweight Processing**: Minimal resource requirements
- **Fast Execution**: Quick parsing of documents

## Limitations

- Limited handling of complex document layouts
- No table structure preservation (tables become plain text)
- No image extraction
- Limited formatting options

## When to Use Simple Parser - Markdownify

This parser is ideal for:

- Simple text documents
- Web content and articles
- Email content
- Basic HTML files
- Systems with limited resources
- Quick processing requirements

## Troubleshooting

### Basic HTML Elements Not Converting

If HTML elements aren't converting properly:

1. Check that the content is valid HTML
2. Some complex HTML structures may not convert perfectly

### No Automatic Fallback

Note: The system does not automatically fall back to another parser if Simple Parser - Markdownify fails. If an error occurs during parsing, you will need to manually select a different parser and reprocess the document.
