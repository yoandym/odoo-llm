from odoo import api, models


class LLMThread(models.Model):
    _inherit = "discuss.channel"

    @api.model_create_multi
    def create(self, vals_list):
        """
        Ensure that threads created from the website livechat context have source='website_livechat'.
        To trigger this, pass context={'from_website_livechat': True} when creating the thread.
        """
        for vals in vals_list:
            if self.env.context.get("from_website_livechat") and not vals.get("source"):
                vals["source"] = "website_livechat"

            # get assistant_id to fill in all other fields
            _assistant_id = vals.get("assistant_id")
            _assistant = self.env["llm.assistant"].browse(_assistant_id)
            if _assistant_id and _assistant.exists():
                # Ensure provider, model, prompt and tools are set from the assistant
                if not vals.get("provider_id"):
                    vals["provider_id"] = _assistant.provider_id.id
                if not vals.get("model_id"):
                    vals["model_id"] = _assistant.model_id.id
                if not vals.get("prompt"):
                    vals["prompt_id"] = _assistant.prompt_id.id
                if not vals.get("tool_ids"):
                    vals["tool_ids"] = [(6, 0, _assistant.tool_ids.ids)]

        return super().create(vals_list)

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
