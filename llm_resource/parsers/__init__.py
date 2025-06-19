# Lazy loading parser registry - parsers are only imported when needed
from .parser_registry import ParserRegistry

# Configure lazy loading in the registry
ParserRegistry.set_lazy_loading({
    'default': ('default_parser', 'DefaultParser'),
    'json': ('json_parser', 'JsonParser'),
    'docling_configurable': ('docling_parser_configurable', 'DoclingParser'),
})
