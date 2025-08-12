import logging

from odoo import models

_logger = logging.getLogger(__name__)


class Message(models.Model):
    """Extend mail.message with website assistant specific subtypes."""

    _inherit = "mail.message"

    def is_user_message(self):
        """Override to use standard mail subtypes for website assistant.

        Returns:
            bool: True if the message is a user/visitor message in livechat context
        """
        # First check parent implementation (standard LLM user message)
        is_user_msg = super().is_user_message()

        # Check if this is a message in a livechat channel from a visitor/guest
        if self.model == "discuss.channel":
            channel = self.env["discuss.channel"].browse(self.res_id)
            if channel.channel_type == "livechat" and self.message_type == "comment":
                # Using standard mail.mt_comment subtype
                if self.subtype_id == self.env.ref("mail.mt_comment", False):
                    # In livechat, we need to determine if the message is from a user
                    # We consider a message as user message if:
                    # 1. It's not from the livechat operator
                    # 2. It's not from a chatbot (checking chatbot_script.operator_partner_id)

                    # First, check if we have a chatbot script for this channel
                    chatbot_script = None
                    if hasattr(channel, "chatbot_current_step_id") and channel.chatbot_current_step_id:
                        chatbot_script = channel.chatbot_current_step_id.chatbot_script_id

                    # If the author is not the operator and not the chatbot, it's a user
                    if self.author_id not in [channel.livechat_operator_id, chatbot_script.sudo().operator_partner_id]:
                        return True  # It's a user message

        return is_user_msg

    def is_assistant_message(self):
        """Override to use standard mail subtypes for website assistant.

        Returns:
            bool: True if the message is an assistant/operator message in livechat context
        """
        # First check parent implementation (standard LLM assistant message)
        is_standard_assistant = super().is_assistant_message()

        # Check if this is a message in a livechat channel from an operator
        if self.model == "discuss.channel":
            channel = self.env["discuss.channel"].browse(self.res_id)
            if channel.channel_type == "livechat" and self.message_type == "comment":
                # Using standard mail.mt_comment subtype
                if self.subtype_id == self.env.ref("mail.mt_comment", False):
                    # For livechat, we need to determine if this is an assistant/operator message
                    # Check if this is from an AI assistant in a livechat context
                    # We consider it as assistant message if:
                    # 1. It's from the livechat operator
                    # OR
                    # 2. It's from a chatbot (which should be treated as assistant message for LLM context)

                    # First, check if we have a chatbot script for this channel
                    chatbot_script = None
                    if hasattr(channel, "chatbot_current_step_id") and channel.chatbot_current_step_id:
                        chatbot_script = channel.chatbot_current_step_id.chatbot_script_id

                    if chatbot_script and self.author_id == chatbot_script.sudo().operator_partner_id:
                        return True

        return is_standard_assistant

    def message_format(self, format_reply=True, msg_vals=None):
        """Override to filter tool messages in livechat context."""
        vals_list = super().message_format(format_reply=format_reply, msg_vals=msg_vals)

        # Filter out tool messages for livechat channels
        filtered_vals = []
        for vals in vals_list:
            # Check if this message should be hidden in livechat
            if self._should_hide_message_in_livechat(vals):
                self._replace_with_placeholder(vals)
            filtered_vals.append(vals)

        return filtered_vals

    def _should_hide_message_in_livechat(self, message_vals):
        """Determine if message should be hidden in livechat context."""
        # Get the message record to check context
        message = self.browse(message_vals["id"])

        # Only filter for livechat channels
        if message.model == "discuss.channel":
            channel = self.env["discuss.channel"].browse(message.res_id)
            if channel.channel_type == "livechat" and message.is_tool_result_message():
                # Hide tool result messages and tool-related content
                return True

        return False

    def _replace_with_placeholder(self, message_vals):
        """Replace message content with safe placeholder for livechat users.

        Args:
            message_vals (dict): Message data to modify in-place
        """
        # Keep all the original structure but replace sensitive content
        message_vals["body"] = "<p><em>Processing...</em></p>"
        message_vals["preview"] = "Processing..."

        # Keep the message visible but mark it as a system message
        if "is_note" not in message_vals:
            message_vals["is_note"] = True

        # Add a CSS class to style placeholder messages differently
        if "message_type" in message_vals:
            message_vals["message_type"] = "notification"

        # Optionally add metadata to identify this as a placeholder on frontend
        message_vals["is_tool_placeholder"] = True
