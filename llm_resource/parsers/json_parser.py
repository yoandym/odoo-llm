"""JSON parser implementation."""

import json
import logging
from typing import Any, Dict, List

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
            field_name = field.get("field_name", "")
            mimetype = field.get("mimetype", "")
            rawcontent = field.get("rawcontent", "")
            
            # Skip empty content
            if not rawcontent:
                _logger.warning(f"Skipping empty field: {field_name}")
                return False
                
            # Handle binary content that needs decoding
            if isinstance(rawcontent, bytes) or (isinstance(rawcontent, str) and rawcontent.startswith(('data:', 'b\'', 'b"'))):
                try:
                    # This will be handled by the specific parser
                    pass
                except Exception as e:
                    self._log_error(f"Error decoding content for {field_name}", e)
                    return False
            
            # If we have JSON content, format it nicely
            if mimetype == "application/json" and rawcontent:
                processed_content = self._format_json_content(field_name, rawcontent)
            else:
                # For non-JSON content, just format as text
                processed_content = f"## {field_name}\n\n```\n{rawcontent}\n```"
                
            # Update the resource content with the processed content
            if processed_content:
                # If content already exists, append to it
                if resource.content:
                    resource.content = f"{resource.content}\n\n{processed_content}"
                else:
                    resource.content = processed_content
                return True
                
            return False
                
        except Exception as e:
            self._log_error(f"Error parsing field {field.get('field_name')}", e)
            return False
    
    def _format_json_content(self, field_name, rawcontent):
        """Format JSON content as markdown."""
        try:
            # Try to parse and reformat the JSON
            parsed_json = json.loads(rawcontent)
            formatted_json = json.dumps(parsed_json, indent=2, ensure_ascii=False)
            
            return f"""## {field_name}

```json
{formatted_json}
```
"""
        except json.JSONDecodeError as e:
            # If it's not valid JSON, just display as text
            return f"""## {field_name} (Not valid JSON)

```
{rawcontent}
```

**JSON Parse Error**: {str(e)}
"""
    
    def parse_record_fields(self, resource, record) -> List[Dict[str, Any]]:
        """
        Parse fields from a record into a JSON-compatible format.
        Enhanced implementation for JSON parsing with special handling of structured data.
        
        Args:
            resource: The LLM resource record
            record: The Odoo record to extract fields from
            
        Returns:
            List[Dict]: List of field dictionaries with field_name, mimetype, and rawcontent
        """
        results = []
        env = record.env

        # Start with the record name/display_name
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

        # Process all fields and convert to JSON-friendly representation
        all_fields = {}
        
        for field_name, field in record._fields.items():
            try:
                # Skip binary fields (handled separately) and special fields
                if (
                    field_name.startswith("_")
                    or field.type == "binary"
                    or field_name in ["id", record_name_field, "create_uid", "write_uid", "create_date", "write_date"]
                    or (field.compute and not field.store)
                ):
                    continue

                # Skip empty values
                if not record[field_name]:
                    continue

                # Process based on field type
                if field.type == "many2one" and record[field_name]:
                    # For many2one fields, include id and display_name
                    related_record = record[field_name]
                    if hasattr(related_record, "display_name"):
                        field_value = {
                            "id": related_record.id,
                            "display_name": related_record.display_name
                        }
                        all_fields[field_name] = field_value
                        results.append({
                            "field_name": field_name,
                            "mimetype": "application/json",
                            "rawcontent": json.dumps(field_value)
                        })
                
                elif field.type in ["many2many", "one2many"]:
                    # For relational fields, include a list of related record info
                    related_records = record[field_name]
                    if related_records:
                        records_list = [
                            {"id": r.id, "display_name": r.display_name}
                            for r in related_records if hasattr(r, "display_name")
                        ]
                        if records_list:
                            all_fields[field_name] = records_list
                            results.append({
                                "field_name": field_name,
                                "mimetype": "application/json",
                                "rawcontent": json.dumps(records_list)
                            })
                
                elif field.type == "html":
                    # Handle HTML fields
                    results.append({
                        "field_name": field_name,
                        "mimetype": "text/html",
                        "rawcontent": record[field_name]
                    })
                
                else:
                    # Handle other field types
                    field_value = record[field_name]
                    all_fields[field_name] = field_value
                    results.append({
                        "field_name": field_name,
                        "mimetype": "text/plain",
                        "rawcontent": str(field_value)
                    })
            
            except Exception as e:
                _logger.error(f"Error processing field {field_name}: {e}")
                continue

        # Add complete JSON representation of the record
        try:
            complete_json = json.dumps(all_fields, indent=2, default=str)
            results.append({
                "field_name": f"{record._name}_complete",
                "mimetype": "application/json",
                "rawcontent": complete_json
            })
        except Exception as e:
            _logger.error(f"Error creating complete JSON representation: {e}")

        # Handle binary fields
        binary_fields = [f.name for f in record._fields.values() if f.type == "binary"]
        for field_name in binary_fields:
            if record[field_name]:
                try:
                    # Get the field's content
                    binary_content = record[field_name]
                    
                    # Try to determine mimetype based on filename or field name
                    mimetype = "application/octet-stream"
                    
                    # If there's a filename field, try to use it to determine mimetype
                    filename_field = f"{field_name}_filename"
                    if hasattr(record, filename_field) and record[filename_field]:
                        filename = record[filename_field]
                        if filename.endswith('.json'):
                            mimetype = "application/json"
                    
                    results.append({
                        "field_name": field_name,
                        "mimetype": mimetype,
                        "rawcontent": binary_content
                    })
                    
                except Exception as e:
                    _logger.error(f"Error processing binary field {field_name}: {e}")
                    continue

        # Get attachments related to this record
        try:
            attachments = env["ir.attachment"].search([
                ("res_model", "=", record._name),
                ("res_id", "=", record.id)
            ])
            
            for attachment in attachments:
                # Skip attachments without data or filename
                if not attachment.datas or not attachment.name:
                    continue
                    
                # Get binary content
                binary_content = attachment.datas
                
                # Check for JSON files
                is_json = attachment.name.lower().endswith('.json')
                
                # Determine mimetype
                mimetype = "application/json" if is_json else (attachment.mimetype or "application/octet-stream")
                
                results.append({
                    "field_name": f"Attachment: {attachment.name}",
                    "mimetype": mimetype,
                    "rawcontent": binary_content,
                    "attachment_id": attachment.id
                })
        except Exception as e:
            _logger.error(f"Error processing attachments: {e}")
            
        return results
