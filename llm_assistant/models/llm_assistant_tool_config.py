import json
import logging

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class LLMAssistantToolConfig(models.Model):
    _name = "llm.assistant.tool.config"
    _description = "Assistant Tool Configuration"
    _rec_name = "tool_id"

    assistant_id = fields.Many2one(
        "llm.assistant",
        string="Assistant",
        required=True,
        ondelete="cascade",
        index=True,
    )
    tool_id = fields.Many2one(
        "llm.tool",
        string="Tool",
        required=True,
        ondelete="cascade",
        index=True,
    )
    parameters_json = fields.Text(
        string="Parameters",
        help="JSON object with parameter overrides for this tool",
        default="{}",
    )
    
    _sql_constraints = [
        (
            "assistant_tool_unique",
            "UNIQUE(assistant_id, tool_id)",
            "Each tool can only be configured once per assistant",
        )
    ]

    @api.model_create_multi
    def create(self, vals_list):
        # Validate JSON before saving
        for vals in vals_list:
            if "parameters_json" in vals and vals["parameters_json"]:
                try:
                    json.loads(vals["parameters_json"])
                except json.JSONDecodeError as e:
                    raise ValueError(f"Invalid JSON in parameters: {e}")
        return super().create(vals_list)

    def write(self, vals):
        # Validate JSON before saving
        if "parameters_json" in vals and vals["parameters_json"]:
            try:
                json.loads(vals["parameters_json"])
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON in parameters: {e}")
        return super().write(vals)

    def get_parameters(self):
        """Get the parameters as a Python dictionary"""
        self.ensure_one()
        if not self.parameters_json:
            return {}
        try:
            return json.loads(self.parameters_json)
        except json.JSONDecodeError:
            _logger.warning("Invalid JSON in tool config parameters for id %s", self.id)
            return {}
