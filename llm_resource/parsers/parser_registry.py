"""Parser registry for document parsers with lazy loading support."""

import logging
from typing import Dict, List, Optional, Tuple, Type

from .base_parser import BaseDocumentParser

_logger = logging.getLogger(__name__)


class ParserRegistry:
    """Registry for document parsers with lazy loading support."""
    
    _parsers: Dict[str, Type[BaseDocumentParser]] = {}
    _lazy_parsers: Dict[str, Tuple[str, str]] = {}  # key -> (module_name, class_name)
    
    @classmethod
    def register(cls, parser_key: str, parser_class: Type[BaseDocumentParser]) -> None:
        """Register a parser class."""
        cls._parsers[parser_key] = parser_class
        _logger.debug(f"Registered parser: {parser_key} -> {parser_class.__name__}")
    
    @classmethod
    def set_lazy_loading(cls, lazy_parsers: Dict[str, Tuple[str, str]]) -> None:
        """Set up lazy loading configuration."""
        cls._lazy_parsers = lazy_parsers
        _logger.debug(f"Configured lazy loading for {len(lazy_parsers)} parsers")
    
    @classmethod
    def _ensure_parser_loaded(cls, parser_key: str) -> bool:
        """Ensure a parser is loaded, loading it lazily if necessary."""
        if parser_key in cls._parsers:
            return True
            
        if parser_key not in cls._lazy_parsers:
            return False
            
        module_name, class_name = cls._lazy_parsers[parser_key]
        try:
            # Dynamic import - only loads when needed
            # Use importlib for relative imports
            import importlib

            # Get the current package name
            current_package = __name__.rsplit(".", 1)[0]  # Should be 'odoo.addons.llm_resource.parsers'
            full_module_name = f'{current_package}.{module_name}'
            
            _logger.debug(f"Attempting to import {full_module_name} for parser {parser_key}")
            module = importlib.import_module(full_module_name)
            parser_class = getattr(module, class_name)
            cls._parsers[parser_key] = parser_class
            _logger.debug(f"Lazy loaded parser: {parser_key} -> {class_name}")
            return True
        except ImportError as e:
            _logger.debug(f"Parser {parser_key} not available: {e}")
            return False
        except Exception as e:
            _logger.error(f"Error lazy loading parser {parser_key}: {e}")
            return False
    
    @classmethod
    def get_parser(cls, parser_key: str) -> Optional[Type[BaseDocumentParser]]:
        """Get a parser class by key, loading lazily if necessary."""
        if cls._ensure_parser_loaded(parser_key):
            return cls._parsers.get(parser_key)
        return None
    
    @classmethod
    def get_parser_instance(cls, parser_key: str) -> Optional[BaseDocumentParser]:
        """Get a parser instance by key, loading lazily if necessary."""
        parser_class = cls.get_parser(parser_key)
        if parser_class:
            try:
                return parser_class()
            except Exception as e:
                _logger.error(f"Error instantiating parser {parser_key}: {e}")
        return None
    
    @classmethod
    def get_available_parsers(cls) -> List[Tuple[str, str]]:
        """Get list of available parsers as selection options."""
        result = []
        
        # Check both loaded and lazy parsers
        all_parser_keys = set(cls._parsers.keys()) | set(cls._lazy_parsers.keys())
        
        for key in all_parser_keys:
            try:
                # Try to get parser (will lazy load if needed)
                parser_class = cls.get_parser(key)
                if parser_class:
                    parser = parser_class()
                    result.append((key, parser.name))
            except Exception as e:
                _logger.debug(f"Skipping unavailable parser {key}: {e}")
        
        return result
    
    @classmethod
    def get_parser_description(cls, parser_key: str) -> Dict[str, str]:
        """Get detailed information about a parser."""
        parser_class = cls.get_parser(parser_key)
        if not parser_class:
            return {
                'name': 'Unknown Parser',
                'description': 'Parser information not available',
                'requirements': 'Unknown',
                'use_cases': 'Unknown'
            }
        
        try:
            parser = parser_class()
            return {
                'name': parser.name,
                'description': parser.description,
                'requirements': parser.requirements,
                'use_cases': parser.use_cases
            }
        except Exception as e:
            _logger.error(f"Error getting parser description for {parser_key}: {e}")
            return {
                'name': 'Error',
                'description': f'Error loading parser: {str(e)}',
                'requirements': 'Unknown',
                'use_cases': 'Unknown'
            }
    
    @classmethod
    def list_registered_parsers(cls) -> List[str]:
        """Get list of registered parser keys."""
        return list(set(cls._parsers.keys()) | set(cls._lazy_parsers.keys()))
