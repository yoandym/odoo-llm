import json
import logging
import re

from odoo import api, fields, models
from odoo.tools.safe_eval import safe_eval

_logger = logging.getLogger(__name__)


class LLMAssistant(models.Model):
    _name = "llm.assistant"
    _description = "LLM Assistant"
    _inherit = ["mail.thread"]
    _order = "name"

    name = fields.Char(
        string="Name",
        required=True,
        tracking=True,
    )
    active = fields.Boolean(default=True, tracking=True)

    # Default assistant flag
    is_default = fields.Boolean(
        string="Default Assistant",
        default=False,
        tracking=True,
        copy=False,
        help="If checked, this assistant will be used as the default for new threads. Only one assistant can be the default.",
    )

    # Assistant configuration
    provider_id = fields.Many2one(
        "llm.provider",
        string="Provider",
        ondelete="restrict",
        tracking=True,
    )
    model_id = fields.Many2one(
        "llm.model",
        string="Model",
        domain="[('provider_id', '=', provider_id)]",
        ondelete="restrict",
        tracking=True,
        required=False,
    )

    # Prompt template integration
    prompt_id = fields.Many2one(
        "llm.prompt",
        string="Prompt Template",
        ondelete="restrict",
        tracking=True,
        required=True,
        help="Prompt template to use for generating system prompts",
    )

    # Default values for prompt variables as JSON
    default_values = fields.Text(
        string="Default Values",
        help="JSON object with default values for prompt variables. Can include Python expressions that will be evaluated using safe_eval.",
        default="{}",
        tracking=True,
    )

    # Whether default values contain expressions to be evaluated
    has_dynamic_defaults = fields.Boolean(
        string="Has Dynamic Defaults",
        default=False,
        help="Enable if your default values contain Python expressions that should be evaluated",
        tracking=True,
    )

    # Evaluated default values (for API)
    evaluated_default_values = fields.Text(
        string="Evaluated Default Values",
        compute="_compute_evaluated_default_values",
        help="Default values with any expressions evaluated",
    )

    # Tools configuration
    tool_ids = fields.Many2many(
        "llm.tool",
        string="Preferred Tools",
        help="Tools that this assistant can use",
        tracking=True,
    )

    tool_config_ids = fields.One2many(
        "llm.assistant.tool.config",
        "assistant_id",
        string="Tool Configurations",
        help="Configuration parameters for tools used by this assistant",
    )

    # Stats
    thread_count = fields.Integer(
        string="Thread Count",
        compute="_compute_thread_count",
        help="Number of threads using this assistant",
    )
    thread_ids = fields.One2many(
        "discuss.channel",
        "assistant_id",
        string="Threads",
        help="Threads using this assistant",
        copy=False,
    )

    system_prompt_preview = fields.Text(
        string="System Prompt Preview",
        compute="_compute_system_prompt_preview",
        help="Preview of the formatted system prompt based on the prompt template",
        tracking=True,
    )

    # Default values for prompt variables as JSON
    prompt_variables = fields.Text(
        string="Prompt Variables",
        default="{}",
        help="Default values for prompt variables (JSON format)",
        tracking=True,
    )

    # Partner associated with this assistant
    # Used to set message's author_id, avatar, etc
    partner_id = fields.Many2one("res.partner", string="Partner", help="Partner associated with this assistant")

    def _prepare_partner_values(self):
        """Prepare values for partner creation

        Returns:
            dict: Values for creating a partner record
        """
        self.ensure_one()
        return {
            "name": self.name,
            "email": f"{self.name.lower().replace(' ', '.')}@ai",
            "comment": f"AI Assistant created automatically for {self.name}",
            "type": "other",
            "active": False,  # Archived by default like im_livechat does
            "company_id": False,  # No company, global partner
        }

    def _create_partner(self):
        """Create a partner for this assistant if none exists

        Returns:
            record: Created res.partner record
        """
        self.ensure_one()
        partner_values = self._prepare_partner_values()
        partner = self.env["res.partner"].create(partner_values)
        return partner

    def write(self, vals):
        """Override write to update partner name if assistant name changes"""
        result = super().write(vals)

        # If name has changed, update linked partner's name to match
        if "name" in vals and vals.get("name"):
            for assistant in self.filtered(lambda a: a.partner_id):
                assistant.partner_id.name = assistant.name

        # create partners for assistant without one
        for assistant in self.filtered(lambda a: not a.partner_id):
            partner = assistant._create_partner()
            assistant.partner_id = partner.id

        return result

    @api.depends("prompt_id", "default_values")
    def _compute_system_prompt_preview(self):
        """Compute preview of the formatted system prompt"""
        for assistant in self:
            messages = assistant.get_messages()
            assistant.system_prompt_preview = assistant._format_messages_as_markdown(messages)

    @api.depends("thread_ids")
    def _compute_thread_count(self):
        """Compute the number of threads using this assistant"""
        for assistant in self:
            assistant.thread_count = len(assistant.thread_ids)

    @api.depends("default_values", "has_dynamic_defaults")
    def _compute_evaluated_default_values(self):
        """Compute the evaluated default values for API use"""
        for assistant in self:
            assistant.evaluated_default_values = assistant.get_evaluated_default_values()

    def action_view_threads(self):
        """Open the threads using this assistant"""
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id("llm_thread.llm_thread_action")
        action["domain"] = [("assistant_id", "=", self.id)]
        action["context"] = {"default_assistant_id": self.id}
        return action

    @api.model_create_multi
    def create(self, vals_list):
        """Override create to ensure default_values is valid JSON"""
        # Check if any of the new records is being created as default
        has_default = any(vals.get("is_default") for vals in vals_list)

        # If creating a default assistant, ensure no other default exists
        if has_default:
            default_exists = self.search_count([("is_default", "=", True), ("active", "=", True)])
            if default_exists > 0:
                # Will need to unset the existing default
                existing_default = self.search([("is_default", "=", True), ("active", "=", True)], limit=1)
                existing_default.write({"is_default": False})
                _logger.info(
                    "Unset default flag on assistant '%s' (ID: %s) because a new default assistant is being created",
                    existing_default.name,
                    existing_default.id,
                )

        # If no default exists and this is the first assistant, make it default
        if not has_default and self.search_count([]) == 0:
            for vals in vals_list:
                vals["is_default"] = True
                break

        for vals in vals_list:
            if "default_values" in vals and vals["default_values"]:
                try:
                    json.loads(vals["default_values"])
                except json.JSONDecodeError:
                    vals["default_values"] = "{}"
        assistants = super().create(vals_list)

        # Create partners for assistants that don't have one
        for assistant in assistants.filtered(lambda a: not a.partner_id):
            partner = assistant._create_partner()
            assistant.partner_id = partner.id

        return assistants

    @api.onchange("prompt_id")
    def _onchange_prompt_id(self):
        """Update default_values when prompt_id changes"""
        if self.prompt_id:
            # Get the prompt arguments schema
            try:
                args_schema = json.loads(self.prompt_id.arguments_json or "{}")
                default_values = {}

                # Extract default values from schema
                for arg_name, arg_schema in args_schema.items():
                    if "default" in arg_schema:
                        default_values[arg_name] = arg_schema["default"]

                # If we have any defaults, update default_values
                if default_values:
                    self.default_values = json.dumps(default_values, indent=2)
            except json.JSONDecodeError:
                pass

    def get_formatted_system_prompt(self, thread=None):
        """Generate a formatted system prompt based on the prompt template

        Args:
            thread (discuss.channel): Optional thread that is requesting the prompt
                                If provided, it will be added to the context

        Returns:
            str: Formatted system prompt
        """
        self.ensure_one()

        if not self.prompt_id:
            return ""

        # If we have a thread, add it to the context so our enhanced
        # _substitute_placeholders method can access it
        if thread:
            # Create a context with the thread_id
            context = dict(self.env.context, thread_id=thread.id)

            # Get evaluated default values - user language is automatically included by get_evaluated_default_values
            default_values = self.get_evaluated_default_values(thread) or "{}"

            # Use the prompt with the new context
            return self.with_context(context).prompt_id.get_formatted_system_prompt(default_values)

        return self.prompt_id.get_formatted_system_prompt(self.get_evaluated_default_values() or "{}")

    def get_messages(self, thread=None):
        """Get a list of messages from the prompt template

        This method is the message-based equivalent of get_formatted_system_prompt.
        It uses the prompt's get_messages method to get a list of messages instead
        of a single system prompt string.

        Args:
            thread (discuss.channel): Optional thread that is requesting the messages
                               If provided, it will be added to the context

        Returns:
            list: List of message dictionaries in the format:
                [{"role": "system", "content": "..."},
                 {"role": "user", "content": "..."},
                 ...]
        """
        self.ensure_one()

        if not self.prompt_id:
            return []

        # Get the evaluated default values - user language is automatically included by get_evaluated_default_values
        default_values = self.get_evaluated_default_values(thread) or "{}"

        # If we have a thread, add it to the context
        if thread:
            # Create a context with the thread_id
            context = dict(self.env.context, thread_id=thread.id)
            # Use the prompt with the new context to get messages
            return self.with_context(context).prompt_id.get_messages(json.loads(default_values))

        # No thread, just get messages with default values
        return self.prompt_id.get_messages(json.loads(default_values))

    def get_evaluated_default_values(self, thread=None):
        """Evaluate default values, processing any Python expressions if has_dynamic_defaults is enabled

        Args:
            thread (discuss.channel): Optional thread to provide context for evaluation

        Returns:
            str: JSON string with evaluated default values
        """
        self.ensure_one()

        if not self.default_values:
            return "{}"

        try:
            # Parse the default values JSON
            default_values_dict = json.loads(self.default_values)

            # If dynamic defaults are enabled, evaluate expressions
            if self.has_dynamic_defaults:
                # Prepare evaluation context
                eval_context = {
                    "env": self.env,
                    "user": self.env.user,
                    "thread": thread,
                    "related_record": thread.get_related_record() if thread else None,
                }

                # Process each value that might contain expressions
                for key, value in default_values_dict.items():
                    if not isinstance(value, str):
                        continue

                    # Check if the value contains any ${...} expressions
                    if "${" in value and "}" in value:
                        # Handle the simple case where the entire string is a single expression
                        if value.startswith("${") and value.endswith("}") and value.count("${") == 1:
                            result = self._evaluate_single_expression(value, eval_context)
                            if result is not None:  # None indicates evaluation error
                                default_values_dict[key] = result
                        else:
                            # Handle the case with multiple embedded expressions
                            result_str = self._evaluate_embedded_expressions(value, eval_context)
                            default_values_dict[key] = result_str

            # Return the processed values as JSON
            return json.dumps(default_values_dict)

        except Exception as e:
            _logger.error(f"Error processing default_values: {e}")
            return "{}"

    def _get_json_fields(self):
        """Return fields that should be serialized as JSON in the API"""
        return ["default_values", "evaluated_default_values"]

    @api.model
    def get_assistant_by_id(self, assistant_id):
        """Get an assistant record by its ID

        Args:
            assistant_id (int): ID of the assistant

        Returns:
            tuple: (assistant, error_response)
                  If successful, error_response will be None
                  If error, assistant will be None
        """
        if not assistant_id:
            return None, None

        assistant = self.browse(int(assistant_id))
        if not assistant.exists():
            return None, {"success": False, "error": "Assistant not found"}
        return assistant, None

    def get_assistant_values(self, thread, include_prompt=True):
        """Get thread-specific evaluated default values for this assistant

        Args:
            thread (discuss.channel): Thread record
            include_prompt (bool): Whether to include prompt data

        Returns:
            dict: Result with evaluated default values and prompt data
        """
        self.ensure_one()

        # Get thread-specific evaluated default values
        evaluated_values = self.get_evaluated_default_values(thread)

        result = {
            "success": True,
            "thread_id": thread.id,
            "assistant_id": self.id,
            "default_values": self.default_values,
            "evaluated_default_values": evaluated_values,
        }

        # Get the prompt details if requested
        if include_prompt and self.prompt_id:
            prompt = self.prompt_id
            result["prompt"] = {
                "id": prompt.id,
                "name": prompt.name,
                "input_schema_json": prompt.input_schema_json,
            }

        return result

    def _evaluate_single_expression(self, value, eval_context):
        """Evaluate a single expression in the format ${expression}

        Args:
            value (str): String containing a single expression
            eval_context (dict): Context for safe_eval

        Returns:
            Any: Evaluated result or None if evaluation failed
        """
        # Extract the expression from ${...}
        expr = value[2:-1].strip()
        try:
            # Evaluate the expression using safe_eval
            result = safe_eval(expr, eval_context)
            return result
        except Exception as e:
            _logger.warning(f"Error evaluating expression '{expr}': {e}")
            # Return None to indicate evaluation error
            return None

    def _evaluate_embedded_expressions(self, value, eval_context):
        """Evaluate multiple embedded expressions in a string

        Args:
            value (str): String containing one or more ${expression} patterns
            eval_context (dict): Context for safe_eval

        Returns:
            str: String with all expressions evaluated
        """
        # Find all ${...} patterns
        pattern = r"\${([^}]*)}"
        matches = re.finditer(pattern, value)

        # Start with the original string
        result_str = value

        # Process each match
        for match in matches:
            full_match = match.group(0)  # The entire ${...} expression
            expr = match.group(1).strip()  # Just the expression inside

            try:
                # Evaluate the expression using safe_eval
                eval_result = safe_eval(expr, eval_context)
                # Replace the expression with its evaluated result
                result_str = result_str.replace(full_match, str(eval_result))
            except Exception as e:
                _logger.warning(f"Error evaluating embedded expression '{expr}': {e}")
                # Keep the original expression on error

        return result_str

    def _format_messages_as_markdown(self, messages):
        """Convert messages list to markdown formatted string

        Args:
            messages (list): List of message dictionaries

        Returns:
            str: Markdown formatted string
        """
        if not messages:
            return "No messages configured"

        markdown_parts = []

        for message in messages:
            role = message.get("role", "unknown").title()
            content = message.get("content", "")

            # Handle different content formats
            if isinstance(content, list):
                # Content is a list of content blocks
                text_parts = []
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        text_parts.append(block.get("text", ""))
                content_text = "\n\n".join(text_parts)
            elif isinstance(content, str):
                # Content is a simple string
                content_text = content
            else:
                content_text = str(content)

            # Create markdown section for this message
            markdown_parts.append(f"## {role} Message\n\n{content_text}")

        return "\n\n---\n\n".join(markdown_parts)

    @api.constrains("is_default")
    def _check_default_assistant(self):
        """Ensure that only one assistant can be the default at a time"""
        for assistant in self.filtered(lambda a: a.is_default):
            # Count other default assistants (excluding the current one)
            other_defaults = self.search_count(
                [
                    ("is_default", "=", True),
                    ("id", "!=", assistant.id),
                    ("active", "=", True),
                ]
            )

            if other_defaults > 0:
                # Unset the default flag on other assistants
                self.search(
                    [
                        ("is_default", "=", True),
                        ("id", "!=", assistant.id),
                        ("active", "=", True),
                    ]
                ).write({"is_default": False})

                # Log the change for audit purposes
                _logger.info(
                    "Assistant '%s' (ID: %s) set as default, unset %s other default assistant(s)", assistant.name, assistant.id, other_defaults
                )

    def get_default_assistant(self):
        """Find the default assistant or most used one if no default is set

        Returns:
            llm.assistant: The default assistant record or None
        """
        # First try to find the explicitly marked default assistant
        default = self.search([("is_default", "=", True)], limit=1)

        if default:
            return default

        # If no default is explicitly set, use the most used assistant
        most_used = self.search([("active", "=", True)], order="thread_count desc", limit=1)
        if most_used:
            return most_used

        # No assistants found
        return None

    @api.model
    def get_assistant_for_new_thread(self):
        """Get the assistant to use for a new thread

        Returns:
            dict: Dictionary with assistant data or empty dict if no assistant
        """
        default_assistant = self.get_default_assistant()

        if not default_assistant:
            return {}

        # Return basic assistant data needed for new threads
        return {
            "id": default_assistant.id,
            "name": default_assistant.name,
            "provider_id": default_assistant.provider_id.id if default_assistant.provider_id else False,
            "model_id": default_assistant.model_id.id if default_assistant.model_id else False,
            "tool_ids": default_assistant.tool_ids.ids,
        }

    @api.onchange("prompt_id")
    def _onchange_prompt_id(self):
        """Update default_values when prompt_id changes"""
        if self.prompt_id:
            # Get the prompt arguments schema
            try:
                args_schema = json.loads(self.prompt_id.arguments_json or "{}")
                default_values = {}

                # Extract default values from schema
                for arg_name, arg_schema in args_schema.items():
                    if "default" in arg_schema:
                        default_values[arg_name] = arg_schema["default"]

                # If we have any defaults, update default_values
                if default_values:
                    self.default_values = json.dumps(default_values, indent=2)
            except json.JSONDecodeError:
                pass

    def get_formatted_system_prompt(self, thread=None):
        """Generate a formatted system prompt based on the prompt template

        Args:
            thread (discuss.channel): Optional thread that is requesting the prompt
                                If provided, it will be added to the context

        Returns:
            str: Formatted system prompt
        """
        self.ensure_one()

        if not self.prompt_id:
            return ""

        # If we have a thread, add it to the context so our enhanced
        # _substitute_placeholders method can access it
        if thread:
            # Create a context with the thread_id
            context = dict(self.env.context, thread_id=thread.id)

            # Get evaluated default values - user language is automatically included by get_evaluated_default_values
            default_values = self.get_evaluated_default_values(thread) or "{}"

            # Use the prompt with the new context
            return self.with_context(context).prompt_id.get_formatted_system_prompt(default_values)

        return self.prompt_id.get_formatted_system_prompt(self.get_evaluated_default_values() or "{}")

    def get_messages(self, thread=None):
        """Get a list of messages from the prompt template

        This method is the message-based equivalent of get_formatted_system_prompt.
        It uses the prompt's get_messages method to get a list of messages instead
        of a single system prompt string.

        Args:
            thread (discuss.channel): Optional thread that is requesting the messages
                               If provided, it will be added to the context

        Returns:
            list: List of message dictionaries in the format:
                [{"role": "system", "content": "..."},
                 {"role": "user", "content": "..."},
                 ...]
        """
        self.ensure_one()

        if not self.prompt_id:
            return []

        # Get the evaluated default values - user language is automatically included by get_evaluated_default_values
        default_values = self.get_evaluated_default_values(thread) or "{}"

        # If we have a thread, add it to the context
        if thread:
            # Create a context with the thread_id
            context = dict(self.env.context, thread_id=thread.id)
            # Use the prompt with the new context to get messages
            return self.with_context(context).prompt_id.get_messages(json.loads(default_values))

        # No thread, just get messages with default values
        return self.prompt_id.get_messages(json.loads(default_values))

    def get_evaluated_default_values(self, thread=None):
        """Evaluate default values, processing any Python expressions if has_dynamic_defaults is enabled

        Args:
            thread (discuss.channel): Optional thread to provide context for evaluation

        Returns:
            str: JSON string with evaluated default values
        """
        self.ensure_one()

        if not self.default_values:
            return "{}"

        try:
            # Parse the default values JSON
            default_values_dict = json.loads(self.default_values)

            # If dynamic defaults are enabled, evaluate expressions
            if self.has_dynamic_defaults:
                # Prepare evaluation context
                eval_context = {
                    "env": self.env,
                    "user": self.env.user,
                    "thread": thread,
                    "related_record": thread.get_related_record() if thread else None,
                }

                # Process each value that might contain expressions
                for key, value in default_values_dict.items():
                    if not isinstance(value, str):
                        continue

                    # Check if the value contains any ${...} expressions
                    if "${" in value and "}" in value:
                        # Handle the simple case where the entire string is a single expression
                        if value.startswith("${") and value.endswith("}") and value.count("${") == 1:
                            result = self._evaluate_single_expression(value, eval_context)
                            if result is not None:  # None indicates evaluation error
                                default_values_dict[key] = result
                        else:
                            # Handle the case with multiple embedded expressions
                            result_str = self._evaluate_embedded_expressions(value, eval_context)
                            default_values_dict[key] = result_str

            # Return the processed values as JSON
            return json.dumps(default_values_dict)

        except Exception as e:
            _logger.error(f"Error processing default_values: {e}")
            return "{}"

    def _get_json_fields(self):
        """Return fields that should be serialized as JSON in the API"""
        return ["default_values", "evaluated_default_values"]

    @api.model
    def get_assistant_by_id(self, assistant_id):
        """Get an assistant record by its ID

        Args:
            assistant_id (int): ID of the assistant

        Returns:
            tuple: (assistant, error_response)
                  If successful, error_response will be None
                  If error, assistant will be None
        """
        if not assistant_id:
            return None, None

        assistant = self.browse(int(assistant_id))
        if not assistant.exists():
            return None, {"success": False, "error": "Assistant not found"}
        return assistant, None

    def get_assistant_values(self, thread, include_prompt=True):
        """Get thread-specific evaluated default values for this assistant

        Args:
            thread (discuss.channel): Thread record
            include_prompt (bool): Whether to include prompt data

        Returns:
            dict: Result with evaluated default values and prompt data
        """
        self.ensure_one()

        # Get thread-specific evaluated default values
        evaluated_values = self.get_evaluated_default_values(thread)

        result = {
            "success": True,
            "thread_id": thread.id,
            "assistant_id": self.id,
            "default_values": self.default_values,
            "evaluated_default_values": evaluated_values,
        }

        # Get the prompt details if requested
        if include_prompt and self.prompt_id:
            prompt = self.prompt_id
            result["prompt"] = {
                "id": prompt.id,
                "name": prompt.name,
                "input_schema_json": prompt.input_schema_json,
            }

        return result

    def _evaluate_single_expression(self, value, eval_context):
        """Evaluate a single expression in the format ${expression}

        Args:
            value (str): String containing a single expression
            eval_context (dict): Context for safe_eval

        Returns:
            Any: Evaluated result or None if evaluation failed
        """
        # Extract the expression from ${...}
        expr = value[2:-1].strip()
        try:
            # Evaluate the expression using safe_eval
            result = safe_eval(expr, eval_context)
            return result
        except Exception as e:
            _logger.warning(f"Error evaluating expression '{expr}': {e}")
            # Return None to indicate evaluation error
            return None

    def _evaluate_embedded_expressions(self, value, eval_context):
        """Evaluate multiple embedded expressions in a string

        Args:
            value (str): String containing one or more ${expression} patterns
            eval_context (dict): Context for safe_eval

        Returns:
            str: String with all expressions evaluated
        """
        # Find all ${...} patterns
        pattern = r"\${([^}]*)}"
        matches = re.finditer(pattern, value)

        # Start with the original string
        result_str = value

        # Process each match
        for match in matches:
            full_match = match.group(0)  # The entire ${...} expression
            expr = match.group(1).strip()  # Just the expression inside

            try:
                # Evaluate the expression using safe_eval
                eval_result = safe_eval(expr, eval_context)
                # Replace the expression with its evaluated result
                result_str = result_str.replace(full_match, str(eval_result))
            except Exception as e:
                _logger.warning(f"Error evaluating embedded expression '{expr}': {e}")
                # Keep the original expression on error

        return result_str

    def _format_messages_as_markdown(self, messages):
        """Convert messages list to markdown formatted string

        Args:
            messages (list): List of message dictionaries

        Returns:
            str: Markdown formatted string
        """
        if not messages:
            return "No messages configured"

        markdown_parts = []

        for message in messages:
            role = message.get("role", "unknown").title()
            content = message.get("content", "")

            # Handle different content formats
            if isinstance(content, list):
                # Content is a list of content blocks
                text_parts = []
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        text_parts.append(block.get("text", ""))
                content_text = "\n\n".join(text_parts)
            elif isinstance(content, str):
                # Content is a simple string
                content_text = content
            else:
                content_text = str(content)

            # Create markdown section for this message
            markdown_parts.append(f"## {role} Message\n\n{content_text}")

        return "\n\n---\n\n".join(markdown_parts)

    def copy(self, default=None):
        """Override copy to set name to 'Original Name (copy)'"""
        self.ensure_one()
        default = dict(default or {})
        default["name"] = f"{self.name} (copy)"
        return super().copy(default)
