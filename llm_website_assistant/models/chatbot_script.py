# -*- coding: utf-8 -*-
import logging

from odoo import _, api, fields, models

_logger = logging.getLogger(__name__)


class ChatbotScript(models.Model):
    _inherit = "chatbot.script"

    # LLM configuration
    llm_assistant_id = fields.Many2one(
        "llm.assistant", string="LLM Assistant", domain="[('is_website_visible', '=', True)]", help="LLM assistant to use for this chatbot script"
    )

    is_llm_enabled = fields.Boolean(string="LLM Enabled", help="Whether this script has LLM capabilities enabled")

    # Make llm_assistant_id readonly if is_llm_enabled is False
    @api.onchange("is_llm_enabled")
    def _onchange_is_llm_enabled(self):
        """When disabling LLM, clear the assistant"""
        if not self.is_llm_enabled:
            self.llm_assistant_id = False

    def _format_for_frontend(self):
        """Override to include LLM information"""
        result = super(ChatbotScript, self)._format_for_frontend()

        if self.is_llm_enabled:
            result.update(
                {
                    "llm_enabled": True,
                    "llmAssistantId": self.llm_assistant_id.id,
                    "llmAssistantName": self.llm_assistant_id.name,
                }
            )

        return result

    def action_create_llm_steps(self):
        """Create or reset steps for an LLM chatbot

        This creates:
        1. LLM input step
        2. Operator forwarding step
        3. No operator available step (for creating tickets)
        4. Email collection step
        5. Confirmation step

        Returns:
            Action to reload the view
        """
        self.ensure_one()
        if not self.llm_assistant_id:
            return False

        _logger.info(f"Generating standard steps for LLM chatbot script {self.id}")

        # Remove existing steps if any
        self.script_step_ids.unlink()

        # The LLM wont start the conversation,
        # So, if present, use the channel's default_message as a welcome step
        # Otherwise, the user have to break the ice.
        channel = self.env["im_livechat.channel"].search([("rule_ids.chatbot_script_id", "=", self.id)], limit=1)

        # Create the llm input processed step
        self.env["chatbot.script.step"].create(
            {
                "chatbot_script_id": self.id,
                "message": channel.default_message or _("How can I assist you today?"),
                "step_type": "llm_processed_input",
            }
        )

        # Check the assistant has livechat handover tool
        livechat_handover = self._assistant_has_tool("livechat_handover")
        if livechat_handover:
            # Add the operator forwarding step
            self.env["chatbot.script.step"].create(
                {
                    "chatbot_script_id": self.id,
                    "message": "I'll connect you with a human agent who can help you further.",
                    "step_type": "forward_operator",
                }
            )

        phone_callback = self._assistant_has_tool("phone_callback")
        if phone_callback:
            # Add the phone callback step
            question_step = self.env["chatbot.script.step"].create(
                {
                    "chatbot_script_id": self.id,
                    "message": "None of our operators are available at the moment. Would you like an operator to call you back?",
                    "step_type": "question_selection",
                }
            )

            # Add the answer options to the question step
            answer_yes = self.env["chatbot.script.answer"].create({"name": "Yes", "script_step_id": question_step.id})
            self.env["chatbot.script.answer"].create({"name": "No", "script_step_id": question_step.id})

            # Add phone number collection step (triggered by "Yes" answer)
            self.env["chatbot.script.step"].create(
                {
                    "chatbot_script_id": self.id,
                    "message": "Please provide your phone number so we can get back to you:",
                    "step_type": "question_phone",
                    "triggering_answer_ids": [(6, 0, [answer_yes.id])],
                }
            )

        _logger.info(f"Successfully generated standard steps for LLM chatbot script {self.id}")

        # Return an action to reload the view
        return {
            "type": "ir.actions.client",
            "tag": "reload",
        }

    @api.model_create_multi
    def create(self, vals_list):

        # if is llm_enabled and have assistant_id
        # force the operator_partner_id to be assistant_id.partner_id

        for i in range(len(vals_list)):
            if vals_list[i].get("llm_enabled") and vals_list[i].get("assistant_id"):
                vals_list[i]["operator_partner_id"] = vals_list[i]["assistant_id"].partner_id.id

        return super().create(vals_list)

    def write(self, vals):
        # if is llm_enabled and have assistant_id
        # force the operator_partner_id to be assistant_id.partner_id

        if vals.get("llm_enabled") and vals.get("assistant_id"):
            vals["operator_partner_id"] = vals["assistant_id"].partner_id.id

        return super().write(vals)

    def _assistant_has_tool(self, tool_str_id):
        """Check if the assigned assistant has a specific tool/capability"""
        if not self.llm_assistant_id:
            return False

        # Option 1: Check by tool name/implementation
        _tool = self.llm_assistant_id.tool_ids.filtered(lambda tool: tool.implementation == tool_str_id)

        return bool(_tool)
