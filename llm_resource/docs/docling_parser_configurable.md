# Document Parsing with AI Parser - Docling (Configurable)

This guide explains how to use the configurable AI Parser - Docling to extract structured content from documents with customizable processing options in the LLM Resource module.

## Overview

The configurable Docling parser provides advanced AI-powered document processing capabilities with extensive customization options. Based on the powerful Docling library, it allows you to fine-tune OCR settings, table extraction, GPU acceleration, and feature extraction to match your specific document processing needs.

## Key Features

- **Configurable OCR**: Enable/disable OCR with language selection and GPU acceleration options
- **Advanced Table Extraction**: Customizable table structure analysis and cell matching
- **Flexible Acceleration**: Choose between CPU, GPU, or automatic device selection
- **Feature Control**: Selectively extract tables, figures, and preserve document layout
- **Backend Selection**: Choose between different PDF processing backends
- **Performance Tuning**: Adjust thread count and processing options

## Requirements

- Install the Docling library and dependencies:
  ```
  pip install docling pandas
  ```

- System requirements:
  - 4GB+ RAM recommended (configurable based on options selected)
  - x86_64 architecture preferred (may have compatibility issues on ARM64)
  - Sufficient disk space for temporary files during processing
  - Optional: CUDA-compatible GPU for acceleration

## Configuration Options

### OCR Settings

| Option | Description | Default | Notes |
|--------|-------------|---------|--------|
| **Enable OCR** | Activate Optical Character Recognition | True | Essential for scanned documents |
| **OCR Language** | Language for text recognition | English | Supports 11 languages |
| **Use GPU for OCR** | GPU acceleration for OCR processing | True | Falls back to CPU if unavailable |

### Table Extraction

| Option | Description | Default | Notes |
|--------|-------------|---------|--------|
| **Extract Table Structure** | Analyze and preserve table layouts | True | Improves table recognition |
| **Enable Cell Matching** | Advanced cell boundary detection | True | Higher accuracy, more resources |
| **Extract Tables as Elements** | Save tables as separate elements | True | Better for downstream processing |

### Performance & Acceleration

| Option | Description | Default | Notes |
|--------|-------------|---------|--------|
| **Accelerator Device** | Processing device selection | Auto | Auto, CPU, CUDA, or MPS |
| **Number of Threads** | Parallel processing threads | 4 | Adjust based on system capacity |
| **PDF Backend** | PDF processing engine | Docling Parse | Docling Parse or PyPdfium |

### Feature Extraction

| Option | Description | Default | Notes |
|--------|-------------|---------|--------|
| **Extract Figures/Images** | Include images in output | True | Images stored as attachments |
| **Preserve Layout** | Maintain document structure | True | Better formatting preservation |

## Using the Configurable AI Parser - Docling

### Setting the Parser for New Resources

1. Navigate to **LLM > Resources**
2. Click **Create**
3. Fill in the required information
4. Select **"AI Parser - Docling (Configurable)"** in the Parser field
5. Configure the Docling options in the **Docling Configuration** section
6. Save and process the resource

### Configuration Examples

#### High-Quality OCR Processing
```
✓ Enable OCR
Language: [Document Language]
✓ Use GPU for OCR
✓ Extract Table Structure
✓ Enable Cell Matching
Device: Auto
Threads: 4
Backend: Docling Parse
```

#### Fast Processing (Lower Resource Usage)
```
✗ Enable OCR (if not needed)
✗ Enable Cell Matching
Device: CPU
Threads: 2
Backend: PyPdfium
✗ Extract Figures (if not needed)
```

#### Maximum Quality (High Resource Usage)
```
✓ Enable OCR
Language: [Appropriate Language]
✓ Use GPU for OCR
✓ Extract Table Structure
✓ Enable Cell Matching
✓ Extract Tables as Elements
Device: CUDA (if available)
Threads: 8
Backend: Docling Parse
✓ Extract Figures/Images
✓ Preserve Layout
```

### Updating Existing Resources

To change the parser and configure options for an existing resource:

1. Navigate to the resource
2. Edit the resource
3. Change the Parser field to **"AI Parser - Docling (Configurable)"**
4. Configure the Docling options according to your needs
5. Save the changes
6. Re-process the resource to apply the new settings

### Batch Processing with Custom Configuration

To update multiple resources with custom Docling settings:

```python
# Example: Configure resources for high-quality OCR processing
resources = env['llm.resource'].search([('state', '=', 'retrieved')])

# Set parser and configuration
resources.write({
    'parser': 'docling',
    'docling_do_ocr': True,
    'docling_ocr_language': 'en',
    'docling_use_gpu': True,
    'docling_do_table_structure': True,
    'docling_do_cell_matching': True,
    'docling_accelerator_device': 'auto',
    'docling_num_threads': 4,
    'docling_extract_tables': True,
    'docling_extract_figures': True,
    'docling_preserve_layout': True,
})

# Process with new configuration
resources.parse()
```

## Performance Optimization

### Resource Management

- **Low Memory Systems**: Disable OCR and cell matching, use PyPdfium backend
- **High Performance**: Enable GPU acceleration, increase thread count
- **Balanced**: Use default settings with auto device selection

### Language-Specific Optimization

For documents in specific languages:
1. Set the **OCR Language** to match your document content
2. This significantly improves text recognition accuracy
3. Supported languages: English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Korean, Arabic

### Hardware Optimization

- **NVIDIA GPUs**: Use CUDA device for maximum acceleration
- **Apple Silicon**: Use MPS device for M1/M2 processors
- **CPU Only**: Use CPU device for systems without GPU acceleration

## Troubleshooting

### Error: Library not available

If you see "Docling library is not installed":

```bash
pip install docling pandas
```

### Error: Memory Issues

If the parser fails due to memory constraints:

1. Disable OCR: `docling_do_ocr = False`
2. Disable cell matching: `docling_do_cell_matching = False`
3. Use PyPdfium backend: `docling_backend = 'pypdfium'`
4. Reduce threads: `docling_num_threads = 2`
5. Process smaller documents or increase system memory

### Error: GPU/CUDA Issues

If GPU acceleration fails:

1. Set device to CPU: `docling_accelerator_device = 'cpu'`
2. Disable GPU for OCR: `docling_use_gpu = False`
3. Check CUDA installation and compatibility

### ARM64 Architecture Issues

Some Docling dependencies may have compatibility issues on ARM64:

1. Try using CPU-only settings
2. Consider using the "Smart Parser" alternative
3. Use x86_64 system for full compatibility

### Poor OCR Results

To improve OCR accuracy:

1. Set correct language: `docling_ocr_language = [your_language]`
2. Enable GPU acceleration: `docling_use_gpu = True`
3. Use higher quality source documents
4. Enable cell matching for tables: `docling_do_cell_matching = True`

## Best Practices

### Document Type Optimization

- **Scanned PDFs**: Enable OCR with appropriate language
- **Native PDFs**: Disable OCR for faster processing
- **Complex Tables**: Enable table structure and cell matching
- **Image-Heavy Documents**: Enable figure extraction
- **Simple Text**: Use minimal settings for speed

### System Resource Management

- Monitor memory usage during processing
- Adjust thread count based on CPU cores
- Use GPU acceleration for better performance
- Consider batch processing limits

### Quality vs Performance

- **Maximum Quality**: Enable all features, use GPU acceleration
- **Balanced**: Use default settings with auto device selection
- **Maximum Speed**: Disable OCR and advanced features, use CPU
- **Custom**: Mix and match based on specific document requirements

## Configuration Presets

The parser supports creating custom presets for different use cases:

### Academic Papers
- Enable OCR with English
- Full table extraction with cell matching
- Extract figures and preserve layout
- Use maximum quality settings

### Business Documents
- Enable OCR with appropriate language
- Basic table extraction
- Balanced performance settings
- Extract key figures only

### Quick Processing
- Disable OCR (for native PDFs)
- Basic extraction only
- CPU processing
- Minimal threads

## Integration with Collections

When using with LLM Knowledge Collections, you can set default Docling configurations at the collection level, which will be applied to all new resources in that collection.

## Next Steps

After successful parsing with the configurable Docling parser:

1. **Review Results**: Check the extracted content quality
2. **Adjust Settings**: Fine-tune configuration based on results
3. **Chunk Content**: Use appropriate chunking strategies for long documents
4. **Generate Embeddings**: Create vector embeddings for semantic search
5. **Deploy**: Use in production with optimized settings

For advanced integration and automation, consider combining with other LLM modules for complete document processing pipelines.
