"""Refactored LLM Resource Parser using component-based parser system."""

import logging

from odoo import _, api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class LLMResourceParser(models.Model):
    _inherit = "llm.resource"

    parser = fields.Selection(
        selection="_get_available_parsers",
        string="Parser",
        default="default",
        required=True,
        help="Method used to parse resource content",
        tracking=True,
    )

    # Docling-specific configuration fields
    docling_do_ocr = fields.Boolean(
        string="Enable OCR",
        default=True,
        help="Enable Optical Character Recognition for scanned documents"
    )
    
    docling_ocr_language = fields.Selection([
        ('en', 'English'),
        ('es', 'Spanish'),
        ('fr', 'French'),
        ('de', 'German'),
        ('it', 'Italian'),
        ('pt', 'Portuguese'),
        ('ru', 'Russian'),
        ('zh', 'Chinese'),
        ('ja', 'Japanese'),
        ('ko', 'Korean'),
        ('ar', 'Arabic'),
    ], string="OCR Language", default='en', help="Language for OCR processing")
    
    docling_do_table_structure = fields.Boolean(
        string="Extract Table Structure",
        default=True,
        help="Enable table structure analysis and extraction"
    )
    
    docling_do_cell_matching = fields.Boolean(
        string="Enable Cell Matching",
        default=True,
        help="Enable table cell matching for better structure recognition"
    )
    
    docling_use_gpu = fields.Boolean(
        string="Use GPU Acceleration",
        default=True,
        help="Use GPU acceleration if available (falls back to CPU)"
    )
    
    docling_num_threads = fields.Integer(
        string="Number of Threads",
        default=4,
        help="Number of processing threads for document conversion"
    )
    
    docling_accelerator_device = fields.Selection([
        ('auto', 'Auto (GPU if available, else CPU)'),
        ('cpu', 'CPU Only'),
        ('cuda', 'NVIDIA GPU (CUDA)'),
        ('mps', 'Apple Silicon (MPS)'),
    ], string="Accelerator Device", default='auto',
       help="Device to use for AI processing acceleration")
    
    docling_backend = fields.Selection([
        ('docling_parse', 'Docling Parse (Default)'),
        ('pypdfium', 'PyPdfium (Lightweight)'),
    ], string="PDF Backend", default='docling_parse',
       help="Backend engine for PDF processing")
    
    docling_extract_tables = fields.Boolean(
        string="Extract Tables",
        default=True,
        help="Extract tables as separate elements"
    )
    
    docling_extract_figures = fields.Boolean(
        string="Extract Figures",
        default=True,
        help="Extract figures and images from documents"
    )
    
    docling_preserve_layout = fields.Boolean(
        string="Preserve Layout",
        default=True,
        help="Preserve document layout and structure in output"
    )

    @api.model
    def _get_available_parsers(self):
        """Get all available parser methods with descriptions"""
        try:
            # Import here to avoid circular imports
            from odoo.addons.llm_resource.parsers.parser_registry import \
                ParserRegistry

            # Trigger lazy loading
            available = ParserRegistry.get_available_parsers()
            _logger.info(f"Available parsers: {available}")
            return available
        except Exception as e:
            _logger.error(f"Error loading parsers: {e}", exc_info=True)
            # Fallback to default parser if registry fails
            return [('default', 'Simple Parser - Markdownify')]
        
    @api.model
    def get_parser_description(self, parser_key):
        """Get the detailed description for a specific parser"""
        try:
            # Import here to avoid circular imports
            from odoo.addons.llm_resource.parsers.parser_registry import \
                ParserRegistry
            return ParserRegistry.get_parser_description(parser_key)
        except Exception as e:
            _logger.error(f"Error getting parser description for {parser_key}: {e}", exc_info=True)
            return {
                'name': 'Unknown Parser',
                'description': 'Parser information not available',
                'requirements': 'Unknown',
                'use_cases': 'Unknown'
            }

    def parse(self):
        """Parse the retrieved content to markdown"""
        # Lock resources and process only the successfully locked ones
        resources = self._lock(state_filter="retrieved")
        if not resources:
            return False

        for resource in resources:
            try:
                # Get the related record
                record = self.env[resource.res_model].browse(resource.res_id)
                if not record.exists():
                    raise UserError(_("Referenced record not found"))

                # If the record has a specific rag_parse method, call it
                if hasattr(record, "llm_get_fields"):
                    fields = record.llm_get_fields(record)
                else:
                    # Call get_fields on the individual resource to ensure singleton
                    fields = resource.get_fields(record)

                for field in fields:
                    # Use the new parser system
                    success = resource._parse_field(record, field)

                if success:
                    resource.write({"state": "parsed"})
                    self.env.cr.commit()
                    resource._post_styled_message(
                        "Resource successfully parsed", "success"
                    )
                else:
                    resource._post_styled_message(
                        "Parsing completed but did not return success", "warning"
                    )

            except Exception as e:
                _logger.error(
                    "Error parsing resource %s: %s",
                    resource.id,
                    str(e),
                    exc_info=True,
                )
                resource._post_styled_message(
                    f"Error parsing resource: {str(e)}", "error"
                )
                if resource.collection_ids:
                    resource.collection_ids._post_styled_message(
                        f"Error parsing resource: {str(e)}", "error"
                    )
            finally:
                resource._unlock()
        resources._unlock()

    def _parse_field(self, record, field):
        """Parse a field using the selected parser from the registry."""
        self.ensure_one()
        
        try:
            # Import here to avoid circular imports
            from odoo.addons.llm_resource.parsers.parser_registry import \
                ParserRegistry

            # Get the parser instance
            parser_instance = ParserRegistry.get_parser_instance(self.parser)
            
            if not parser_instance:
                # Fallback to default parser if the selected parser is not available
                _logger.warning(f"Parser '{self.parser}' not available, falling back to default")
                parser_instance = ParserRegistry.get_parser_instance('default')
                
                if not parser_instance:
                    # If even default parser is not available, create a basic fallback
                    _logger.error("No parsers available, using basic fallback")
                    return self._basic_fallback_parse(record, field)
            
            # Use the parser to process the field - pass the resource directly
            success = parser_instance.parse(self, field)
            return success
            
        except Exception as e:
            _logger.error(f"Error in _parse_field: {e}", exc_info=True)
            # Try basic fallback
            return self._basic_fallback_parse(record, field)
    
    def _basic_fallback_parse(self, record, field):
        """Basic fallback parser when no other parsers are available."""
        try:
            mimetype = field.get("mimetype", "")
            rawcontent = field.get("rawcontent", "")
            resource_name = getattr(self, 'name', f"Resource #{self.id}")
            
            if "html" in mimetype:
                # Try to use markdownify if available
                try:
                    from markdownify import markdownify as md
                    self.content = md(rawcontent)
                except ImportError:
                    # Fallback to plain text
                    self.content = rawcontent
            elif mimetype.startswith("text/"):
                self.content = rawcontent
            else:
                # Default handling for unsupported types
                self.content = f"""# {resource_name}

**File Type**: {mimetype}
**Description**: This file is of type {mimetype} which cannot be directly parsed into text content.
**Source Record**: {record._name} #{record.id}
"""
            return True
            
        except Exception as e:
            _logger.error(f"Error in basic fallback parser: {e}")
            self.content = f"# Error parsing document\n\nAn error occurred: {str(e)}"
            return False

    def get_fields(self, record):
        """
        Default parser implementation - generates a generic markdown representation
        based on commonly available fields

        :returns
        [{"field_name": field_name, "mimetype": mimetype, "rawcontent": rawcontent}]
        """
        self.ensure_one()

        results = []

        # Start with the record name/display_name if available
        record_name_field = (
            "display_name" if hasattr(record, "display_name") else "name"
        )
        record_name = (
            record[record_name_field]
            if hasattr(record, record_name_field)
            else f"{record._name} #{record.id}"
        )
        if record_name:
            results.append(
                {
                    "field_name": record_name_field,
                    "mimetype": "text/plain",
                    "rawcontent": record_name,
                }
            )

        # Try to include description or common text fields
        common_text_fields = [
            "description",
            "note",
            "comment",
            "message",
            "content",
            "body",
            "text",
        ]
        for field_name in common_text_fields:
            if hasattr(record, field_name) and record[field_name]:
                # Use text/plain for now, could be refined based on field type
                results.append(
                    {
                        "field_name": field_name,
                        "mimetype": "text/plain",
                        "rawcontent": record[field_name],
                    }
                )

        return results
