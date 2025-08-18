# -*- coding: utf-8 -*-
import logging
from typing import Any, Dict

from odoo import _, api, models

_logger = logging.getLogger(__name__)


class LLMToolLivechatHandover(models.Model):
    _inherit = "llm.tool"

    @api.model
    def _get_available_implementations(self) -> list[tuple[str, str]]:
        implementations = super()._get_available_implementations()
        return implementations + [("livechat_handover", "Livechat Handover to Human Operator")]

    def livechat_handover_execute(self, thread_id: int, reason: str = "") -> Dict[str, Any]:
        """
        Handover a livechat conversation to a human operator.

        Parameters:
            thread_id: Required. ID of the channel (thread and channel is the same) requesting handover.
            reason: The reason for the handover, to be shown to the human operator

        Returns:
            Dict with handover status and message
        """
        if not thread_id:
            return {"success": False, "error": "Channel ID is required for handover"}

        _logger.info(f"Executing Livechat Handover with: reason={reason}, thread_id={thread_id}")

        try:
            channel = self.env["discuss.channel"].sudo().browse(int(thread_id))
            if not channel.exists():
                return {"success": False, "error": "Channel not found"}

            # Check if channel has livechat capability
            if not channel.livechat_channel_id:
                return {"success": False, "error": "Channel is not a livechat channel"}

            # Create or find a forward_operator step
            forward_step = self._get_forward_operator_step(channel)
            if not forward_step:
                return {"success": False, "error": "Could not get or create a forward operator step"}

            # Process the forward_operator step (this triggers the handover)
            posted_message = forward_step._process_step(channel)

            # Check if operator was found by examining channel members
            operator_found = len(channel.channel_member_ids) > 2  # visitor + bot + operator

            if operator_found:
                return {
                    "success": True,
                    "message": "Successfully handed over to a live operator",
                    "operator_found": True,
                    "posted_message_id": posted_message.id if posted_message else None,
                }
            else:
                # No operator available - reset to allow LLM to continue
                channel.chatbot_current_step_id = False
                return {
                    "success": False,
                    "message": "No operators are currently available",
                    "action": "no_operator_available",
                    "operator_found": False,
                }

        except Exception as e:
            _logger.exception(f"Livechat handover failed for channel {thread_id}")
            return {"success": False, "error": f"Handover failed: {str(e)}"}

    def _get_forward_operator_step(self, channel):
        """
        Get the first forward_operator step for the channel's chatbot script
        """
        # Check if channel has an associated chatbot script
        chatbot_script = None

        # Try to get from current step
        if channel.chatbot_current_step_id:
            chatbot_script = channel.chatbot_current_step_id.chatbot_script_id
        else:
            _msg = _(f"Could not determine chatbot script for channel: {channel.id}")
            _logger.error(_msg)
            raise Exception(_msg)

        # Look for existing forward_operator step
        forward_step = self.env["chatbot.script.step"].search(
            [("chatbot_script_id", "=", chatbot_script.id), ("step_type", "=", "forward_operator")], limit=1
        )

        if not forward_step:
            _msg = _("Chatbot script is not properly configured for livechat handover / forward to operator")
            _logger.error(_msg)
            raise Exception(_msg)

        return forward_step
