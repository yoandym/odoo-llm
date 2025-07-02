import json
import logging

from odoo import _, api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class ModelLine(models.TransientModel):
    _name = "llm.fetch.models.line"
    _description = "LLM Model Import Line"
    _rec_name = "name"

    wizard_id = fields.Many2one(
        "llm.fetch.models.wizard",
        required=True,
        ondelete="cascade",
    )
    name = fields.Char(
        string="Model Name",
        required=True,
    )
    model_use = fields.Selection(
        selection="_get_available_model_usages",
        required=True,
        default="chat",
    )
    status = fields.Selection(
        [
            ("new", "New"),
            ("existing", "Existing"),
            ("modified", "Modified"),
        ],
        required=True,
        default="new",
    )
    selected = fields.Boolean(default=True)
    details = fields.Json()
    model_info = fields.Json()
    existing_model_id = fields.Many2one("llm.model")

    _sql_constraints = [
        (
            "unique_model_per_wizard",
            "UNIQUE(wizard_id, name)",
            "Each model can only be listed once per import.",
        )
    ]

    @api.model
    def _get_available_model_usages(self):
        return self.env["llm.model"]._get_available_model_usages()


class FetchModelsWizard(models.TransientModel):
    _name = "llm.fetch.models.wizard"
    _description = "Import LLM Models"

    provider_id = fields.Many2one(
        "llm.provider",
        required=True,
    )
    line_ids = fields.One2many(
        "llm.fetch.models.line",
        "wizard_id",
        string="Models",
    )
    model_count = fields.Integer(
        compute="_compute_model_count",
        string="Models Found",
    )
    new_count = fields.Integer(
        compute="_compute_model_count",
        string="New Models",
    )
    modified_count = fields.Integer(
        compute="_compute_model_count",
        string="Modified Models",
    )
    has_selectable_lines = fields.Boolean(
        compute="_compute_has_selectable_lines",
        string="Has Selectable Lines",
        store=False,
    )

    @api.depends("line_ids", "line_ids.status")
    def _compute_model_count(self):
        """Compute various model counts for display"""
        for wizard in self:
            wizard.model_count = len(wizard.line_ids)
            wizard.new_count = len(
                wizard.line_ids.filtered(lambda record: record.status == "new")
            )
            wizard.modified_count = len(
                wizard.line_ids.filtered(lambda record: record.status == "modified")
            )

    @api.depends("line_ids", "line_ids.status")
    def _compute_has_selectable_lines(self):
        for wizard in self:
            wizard.has_selectable_lines = any(
                line.status in ("new", "modified") for line in wizard.line_ids
            )

    @api.model
    def default_get(self, fields_list):
        """
        Override of Odoo's default_get method.

        This method is called automatically by Odoo when a new record is created via the UI or an action,
        to provide default values for the specified fields. It is commonly used in wizards and forms to
        pre-populate fields based on context or business logic.

        Args:
            fields_list (list): List of field names for which default values are requested.

        Returns:
            dict: A dictionary mapping field names to their default values, which will be used to initialize
            the form or wizard record.

        In this implementation, the method:
        - Determines the provider to use from the context (either 'default_provider_id' or 'active_id').
        - Fetches available models from the provider and prepares a list of model lines for the wizard.
        - Returns a dictionary of default values for the wizard, including the provider and model lines.
        """
        res = super().default_get(fields_list)

        # Get a provider_id
        _provider_id = self._context.get("default_provider_id") or self._context.get("active_id")
        if _provider_id:
            provider = self.env["llm.provider"].browse(_provider_id)
            if not provider.exists():
                raise UserError(_("Provider not found."))
            res["provider_id"] = provider.id
        else:
            return res

        # Prepare model lines
        lines = []
        existing_models = {
            model.name: model
            for model in self.env["llm.model"].search(
                [("provider_id", "=", res["provider_id"])]
            )
        }

        # Fetch and process models
        model_to_fetch = self._context.get("default_model_to_fetch")
        models_data = []
        if model_to_fetch:
            models_data = provider.list_models(model_id=model_to_fetch)
        else:
            models_data = provider.list_models()

        for model_data in models_data:
            details = model_data.get("details", {})
            model_info = model_data.get("model_info", {})
            name = model_data.get("name") or details.get("id")

            # Log details received from the provider
            # in a properly formatted json so its easy to see the structure in a json viewer
            _logger.info(f"Received model data from provider: {json.dumps(model_data, indent=2)}")

            if not name:
                continue

            # Determine model use and capabilities
            capabilities = details.get("capabilities", ["chat"])
            model_use = self._determine_model_use(name, capabilities)

            # Check against existing models
            existing = existing_models.get(name)
            status = "new"
            if existing:
                status = "modified" if (existing.details != details or existing.model_info != model_info) else "existing"

            # Make sure both JSON fields are properly set
            if model_info is None or model_info is False:
                # Create a simple, basic model_info dictionary if none exists
                model_info = {
                    "name": name,
                    "provider": "ollama",
                    "family": "unknown",
                    "parameters": {}
                }
                _logger.info(f"Created default model_info for {name}: {model_info}")

            line_vals = {
                "name": name,
                "model_use": model_use,
                "status": status,
                "details": details,
                "model_info": model_info,
                "existing_model_id": existing.id if existing else False,
                "selected": status in ["new", "modified"],
            }

            lines.append((0, 0, line_vals))

        if lines:
            res["line_ids"] = lines

        return res

    @api.model
    def _determine_model_use(self, name, capabilities):
        """Helper to determine model use based on name and capabilities"""
        if (
            any(cap in capabilities for cap in ["embedding", "text-embedding"])
            or "embedding" in name.lower()
        ):
            return "embedding"
        elif any(cap in capabilities for cap in ["multimodal", "vision"]):
            return "multimodal"
        return "chat"  # default

    def action_confirm(self):
        """Process selected models and create/update records"""
        self.ensure_one()
        Model = self.env["llm.model"]

        selected_lines = self.line_ids.filtered(
            lambda record: record.selected and record.name
        )
        if not selected_lines:
            raise UserError(_("Please select at least one model to import."))

        for line in selected_lines:
            # Get the values directly from the wizard line
            details = line.details
            model_info = line.model_info
            
            _logger.info(f"Pre-processing model data for '{line.name}': ")
            _logger.info(f"details_type={type(details)}, details={details} ")
            _logger.info(f"model_info_type={type(model_info)}, model_info={model_info} ")
            
            # Process details field
            if details:
                try:
                    # Ensure we have a Python dict (not a string)
                    if isinstance(details, str):
                        details = json.loads(details)
                    
                    # Log the processed details
                    _logger.info(f"Processed details: type={type(details)} ")
                    _logger.info(f"Processed details value: {details} ")
                except (ValueError, TypeError) as e:
                    _logger.warning(f"Invalid JSON in details: {e}")
                    details = {"error": "Invalid JSON format", "message": str(e)}
            
            # Process model_info field
            if model_info:
                try:
                    # Ensure we have a Python dict (not a string)
                    if isinstance(model_info, str):
                        model_info = json.loads(model_info)
                    
                    # Log the processed model_info
                    _logger.info(f"Processed model_info: type={type(model_info)} ")
                    _logger.info(f"Processed model_info value: {model_info} ")
                except (ValueError, TypeError) as e:
                    _logger.warning(f"Invalid JSON in model_info: {e}")
                    model_info = {"error": "Invalid JSON format", "message": str(e)}
            else:
                # If model_info is None, False, or empty, create a default one
                model_info = {
                    "name": line.name,
                    "provider": "ollama",
                    "family": "unknown",
                    "parameters": {}
                }
                _logger.info(f"Created default model_info in confirm: {model_info}")

            values = {
                "name": line.name.strip(),
                "provider_id": self.provider_id.id,
                "model_use": line.model_use,
                "details": details,
                "model_info": model_info,
                "active": True,
            }
            
            # Log what we're saving to the model record
            _logger.info(
                f"Saving model values for '{line.name}': "
                f"details_type={type(details)}, "
                f"model_info_type={type(model_info)}, "
                f"details={details}, "
                f"model_info={model_info}"
            )

            if line.existing_model_id:
                line.existing_model_id.write(values)
            else:
                Model.create(values)

        # Return success message
        return {
            "type": "ir.actions.client",
            "tag": "display_notification",
            "params": {
                "title": _("Success"),
                "message": _(
                    "%d models have been imported/updated.", len(selected_lines)
                ),
                "sticky": False,
                "type": "success",
                "next": {"type": "ir.actions.act_window_close"},
            },
        }
