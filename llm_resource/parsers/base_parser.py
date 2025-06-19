"""Base parser interface for document parsers."""

import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

_logger = logging.getLogger(__name__)


class BaseDocumentParser(ABC):
    """Abstract base class for document parsers."""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Return the parser name."""
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        """Return the parser description."""
        pass
    
    @property
    @abstractmethod
    def requirements(self) -> str:
        """Return the parser requirements."""
        pass
    
    @property
    @abstractmethod
    def use_cases(self) -> str:
        """Return the parser use cases."""
        pass
    
    @abstractmethod
    def parse(self, resource, field) -> bool:
        """
        Parse the document content and set the resource content.
        
        Args:
            resource: The LLM resource record
            field: The field configuration dictionary
            
        Returns:
            bool: True if parsing was successful, False otherwise
        """
        pass
    
    def parse_record_fields(self, resource, record) -> List[Dict[str, Any]]:
        """
        Parse fields from a record into a format suitable for processing.
        
        Default implementation that extracts common fields from a record.
        Parsers can override this to provide specialized field extraction.
        
        Args:
            resource: The LLM resource record
            record: The Odoo record to extract fields from
            
        Returns:
            List[Dict]: List of field dictionaries with field_name, mimetype, and rawcontent
        """
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
    
    def _safe_decode(self, content: bytes, encoding: str = 'utf-8') -> str:
        """Safely decode bytes content to string."""
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            # Try with error handling
            return content.decode(encoding, errors='replace')
        except Exception as e:
            _logger.error(f"Error decoding content: {e}")
            return str(content)
    
    def _log_error(self, message: str, exception: Optional[Exception] = None):
        """Log error with consistent format."""
        if exception:
            _logger.error(f"{self.name}: {message} - {str(exception)}", exc_info=True)
        else:
            _logger.error(f"{self.name}: {message}")
