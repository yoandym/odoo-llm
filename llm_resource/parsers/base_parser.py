"""Base parser interface for document parsers."""

import logging
from abc import ABC, abstractmethod
from typing import Optional

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
