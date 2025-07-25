from odoo import api, models


class LLMThread(models.Model):
    _inherit = "discuss.channel"

    def get_livechat_info(self, *args, **kwargs):
        """Override to add LLM information"""
        result = super().get_livechat_info(*args, **kwargs)

        # Add LLM info if this is a livechat channel
        if self.channel_type == "livechat" and hasattr(self, "assistant_id"):
            result.update(
                {
                    "assistant_id": self.assistant_id.id if self.assistant_id else False,
                }
            )

        return result


    def _get_message_subtypes(self):
        """Override to include both LLM and Livechat subtypes.

        Returns:
            list: List of subtype records
        """
        # Get standard LLM subtypes from parent implementation
        subtypes = super()._get_message_subtypes()

        # Add standard mail comment subtype
        mail_comment_subtype = self.env.ref("mail.mt_comment", raise_if_not_found=False)
        if mail_comment_subtype:
            subtypes.append(mail_comment_subtype)

        return subtypes

    def _get_user_subtype_xmlid(self):
        """Return the appropriate user subtype XMLID based on channel type.

        For livechat channels, use the standard mail comment subtype.
        Otherwise, use the standard LLM user subtype.

        Returns:
            str: XMLID of the user message subtype
        """
        # Check if this is a livechat channel
        if self.channel_type == "livechat":
            return "mail.mt_comment"

        # For all other cases, use the standard implementation
        return super()._get_user_subtype_xmlid()

    def _get_assistant_subtype_xmlid(self):
        """Return the appropriate assistant subtype XMLID based on channel type.

        For livechat channels, use the standard mail comment subtype.
        Otherwise, use the standard LLM assistant subtype.

        Returns:
            str: XMLID of the assistant message subtype
        """
        # Check if this is a livechat channel
        if self.channel_type == "livechat":
            return "mail.mt_comment"

        # For all other cases, use the standard implementation
        return super()._get_assistant_subtype_xmlid()
