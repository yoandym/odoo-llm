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

                    # If this is the operator or a chatbot message, it's an assistant message
                    if self.author_id == channel.livechat_operator_id:
                        return True
                    if chatbot_script and self.author_id == chatbot_script.sudo().operator_partner_id:
                        return True

        return is_standard_assistant
