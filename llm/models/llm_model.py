import json

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class LLMModel(models.Model):
    _name = "llm.model"
    _description = "LLM Model"
    _inherit = ["mail.thread"]

    name = fields.Char(required=True)
    provider_id = fields.Many2one("llm.provider", required=True, ondelete="cascade")
    publisher_id = fields.Many2one(
        "llm.publisher",
        string="Publisher",
        ondelete="restrict",
        tracking=True,
        help="The organization or entity that published this model",
    )

    model_use = fields.Selection(
        selection="_get_available_model_usages",
        required=True,
        default="chat",
    )
    default = fields.Boolean(default=False)
    active = fields.Boolean(default=True)

    # Model details
    details = fields.Json()
    details_str = fields.Text(
        string="Model Details",
        compute="_compute_details_str",
        store=False,
        help="Technical details about the model, such as architecture, training data, etc.",
    )
    model_info = fields.Json()
    model_info_str = fields.Text(
        string="Model Metadata",
        compute="_compute_details_str",
        store=False,
        help="Additional metadata about the model, such as capabilities, limitations, etc.",
    )
    parameters = fields.Text()
    template = fields.Text()

    # Inference Parameters
    context_window = fields.Integer(
        string="Context Window",
        default=4096,
        help="Maximum number of tokens the model can process in one request",
    )
    temperature = fields.Float(
        string="Temperature",
        default=0.7,
        help="Controls randomness: 0.0 = deterministic, 1.0 = very creative",
    )
    max_tokens = fields.Integer(
        string="Max Response Tokens",
        default=2048,
        help="Maximum number of tokens in the response",
    )
    top_p = fields.Float(
        string="Top P",
        default=0.9,
        help="Nucleus sampling: considers tokens with cumulative probability up to this value",
    )
    top_k = fields.Integer(
        string="Top K",
        default=40,
        help="Consider only the top K most likely tokens",
    )
    repeat_penalty = fields.Float(
        string="Repeat Penalty",
        default=1.1,
        help="Penalize repetition: 1.0 = no penalty, higher = less repetition",
    )
    request_timeout = fields.Float(
        string="Request Timeout (seconds)",
        default=60.0,
        help="How long to wait for a response from the model",
    )
    
    @api.depends("details")
    def _compute_details_str(self):
        """Convert model details JSON to a readable string"""
        for record in self:
            if record.details:
                try:
                    record.details_str = json.dumps(record.details, indent=2)
                except (TypeError, ValueError):
                    record.details_str = _("Invalid JSON format")
            else:
                record.details_str = ""

            if record.model_info:
                try:
                    record.model_info_str = json.dumps(record.model_info, indent=2)
                except (TypeError, ValueError):
                    record.model_info_str = _("Invalid JSON format")
            else:
                record.model_info_str = ""

    @api.model
    def _get_available_model_usages(self):
        return [
            ("embedding", "Embedding"),
            ("completion", "Completion"),
            ("chat", "Chat"),
            ("multimodal", "Multimodal"),
        ]

    @api.constrains('temperature')
    def _check_temperature(self):
        """Validate temperature range"""
        for record in self:
            if not (0.0 <= record.temperature <= 2.0):
                raise ValidationError(_("Temperature must be between 0.0 and 2.0"))

    @api.constrains('top_p')
    def _check_top_p(self):
        """Validate top_p range"""
        for record in self:
            if not (0.0 <= record.top_p <= 1.0):
                raise ValidationError(_("Top-P must be between 0.0 and 1.0"))

    @api.constrains('repeat_penalty')
    def _check_repeat_penalty(self):
        """Validate repeat_penalty range"""
        for record in self:
            if not (1.0 <= record.repeat_penalty <= 2.0):
                raise ValidationError(_("Repeat Penalty must be between 1.0 and 2.0"))

    @api.constrains('top_k')
    def _check_top_k(self):
        """Validate top_k range"""
        for record in self:
            if record.top_k < 1:
                raise ValidationError(_("Top-K must be at least 1"))

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        for record in records:
            if record.default:
                # Ensure only one default per provider/use combo
                self.search(
                    [
                        ("provider_id", "=", record.provider_id.id),
                        ("model_use", "=", record.model_use),
                        ("default", "=", True),
                        ("id", "!=", record.id),
                    ]
                ).write({"default": False})
        return records

    def chat(self, messages, stream=False, **kwargs):
        """Send chat messages using this model"""
        return self.provider_id.chat(messages, model=self, stream=stream, **kwargs)

    def embedding(self, texts):
        """Generate embeddings using this model"""
        return self.provider_id.embedding(texts, model=self)

    def action_open_fetch_this_model_wizard(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "name": f"Fetch Update for {self.name}",
            "res_model": "llm.fetch.models.wizard",
            "view_mode": "form",
            "target": "new",
            "context": {
                "default_provider_id": self.provider_id.id,
                "default_model_to_fetch": self.name,
            },
        }

    @api.constrains(
        "temperature",
        "top_p",
        "top_k",
        "repeat_penalty",
        "context_window",
        "max_tokens",
    )
    def _check_inference_parameters(self):
        """Validate inference parameter ranges"""
        for record in self:
            if record.temperature is not None and not (0.0 <= record.temperature <= 2.0):
                raise ValidationError(_("Temperature must be between 0.0 and 2.0"))

            if record.top_p is not None and not (0.0 <= record.top_p <= 1.0):
                raise ValidationError(_("Top P must be between 0.0 and 1.0"))

            if record.top_k is not None and record.top_k < 1:
                raise ValidationError(_("Top K must be at least 1"))

            if record.repeat_penalty is not None and record.repeat_penalty <= 0:
                raise ValidationError(_("Repeat penalty must be greater than 0"))

            if record.context_window and record.context_window < 1:
                raise ValidationError(_("Context window must be at least 1"))

            if record.max_tokens and record.max_tokens < 1:
                raise ValidationError(_("Max tokens must be at least 1"))

    @api.constrains("parameters")
    def _check_parameters_json(self):
        """Validate that parameters field contains valid JSON if not empty"""
        for record in self:
            if record.parameters:
                try:
                    json.loads(record.parameters)
                except (json.JSONDecodeError, ValueError):
                    raise ValidationError(_("Parameters field must contain valid JSON"))
