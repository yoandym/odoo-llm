# Lazy loading parser registry - parsers are only imported when needed
from .parser_registry import ParserRegistry

# Configure lazy loading in the registry
ParserRegistry.set_lazy_loading({
    'default': ('markdownify_parser', 'MarkdownifyParser'),
    'json': ('json_parser', 'JsonParser'),
    'smart': ('smart_parser', 'SmartParser'),
    'docling_configurable': ('docling_parser_configurable', 'DoclingParser'),
})
