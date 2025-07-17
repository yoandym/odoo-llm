# -*- coding: utf-8 -*-
import logging
from typing import Any, Dict, Optional

from odoo import _, api, models

# Import the standard tool response schema
from odoo.addons.llm_tool.models.llm_tool_response_schema import FlowAction, StandardToolResponse

_logger = logging.getLogger(__name__)


class LLMToolLivechatHandover(models.Model):
    _inherit = "llm.tool"

    @api.model
    def _get_available_implementations(self) -> list[tuple[str, str]]:
        implementations = super()._get_available_implementations()
        return implementations + [("livechat_handover", "Livechat Handover to Human Operator")]

    def livechat_handover_execute(
        self,
        reason: str = "",
        thread_id: Optional[int] = None,
        urgent: bool = False,
    ) -> Dict[str, Any]:
        """
        Handover a livechat conversation to a human operator.

        Parameters:
            reason: The reason for the handover, to be shown to the human operator
            thread_id: ID of the thread requesting handover
            urgent: Whether this handover should be treated as urgent

        Returns:
            Dict with handover status and message
        """
        _logger.info(f"Executing Livechat Handover with: reason={reason}, thread_id={thread_id}, urgent={urgent}")

        # Default handover message
        handover_message = _("I'll connect you with a human operator who can help you further.")
        if reason:
            handover_message = _(f"I'll connect you with a human operator who can help with: {reason}")

        # Add priority note for urgent requests
        if urgent:
            handover_message = _("This is an urgent request. ") + handover_message

        # Return the handover flow control response using the standard format
        return StandardToolResponse.create_flow_control_response(
            flow_action=FlowAction.FORWARD_TO_OPERATOR,
            message=handover_message,
            flow_params={"reason": reason, "urgent": urgent, "thread_id": thread_id},
        )
