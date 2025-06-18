"""Markdownify parser implementation."""

import logging

from markdownify import markdownify as md

from .base_parser import BaseDocumentParser

_logger = logging.getLogger(__name__)


class MarkdownifyParser(BaseDocumentParser):
    """Basic document parser using Markdownify for HTML content."""
    
    @property
    def name(self) -> str:
        return "Simple Parser - Markdownify"
    
    @property
    def description(self) -> str:
        return (
            "Basic document parser using Markdownify. "
            "Handles HTML and simple text files efficiently. "
            "Low memory requirements. "
            "Best for simple documents and web content."
        )
    
    @property
    def requirements(self) -> str:
        return "Minimal system requirements. Works well on any hardware."
    
    @property
    def use_cases(self) -> str:
        return "Best for simple HTML documents, emails, and basic formatted text."
    
    def parse(self, resource, field) -> bool:
        """Parse content using markdownify for HTML or plain text for other formats.
        
        Args:
            resource: The llm.resource record to update with parsed content
            field: Dictionary containing field data with 'rawcontent', 'mimetype', etc.
        """
        try:
            mimetype = field.get("mimetype", "text/plain")
            rawcontent = field.get("rawcontent", "")
            
            if not rawcontent:
                resource.content = ""
                return True
            
            # Handle different content types
            if mimetype == "application/pdf":
                return self._parse_pdf(resource, field)
            elif "html" in mimetype:
                return self._parse_html(resource, field)
            elif mimetype.startswith("text/"):
                return self._parse_text(resource, field)
            elif mimetype.startswith("image/"):
                return self._parse_image(resource, field)
            elif mimetype == "application/json":
                return self._parse_json(resource, field)
            else:
                return self._parse_default(resource, field)
                
        except Exception as e:
            self._log_error("Error parsing content", e)
            resource.content = f"# Error parsing document\n\nAn error occurred: {str(e)}"
            return False
    
    def _parse_html(self, resource, field):
        """Parse HTML content using markdownify."""
        try:
            resource.content = md(field["rawcontent"])
            return True
        except Exception as e:
            self._log_error("Error parsing HTML content", e)
            return False
    
    def _parse_text(self, resource, field):
        """Parse plain text content."""
        try:
            resource.content = field["rawcontent"]
            return True
        except Exception as e:
            self._log_error("Error parsing text content", e)
            return False
    
    def _parse_image(self, resource, field):
        """Parse image content by creating a markdown image reference."""
        try:
            image_url = f"/web/image/{resource.id}"
            resource.content = f"![{resource.name}]({image_url})"
            return True
        except Exception as e:
            self._log_error("Error parsing image content", e)
            return False
    
    def _parse_pdf(self, resource, field):
        """Handle PDF files - fallback to default handling."""
        return self._parse_default(resource, field)
    
    def _parse_json(self, resource, field):
        """Handle JSON files - fallback to default handling."""
        return self._parse_default(resource, field)
    
    def _parse_default(self, resource, field):
        """Default parser for unsupported types."""
        try:
            mimetype = field["mimetype"]
            resource.content = f"""# {resource.name}

**File Type**: {mimetype}
**Description**: This file is of type {mimetype} which cannot be directly parsed into text content.
**Access**: [Open file](/web/content/{resource.id})
"""
            return True
        except Exception as e:
            self._log_error("Error in default parsing", e)
            return False
