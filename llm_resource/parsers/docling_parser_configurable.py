"""Configurable Docling parser implementation using AI-powered document processing."""

import base64
import io
import json
import logging

from .base_parser import BaseDocumentParser

_logger = logging.getLogger(__name__)

# Direct import check - if this fails, docling is not available
try:
    import docling  # noqa: F401
    DOCLING_AVAILABLE = True
except ImportError:
    DOCLING_AVAILABLE = False


class DoclingParser(BaseDocumentParser):
    """Configurable AI-powered document parser using Docling for advanced layout analysis."""
    
    @property
    def name(self) -> str:
        return "AI Parser - Docling (Configurable)"
    
    @property
    def description(self) -> str:
        return (
            "Configurable AI-powered document parser using Docling. "
            "Advanced layout analysis and semantic understanding with customizable options. "
            "Extracts tables, images, and preserves document structure. "
            "Configure OCR, table extraction, GPU acceleration, and more. "
            "High memory and CPU requirements (4GB+ RAM recommended). "
            "Best for complex documents requiring layout understanding. "
            "May not work on ARM64 systems due to dependency constraints."
        )
    
    @property
    def requirements(self) -> str:
        return "High memory and CPU requirements (4GB+ RAM recommended). May not work on ARM64 systems."
    
    @property
    def use_cases(self) -> str:
        return (
            "Best for complex documents with configurable processing needs. "
            "Excellent for research papers, reports, and structured documents. "
            "Configure OCR languages, table extraction, and acceleration options."
        )
    
    def parse(self, resource, field) -> bool:
        """Parse content using Docling's configurable AI-powered document processing.
        
        Args:
            resource: The LLM resource record
            field: Dictionary containing field data with 'rawcontent', 'mimetype', etc.
        """
        # Check if Docling is available
        if not DOCLING_AVAILABLE:
            self._log_error("Docling library is not available. Please install with 'pip install docling'.")
            return False
            
        # Import docling only when actually needed to avoid loading heavy components at startup
        try:
            from docling.datamodel.accelerator_options import (
                AcceleratorDevice, AcceleratorOptions)
            from docling.datamodel.base_models import InputFormat
            from docling.datamodel.pipeline_options import PdfPipelineOptions
            from docling.document_converter import (DocumentConverter,
                                                    PdfFormatOption)
        except ImportError as e:
            self._log_error(f"Failed to import Docling components: {e}")
            return False
        except Exception as e:
            self._log_error(f"Unexpected error importing Docling: {e}")
            return False

        try:
            # Get resource name for document title
            resource_name = resource.name or f"Resource #{resource.id}"
            
            # Initialize the document content
            content_parts = [f"# {resource_name}"]
            
            mimetype = field.get("mimetype", "")
            raw_content = field.get("rawcontent", "")
            
            # Convert to bytes if needed for binary formats
            if isinstance(raw_content, str) and mimetype in [
                "application/pdf",
                "application/octet-stream",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            ]:
                try:
                    raw_content = base64.b64decode(raw_content)
                except Exception as decode_error:
                    self._log_error(f"Error decoding binary content: {str(decode_error)}")
                    resource.content = self._fallback_parse(resource, field)
                    return True
            
            if not raw_content:
                resource.content = f"# {resource_name}\n\nNo content to parse."
                return True
            
            # Create a memory buffer for Docling to process
            content_buffer = io.BytesIO(raw_content) if isinstance(raw_content, bytes) else io.StringIO(raw_content)
            
            # Determine the correct InputFormat based on mimetype
            input_format = self._get_input_format(mimetype)
            
            # Configure pipeline options based on resource settings
            pipeline_options = self._build_pipeline_options(resource)
            
            # Configure DocumentConverter with custom options
            converter = self._build_document_converter(input_format, pipeline_options, resource)
            
            # Convert the content
            try:
                conversion_result = converter.convert(content_buffer, input_format=input_format)
                doc = conversion_result.document
            except TypeError:
                # Older versions of docling might not support input_format parameter
                conversion_result = converter.convert(content_buffer)
                doc = conversion_result.document
            
            # Get the full Markdown representation
            markdown_content = doc.export_to_markdown()
            content_parts.append(markdown_content)
            
            # Extract and store tables if enabled
            if getattr(resource, 'docling_extract_tables', True):
                self._process_tables(doc, content_parts, resource)
            
            # Extract and store images/figures if enabled
            if getattr(resource, 'docling_extract_figures', True):
                self._process_figures(doc, content_parts, resource)
            
            # Update resource with extracted content
            resource.content = "\n\n".join([part for part in content_parts if part])
            return True
            
        except Exception as e:
            self._log_error("Docling parser error", e)
            # Fallback to basic content extraction
            resource.content = self._fallback_parse(resource, field)
            return True
    
    def _build_pipeline_options(self, resource):
        """Build pipeline options based on resource configuration."""
        from docling.datamodel.accelerator_options import (AcceleratorDevice,
                                                           AcceleratorOptions)
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        
        pipeline_options = PdfPipelineOptions()
        
        # Configure OCR settings
        pipeline_options.do_ocr = getattr(resource, 'docling_do_ocr', True)
        
        # Configure OCR language if OCR is enabled
        if pipeline_options.do_ocr:
            ocr_lang = getattr(resource, 'docling_ocr_language', 'en')
            if hasattr(pipeline_options, 'ocr_options') and hasattr(pipeline_options.ocr_options, 'lang'):
                pipeline_options.ocr_options.lang = [ocr_lang]
        
        # Configure table structure analysis
        pipeline_options.do_table_structure = getattr(resource, 'docling_do_table_structure', True)
        
        # Configure cell matching for tables
        if hasattr(pipeline_options, 'table_structure_options'):
            pipeline_options.table_structure_options.do_cell_matching = getattr(
                resource, 'docling_do_cell_matching', True
            )
        
        # Configure accelerator options
        num_threads = getattr(resource, 'docling_num_threads', 4)
        accelerator_device_str = getattr(resource, 'docling_accelerator_device', 'auto')
        
        # Map string to AcceleratorDevice enum
        device_mapping = {
            'auto': AcceleratorDevice.AUTO,
            'cpu': AcceleratorDevice.CPU,
            'cuda': AcceleratorDevice.CUDA,
            'mps': AcceleratorDevice.MPS,
        }
        
        accelerator_device = device_mapping.get(accelerator_device_str, AcceleratorDevice.AUTO)
        
        pipeline_options.accelerator_options = AcceleratorOptions(
            num_threads=num_threads,
            device=accelerator_device
        )
        
        # Configure GPU usage for OCR if available
        use_gpu = getattr(resource, 'docling_use_gpu', True)
        if hasattr(pipeline_options, 'ocr_options') and hasattr(pipeline_options.ocr_options, 'use_gpu'):
            pipeline_options.ocr_options.use_gpu = use_gpu
        
        return pipeline_options
    
    def _build_document_converter(self, input_format, pipeline_options, resource):
        """Build DocumentConverter with custom format options."""
        from docling.datamodel.base_models import InputFormat
        from docling.document_converter import (DocumentConverter,
                                                PdfFormatOption)

        # Configure format options for PDF
        if input_format == InputFormat.PDF:
            # Select backend based on configuration
            backend_name = getattr(resource, 'docling_backend', 'docling_parse')
            
            if backend_name == 'pypdfium':
                try:
                    from docling.backend.pypdfium_backend import \
                        PyPdfiumDocumentBackend
                    pdf_format_option = PdfFormatOption(
                        pipeline_options=pipeline_options,
                        backend=PyPdfiumDocumentBackend
                    )
                except ImportError:
                    _logger.warning("PyPdfium backend not available, using default")
                    pdf_format_option = PdfFormatOption(pipeline_options=pipeline_options)
            else:
                # Use default Docling Parse backend
                pdf_format_option = PdfFormatOption(pipeline_options=pipeline_options)
            
            converter = DocumentConverter(
                format_options={
                    InputFormat.PDF: pdf_format_option
                }
            )
        else:
            # For non-PDF formats, use default converter
            converter = DocumentConverter()
        
        return converter
    
    def _get_input_format(self, mimetype):
        """Determine the correct InputFormat based on mimetype."""
        # Import here to avoid loading at module level
        from docling.datamodel.base_models import InputFormat
        
        format_mapping = {
            "application/pdf": InputFormat.PDF,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": InputFormat.DOCX,
            "application/vnd.openxmlformats-officedocument.presentationml.presentation": InputFormat.PPTX,
            "text/html": InputFormat.HTML,
            "text/markdown": InputFormat.MD,
            "text/plain": InputFormat.TEXT,
        }
        
        # Check for partial matches
        for mime_pattern, input_format in format_mapping.items():
            if mime_pattern in mimetype:
                return input_format
        
        # Check for image types
        if mimetype.startswith("image/"):
            return InputFormat.IMAGE
        
        # Default fallback
        return None
    
    def _process_tables(self, doc, content_parts, resource):
        """Extract and process tables from the document."""
        tables_data = []
        
        if not (hasattr(doc, 'tables') and doc.tables):
            return
        
        content_parts.append("\n## Tables\n")
        for i, table in enumerate(doc.tables):
            content_parts.append(f"\n### Table {i+1}\n")
            
            # Try to convert to DataFrame for better formatting
            try:
                table_df = table.export_to_dataframe()
                table_md = table_df.to_markdown()
                content_parts.append(table_md)
                
                # Store table data for potential future use
                tables_data.append({
                    'index': i,
                    'data': table_df.to_dict(),
                    'markdown': table_md
                })
            except Exception as table_error:
                _logger.warning(f"Error converting table to markdown: {str(table_error)}")
                content_parts.append(str(table))
        
        # Store tables data as JSON in attachment for future reference
        if tables_data:
            try:
                tables_json = json.dumps(tables_data)
                resource.env["ir.attachment"].create({
                    "name": f"tables_data_{resource.id}.json",
                    "datas": base64.b64encode(tables_json.encode('utf-8')),
                    "res_model": "llm.resource",
                    "res_id": resource.id,
                    "mimetype": "application/json",
                })
            except Exception as table_json_error:
                _logger.warning(f"Error storing tables data: {str(table_json_error)}")
    
    def _process_figures(self, doc, content_parts, resource):
        """Extract and process figures/images from the document."""
        figures = []
        
        # Try different attributes for figures
        if hasattr(doc, 'figures'):
            figures = doc.figures
        elif hasattr(doc, 'images'):
            figures = doc.images
        
        if not figures:
            return
        
        content_parts.append("\n## Figures\n")
        for i, figure in enumerate(figures):
            try:
                # Try different ways to get image data
                image_data = None
                if hasattr(figure, 'get_image_data'):
                    image_data = figure.get_image_data()
                elif hasattr(figure, 'image_data'):
                    image_data = figure.image_data
                elif hasattr(figure, 'data'):
                    image_data = figure.data
                    
                if image_data:
                    image_name = f"docling_figure_{i+1}.png"
                    img_attachment = resource.env["ir.attachment"].create({
                        "name": image_name,
                        "datas": base64.b64encode(image_data),
                        "res_model": "llm.resource",
                        "res_id": resource.id,
                        "mimetype": "image/png",
                    })
                    
                    # Add image reference to markdown content
                    if img_attachment:
                        image_url = f"/web/image/{img_attachment.id}"
                        content_parts.append(f"![{image_name}]({image_url})")
                        
                        # Add caption if available
                        caption = None
                        if hasattr(figure, 'caption'):
                            caption = figure.caption
                        elif hasattr(figure, 'get_caption'):
                            caption = figure.get_caption()
                            
                        if caption:
                            content_parts.append(f"*{caption}*")
            except Exception as img_error:
                _logger.warning(f"Error processing figure {i}: {str(img_error)}")

    def _fallback_parse(self, resource, field) -> str:
        """Fallback parsing when Docling is not available."""
        # Get resource name for document title
        resource_name = resource.name or f"Resource #{resource.id}"
        
        # Try to extract basic text content
        raw_content = field.get("rawcontent", "")
        mimetype = field.get("mimetype", "")
        
        if not raw_content:
            return f"# {resource_name}\n\nNo content available."
        
        # For text content, return as-is
        if mimetype.startswith("text/"):
            return f"# {resource_name}\n\n{raw_content}"
        
        # For other content types, indicate that Docling is needed
        return (
            f"# {resource_name}\n\n"
            f"**Document Type:** {mimetype}\n\n"
            f"*This document requires Docling for proper parsing. "
            f"Please install Docling to extract content from {mimetype} files.*\n\n"
            f"**Raw content available:** {len(raw_content)} characters"
        )
