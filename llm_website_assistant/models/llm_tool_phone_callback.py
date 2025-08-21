# -*- coding: utf-8 -*-
import logging
import random
from typing import Any, Dict, Literal, Optional

from odoo import _, api, models

# Import the standard tool response schema
from odoo.addons.llm_tool.models.llm_tool_response_schema import FlowAction, StandardToolResponse

_logger = logging.getLogger(__name__)


class LLMToolPhoneCallBack(models.Model):
    _inherit = "llm.tool"

    @api.model
    def _get_available_implementations(self) -> list[tuple[str, str]]:
        implementations = super()._get_available_implementations()
        return implementations + [("phone_callback", "Phone Callback Request")]

    def phone_callback_execute(
        self,
        customer_name: str,
        phone_number: str,
        topic: str = "",
        notes: str = "",
        thread_id: Optional[int] = None,
        mode: Literal["test", "exec"] = "test",
    ) -> Dict[str, Any]:
        """
        Create a phone callback request for a customer

        Parameters:
            customer_name: Name of the customer requesting callback
            phone_number: Phone number where customer can be reached
            topic: Topic of the callback request
            notes: Additional context about the customer's situation
            thread_id: ID of the LLM thread
            mode: How to execute the tool (test: only test if phone handover is available. exec: execute/create the phone callback activity)
        Returns:
            Dict with callback request status and message
        """
        if not thread_id:
            return {"available": False, "error": "Channel ID is required for handover"}

        _logger.info(f"Executing Livechat Handover with: mode={mode}, thread_id={thread_id}")

        try:
            # some validations
            channel = self.env["discuss.channel"].sudo().browse(int(thread_id))
            if not channel.exists():
                return StandardToolResponse.create_error_response(
                    error_message=_("Channel not found")
                )

            if not channel.livechat_channel_id:
                return StandardToolResponse.create_error_response(
                    error_message=_("Channel is not a livechat channel")
                )

            # execute desired mode
            _method = f"phone_callback_{mode}_mode"
            _kwargs = {"customer_name": customer_name, "phone_number": phone_number, "topic": topic, "notes": notes}
            if hasattr(self, _method):
                return getattr(self, _method)(channel, **_kwargs)
            else:
                return StandardToolResponse.create_error_response(
                    error_message=_("Wrong tool call: Invalid mode parameter")
                )

        except Exception as e:
            _logger.exception(e)
            return StandardToolResponse.create_error_response(
                error_message=_("Phone callback setup failed: %s", str(e))
            )

    def _get_operator(self, channel):
        # Find an operator for the channel
        _operator = False

        # First try an online one
        _operator = channel.livechat_channel_id._get_operator(
            lang=channel.livechat_visitor_id.lang_id.code if hasattr(channel, "livechat_visitor_id") else None, country_id=channel.country_id.id
        )

        # then try a random member
        if not _operator:
            user_ids = channel.livechat_channel_id.user_ids
            if user_ids:
                _operator = random.choice(user_ids)

        return _operator

    def _create_phone_callback_activity(self, customer_name, phone_number, topic, notes, discuss_channel):
        """Create a phone callback activity for an operator"""
        # Get an operator for the channel
        user_id = self._get_operator(discuss_channel)

        # If no specific user found, assign to the admin
        if not user_id:
            admin = self.env.ref("base.user_admin", False)
            user_id = admin

        # Format the summary and note content
        summary = f"Call {customer_name} at {phone_number}"
        note = f"""
<p><strong>Customer:</strong> {customer_name}</p>
<p><strong>Phone:</strong> {phone_number}</p>
<p><strong>Topic:</strong> {topic}</p>
<p><strong>Notes:</strong> {notes}</p>
"""
        if discuss_channel:
            note += (
                f"<p><strong>Related to livechat:</strong> "
                f"<a href='#' data-oe-model='discuss.channel' data-oe-id='{discuss_channel.id}'>{discuss_channel.name}</a></p>"
            )

        # Create mail activity as a to-do for the operator
        # Find todo activity type
        activity_type = self.env.ref("mail.mail_activity_data_todo", False) or self.env["mail.activity.type"].search(
            [("category", "=", "default")], limit=1
        )

        # Create activity on the livechat channel record
        model_id = self.env["ir.model"].search([("model", "=", "im_livechat.channel")], limit=1).id
        res_id = discuss_channel.livechat_channel_id.id

        activity = self.env["mail.activity"].create(
            {
                "activity_type_id": activity_type.id,
                "note": note,
                "summary": summary,
                "user_id": user_id,
                "res_model_id": model_id,
                "res_id": res_id,
            }
        )

        return activity

    def phone_callback_test_mode(self, channel, **kwargs):
        return StandardToolResponse.create_info_tool_response(
            message=_("Phone callback is available. An operator can call you back in office working hours."),
            data={
                "available": True,
            }
        )

    def phone_callback_exec_mode(self, channel, **kwargs):
        # Create phone callback activity
        phone_callback = self._create_phone_callback_activity(
            customer_name=kwargs.get("customer_name", "Unknown"),
            phone_number=kwargs.get("phone_number", "Unknown"),
            topic=kwargs.get("topic", "Unknown"),
            notes=kwargs.get("notes", "Unknown"),
            discuss_channel=kwargs.get("discuss_channel", False)
        )

        # Prepare callback information
        callback_info = {"id": phone_callback.id, "customer_name": kwargs.get("customer_name", "Unknown"), "phone_number": kwargs.get("phone_number", "Unknown"), "topic": kwargs.get("topic", "Unknown")}

        # Prepare success message
        message = _(
            f"Thank you for providing your contact information. One of our representatives "
            f"will call you back at {callback_info['phone_number']}, in office working hours, to discuss '{callback_info['topic']}'."
        )

        # Return using the standard action tool response format
        # This is an action tool (creates a record) that also provides a flow directive
        return StandardToolResponse.create_action_tool_response(
            message=message,
            data={
                "available": True,
                "callback_info": callback_info,
                "thread_id": channel.id,
            },
            flow_action=FlowAction.PHONE_CALLBACK,
            flow_params={"callback_id": phone_callback.id},
        )
