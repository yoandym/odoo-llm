"""JSON parser implementation."""

import json
import logging

from .base_parser import BaseDocumentParser

_logger = logging.getLogger(__name__)


class JsonParser(BaseDocumentParser):
    """Specialized parser for JSON data and Odoo record conversion."""
    
    @property
    def name(self) -> str:
        return "JSON Parser"
    
    @property
    def description(self) -> str:
        return (
            "Specialized parser for JSON data. "
            "Formats JSON content with proper structure. "
            "Low memory requirements. "
            "Best for API responses and data files."
        )
    
    @property
    def requirements(self) -> str:
        return "Minimal system requirements. Works well on any hardware."
    
    @property
    def use_cases(self) -> str:
        return "Best for API responses, configuration files, and structured data."
    
    def parse(self, resource, field) -> bool:
        """Parse content as JSON or convert record to JSON format."""
        try:
            rawcontent = field.get("rawcontent", "")
            mimetype = field.get("mimetype", "")
            
            # If we have JSON content, format it nicely
            if mimetype == "application/json" and rawcontent:
                return self._parse_json_content(resource, rawcontent)
            
            # Otherwise, convert the record to JSON format
            return self._parse_record_as_json(resource)
                
        except Exception as e:
            self._log_error("Error parsing content as JSON", e)
            resource.content = f"# Error parsing JSON\n\nAn error occurred: {str(e)}"
            return False
    
    def _parse_json_content(self, resource, rawcontent):
        """Parse actual JSON content."""
        try:
            # Try to parse and reformat the JSON
            parsed_json = json.loads(rawcontent)
            formatted_json = json.dumps(parsed_json, indent=2, ensure_ascii=False)
            
            resource.content = f"""# {resource.name}

## JSON Content

```json
{formatted_json}
```
"""
            return True
        except json.JSONDecodeError as e:
            # If it's not valid JSON, just display as text
            resource.content = f"""# {resource.name}

## Content (Not valid JSON)

```
{rawcontent}
```

**JSON Parse Error**: {str(e)}
"""
            return True
    
    def _parse_record_as_json(self, resource):
        """Convert Odoo record to JSON format."""
        try:
            # Get record name or default to model name and ID
            record_name = (
                resource.display_name
                if hasattr(resource, "display_name")
                else f"{resource._name} #{resource.id}"
            )

            # Create a dictionary with record data
            record_data = {}
            for field_name, field in resource._fields.items():
                try:
                    # Skip binary fields and internal fields
                    if field.type == "binary" or field_name.startswith("_"):
                        continue

                    # Handle many2one fields
                    if field.type == "many2one" and resource[field_name]:
                        record_data[field_name] = {
                            "id": resource[field_name].id,
                            "name": resource[field_name].display_name,
                        }
                    # Handle many2many and one2many fields
                    elif field.type in ["many2many", "one2many"]:
                        record_data[field_name] = [
                            {"id": r.id, "name": r.display_name} for r in resource[field_name]
                        ]
                    # Handle other fields
                    else:
                        record_data[field_name] = resource[field_name]
                except Exception as e:
                    _logger.warning(f"Skipping field {field_name}: {str(e)}")
                    continue
            
            # Format as markdown
            content = [f"# {record_name}"]
            content.append("\n## JSON Data\n")
            content.append("```json")
            content.append(json.dumps(record_data, indent=2, default=str))
            content.append("```")

            # Update resource content
            resource.content = "\n".join(content)
            return True
            
        except Exception as e:
            self._log_error("Error converting record to JSON", e)
            return False
