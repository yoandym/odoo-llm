# -*- coding: utf-8 -*-
import logging
from typing import Any, Dict, Literal

from odoo import _, api, models
from odoo.addons.llm_tool.models.llm_tool_response_schema import FlowAction, StandardToolResponse

_logger = logging.getLogger(__name__)


class LLMToolLivechatHandover(models.Model):
    _inherit = "llm.tool"

    @api.model
    def _get_available_implementations(self) -> list[tuple[str, str]]:
        implementations = super()._get_available_implementations()
        return implementations + [("livechat_handover", "Livechat Handover to Human Operator")]

    def livechat_handover_execute(self, thread_id: int, mode: Literal["test", "exec"] = "test") -> Dict:
        """
        Handover a livechat conversation to a human operator.

        Parameters:
            thread_id: Required. ID of the channel (thread and channel is the same) requesting handover.
            mode: How to execute the tool (test: only test if handover is available. exec: execute the handover)

        Returns:
            Dict with handover state (availability, message, step_id, etc)
        """
        _logger.info(f"Executing Livechat Handover with: mode={mode}, thread_id={thread_id}")

        if not thread_id:
            return StandardToolResponse.create_error_response(error_message=_("Channel ID is required for handover"))

        try:
            # some validations
            channel = self.env["discuss.channel"].sudo().browse(int(thread_id))
            if not channel.exists():
                return StandardToolResponse.create_error_response(error_message=_("Channel not found"))

            if not channel.livechat_channel_id:
                return StandardToolResponse.create_error_response(error_message=_("Channel is not a livechat channel"))

            # execute desired mode
            _method = f"livechat_handover_{mode}_mode"
            if hasattr(self, _method):
                return getattr(self, _method)(channel)
            else:
                return StandardToolResponse.create_error_response(error_message=_("Wrong tool call: Invalid mode parameter"))

        except Exception as e:
            _logger.exception(e)
            return StandardToolResponse.create_error_response(error_message=_("Livechat handover to an operator failed: %s", str(e)))

    def _get_forward_operator_step(self, channel):
        """
        Get the first forward_operator step for the channel's chatbot script

        Args:
            channel: The channel for which to get the forward_operator step

        Returns:
            The forward_operator step

        Raises:
            Exception: If the forward_operator step cannot be found or created
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
            [
                ("chatbot_script_id", "=", chatbot_script.id),
                ("step_type", "=", "forward_operator"),
            ],
            limit=1,
        )

        if not forward_step:
            _msg = _("Chatbot script is not properly configured for livechat handover / forward to operator")
            _logger.error(_msg)
            raise Exception(_msg)

        return forward_step

    def livechat_handover_test_mode(self, channel):

        # Create or find a forward_operator step
        forward_step = self._get_forward_operator_step(channel)

        # check whether there are livechat operators online/available
        human_operator = channel.livechat_channel_id._get_operator(
            lang=channel.livechat_visitor_id.lang_id.code if hasattr(channel, "livechat_visitor_id") else None, country_id=channel.country_id.id
        )
        available = human_operator and human_operator != self.env.user
        step_msg = _("LiveChat handover to an operator is available") if available else _("LiveChat handover to an operator is not available")

        return StandardToolResponse.create_info_tool_response(
            message=step_msg,
            data={
                "available": available,
                "step_id": forward_step.id,
                "step_message": step_msg,
                "step_type": forward_step.step_type,
            },
        )

    def livechat_handover_exec_mode(self, channel):
        # the actual handover in this case is done at frontend level.
        # because of locking issues

        # Create or find a forward_operator step
        forward_step = self._get_forward_operator_step(channel)
        if not forward_step:
            return StandardToolResponse.create_error_response(error_message=_("Livechat Channel not properly configured for handover to operator"))

        # check whether there are livechat operators online/available
        human_operator = channel.livechat_channel_id._get_operator(
            lang=channel.livechat_visitor_id.lang_id.code if hasattr(channel, "livechat_visitor_id") else None, country_id=channel.country_id.id
        )
        available = human_operator and human_operator != self.env.user
        if not available:
            return StandardToolResponse.create_error_response(error_message=_("No available operators for livechat handover"))

        # do the handover
        forward_step._process_step(channel)

        step_msg = _("LiveChat handover in progress")

        _res = StandardToolResponse.create_flow_control_response(
            flow_action=FlowAction.FORWARD_TO_OPERATOR,
            message=step_msg,
            flow_params={
                "available": available,
                "thread_id": channel.id,
                "step_id": forward_step.id,
                "step_message": step_msg,
                "step_type": forward_step.step_type,
            },
        )

        # fire bus notification with _res as payload
        self.env["bus.bus"].sendone(
            "llm_website_assistant.flow_action",
            {
                "thread_id": channel.id,
                "step_id": forward_step.id,
                "step_message": step_msg,
                "step_type": forward_step.step_type,
            },
        )

        return _res
