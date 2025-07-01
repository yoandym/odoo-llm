# -*- coding: utf-8 -*-

import logging
from jinja2 import Environment, Undefined

from odoo import api, fields, models

_logger = logging.getLogger(__name__)

# Module-level Jinja2 environment for performance
_jinja_env = None

def get_jinja_env():
    """Get or create the shared Jinja2 environment"""
    global _jinja_env
    if _jinja_env is None:
        _jinja_env = Environment(
            variable_start_string="{{",
            variable_end_string="}}",
            trim_blocks=True,
            lstrip_blocks=True,
            undefined=Undefined,
            cache_size=1000,
            auto_reload=False,
        )
        
        # Add useful filters
        _jinja_env.filters['default'] = lambda value, default='': value if value not in (None, False, '') else default
        _jinja_env.filters['upper'] = lambda s: str(s).upper() if s else ''
        _jinja_env.filters['lower'] = lambda s: str(s).lower() if s else ''
        _jinja_env.filters['title'] = lambda s: str(s).title() if s else ''
        _jinja_env.filters['capitalize'] = lambda s: str(s).capitalize() if s else ''
        
        # Add date formatting filter
        def format_date(value, format='%Y-%m-%d'):
            if not value:
                return ''
            if isinstance(value, str):
                return value
            return value.strftime(format)
        _jinja_env.filters['date'] = format_date
        
    return _jinja_env


class LLMPromptTemplate(models.Model):
    _name = "llm.prompt.template"
    _description = "LLM Prompt Template"
    _order = "sequence, id"

    sequence = fields.Integer(
        string="Sequence",
        default=10,
        help="Order in which templates are processed",
    )
    prompt_id = fields.Many2one(
        "llm.prompt",
        string="Prompt",
        required=True,
        ondelete="cascade",
    )
    role = fields.Selection(
        [
            ("user", "User"),
            ("assistant", "Assistant"),
            ("system", "System"),
        ],
        string="Role",
        default="user",
        required=True,
        help="Role of this template in the conversation",
    )
    content = fields.Text(
        string="Content",
        required=True,
        help="Content of this template with placeholders for arguments (use {{argument_name}})",
    )
    condition = fields.Char(
        string="Execution Condition",
        help="Python expression determining whether to include this template (e.g., 'debug' in arguments)",
    )
    used_arguments = fields.Char(
        string="Used Arguments",
        compute="_compute_used_arguments",
        help="Arguments used in this template",
    )

    @api.depends("content")
    def _compute_used_arguments(self):
        """Compute arguments used in this template"""
        for template in self:
            if not template.content:
                template.used_arguments = ""
                continue

            args = template.prompt_id._extract_arguments_from_template(template.content)
            template.used_arguments = ", ".join(sorted(args)) if args else ""

    def _substitute_placeholders(self, content, arguments):
        """Replace placeholders with values using unified context"""
        # Build the context object
        ctx = self.env.context
        
        # Get Jinja2 environment
        env = get_jinja_env()
        
        # Create template variables
        template_vars = {
            # Add context object
            'ctx': ctx,
            
            # Add top-level shortcuts for convenience
            'user': ctx['user'],
            'env': ctx['env'],
            'thread': ctx['thread'],
            'record': ctx['record'],
            'now': ctx['now'],
            'args': ctx['args'],
        }
        
        # Add any remaining arguments that aren't in args (like formatted ones)
        for key, value in arguments.items():
            if not key.startswith('_') and key not in template_vars:
                template_vars[key] = value
        
        # Render template
        try:
            template = env.from_string(content)
            return template.render(**template_vars)
        except Exception as e:
            _logger.error(f"Error rendering template: {e}")
            _logger.error(f"Content: {content}")
            _logger.error(f"Variables: {list(template_vars.keys())}")
            raise

    def get_template_message(self, arguments=None):
        """Generate a message for this template with the given arguments"""
        self.ensure_one()
        arguments = arguments or {}

        # Check if condition is satisfied
        if self.condition:
            try:
                if not self._evaluate_condition(self.condition, arguments):
                    return None
            except Exception as e:
                _logger.error(f"Error evaluating condition for template {self.id}: {e}")
                return None

        # Replace argument placeholders in content
        content = self._substitute_placeholders(self.content, arguments)

        # Create the message
        return {
            "role": self.role,
            "content": content,
        }

    def _evaluate_condition(self, condition, arguments):
        """Evaluate the execution condition"""
        # Build context for evaluation
        ctx = self._build_context_object(arguments)
        
        # Create evaluation context with all available data
        eval_context = {
            'arguments': arguments,
            'args': ctx['args'],
            'user': ctx['user'],
            'env': ctx['env'],
            'thread': ctx['thread'],
            'record': ctx['record'],
            'now': ctx['now'],
        }
        
        # Add individual arguments for backward compatibility
        for k, v in arguments.items():
            if not k.startswith('_'):
                eval_context[k] = v

        # Evaluate the condition expression
        try:
            result = eval(condition, {"__builtins__": {}}, eval_context)
            return bool(result)
        except Exception as e:
            _logger.error(f"Error evaluating condition '{condition}': {e}")
            return False
