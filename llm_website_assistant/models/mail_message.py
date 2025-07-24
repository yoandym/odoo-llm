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
                # In livechat, visitor messages have author_guest_id set or no author_id
                # and use the standard 'mail.mt_comment' subtype
                if (self.author_guest_id or not self.author_id) and self.subtype_id == self.env.ref("mail.mt_comment", False):
                    return True

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
                # In livechat, operator messages have author_id set (no guest)
                # and use the standard 'mail.mt_comment' subtype
                if self.author_id and not self.author_guest_id and self.subtype_id == self.env.ref("mail.mt_comment", False):
                    return True

        return is_standard_assistant
