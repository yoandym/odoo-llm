# -*- coding: utf-8 -*-
import logging
import random
import re
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
        phone_number: str,
        thread_id: int,
        customer_name: Optional[str] = None,
        topic: Optional[str] = None,
        notes: Optional[str] = None,
        mode: Literal["test", "exec"] = "test",
    ) -> Dict[str, Any]:
        """
        Create a phone callback request for a customer

        Parameters:
            phone_number: Required. Phone number where customer can be reached
            customer_name: Optional. Name of the customer requesting callback
            topic: Optional. Topic of the callback request
            notes: Optional. Additional context about the customer's situation
            thread_id: ID of the LLM thread
            mode: How to execute the tool (test: only test if phone handover is available. exec: execute/create the phone callback activity)
        Returns:
            Dict with callback request status and message
        """
        if not thread_id:
            return {"available": False, "error": "Channel ID is required for handover"}

        _logger.debug(f"Executing Phone callback with: mode={mode}, thread_id={thread_id}")

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

    def _create_phone_callback_activity(self, discuss_channel, customer_name, phone_number, topic, notes):
        """Create a phone callback activity for an operator"""

        # validate parameters
        if not phone_number:
            raise Exception(_("Phone number is required"))

        # phone number basic validation
        # remove spaces, -, international format, numbers
        clean_phone = re.sub(r"\s+|[-]", " ", phone_number.strip())
        if not re.match(r"^\+\d{1,3}(?: \d+)+$", clean_phone):
            raise Exception(_("Invalid phone number format. Please use international format."))

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
        discuss_url = f"/web#action=mail.action_discuss&active_id={discuss_channel.id}"
        note += (
            f"<p><strong>Related to livechat:</strong> "
            f"<a href='{discuss_url}'>{discuss_channel.name}</a></p>"
        )

        # Create mail activity for the operator
        # Find call, todo or default activity type
        activity_type = self.env.ref("mail.mail_activity_data_call", False) or \
            self.env.ref("mail.mail_activity_data_todo", False) or \
            self.env["mail.activity.type"].search([("category", "=", "default")], limit=1)

        # Create activity on the operator's partner record
        model_id = self.env["ir.model"].search([("model", "=", "res.partner")], limit=1).id
        res_id = user_id.partner_id.id

        activity = self.env["mail.activity"].create(
            {
                "activity_type_id": activity_type.id,
                "note": note,
                "summary": summary,
                "user_id": user_id.id,
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
        unknown = _("Unknown")
        phone_callback = self._create_phone_callback_activity(
            discuss_channel=channel,
            customer_name=kwargs.get("customer_name", unknown),
            phone_number=kwargs["phone_number"],
            topic=kwargs.get("topic", unknown),
            notes=kwargs.get("notes", unknown),
        )

        # Prepare callback information
        callback_info = {"id": phone_callback.id, "customer_name": kwargs.get("customer_name", unknown), "phone_number": kwargs["phone_number"],
                         "topic": kwargs.get("topic", unknown)}

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
