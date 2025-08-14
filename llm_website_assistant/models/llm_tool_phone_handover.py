# -*- coding: utf-8 -*-
import logging
from typing import Any, Dict, Optional

from odoo import _, api, models

# Import the standard tool response schema
from odoo.addons.llm_tool.models.llm_tool_response_schema import FlowAction, StandardToolResponse
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)


class LLMToolPhoneHandover(models.Model):
    _inherit = "llm.tool"

    @api.model
    def _get_available_implementations(self) -> list[tuple[str, str]]:
        implementations = super()._get_available_implementations()
        return implementations + [("phone_callback", "Phone Callback Request")]

    def phone_handover_execute(
        self,
        customer_name: str,
        phone_number: str,
        topic: str,
        notes: str = "",
        thread_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Create a phone callback request for a customer

        Parameters:
            customer_name: Name of the customer requesting callback
            phone_number: Phone number where customer can be reached
            topic: Brief description of the topic or issue
            notes: Additional context about the customer's situation
            thread_id: ID of the LLM thread

        Returns:
            Dict with callback request status and message
        """
        _logger.info(f"Creating phone callback request for: {customer_name}, {phone_number}, topic: {topic}")

        # Get the LLM thread
        thread = None
        if thread_id:
            thread = self.env["discuss.channel"].browse(thread_id)
        else:
            # Find the active thread for the current user/conversation
            context_thread = self.env.context.get("thread_id")
            if context_thread:
                thread = self.env["discuss.channel"].browse(context_thread)

        # Get the associated chat channel if this is a website livechat thread
        discuss_channel = None
        if thread and thread.res_model == "discuss.channel" and thread.res_id:
            discuss_channel = self.env["discuss.channel"].browse(thread.res_id)

        # Create phone callback activity
        phone_callback = self._create_phone_callback_activity(
            customer_name=customer_name, phone_number=phone_number, topic=topic, notes=notes, discuss_channel=discuss_channel
        )

        # Prepare callback information
        callback_info = {"id": phone_callback.id, "customer_name": customer_name, "phone_number": phone_number, "topic": topic}

        # Prepare success message
        message = _(
            f"Thank you for providing your contact information. One of our representatives "
            f"will call you back at {phone_number} shortly to discuss '{topic}'."
        )

        # Return using the standard action tool response format
        # This is an action tool (creates a record) that also provides a flow directive
        return StandardToolResponse.create_action_tool_response(
            message=message,
            data={
                "callback_info": callback_info,
                "thread_id": thread_id if thread_id else thread.id if thread else None,
            },
            flow_action=FlowAction.PHONE_CALLBACK,
            flow_params={"callback_id": phone_callback.id},
        )

    def _process_tool_call(self, payload, thread, **kwargs):
        """Process the phone handover request"""
        _logger.info(f"Processing phone handover request: {payload}")

        try:
            # Extract data from the payload
            customer_name = payload.get("customer_name", "Unknown")
            phone_number = payload.get("phone_number", "")
            topic = payload.get("topic", "General inquiry")
            notes = payload.get("notes", "")

            if not phone_number:
                return {
                    "success": False,
                    "message": "Phone callback requires a valid phone number. Please ask the customer for their phone number.",
                    "data": {},
                }

            # Get the associated discuss channel if available
            discuss_channel = None
            if thread.res_model == "discuss.channel" and thread.res_id:
                discuss_channel = self.env["discuss.channel"].browse(thread.res_id)

            # Create a phone callback activity
            phone_callback = self._create_phone_callback_activity(
                customer_name=customer_name, phone_number=phone_number, topic=topic, notes=notes, discuss_channel=discuss_channel
            )

            # Prepare success response with handover information
            callback_info = {"id": phone_callback.id, "customer_name": customer_name, "phone_number": phone_number, "topic": topic}

            # Return success with callback information
            return {
                "success": True,
                "message": f"Phone callback request created for {customer_name} at {phone_number}. An operator will call back shortly.",
                "data": {
                    "trigger": "do_phone_handover",
                    "callback_info": callback_info,
                    "message": f"Thank you for providing your contact information. One of our representatives will call you back at {phone_number} shortly to discuss '{topic}'.",
                },
            }

        except Exception as e:
            _logger.error(f"Error processing phone handover: {e}")
            return {"success": False, "message": f"Failed to process phone handover request: {e}", "data": {}}

    def _create_phone_callback_activity(self, customer_name, phone_number, topic, notes, discuss_channel=None):
        """Create a phone callback activity for an operator"""
        # Find an available operator for the channel
        user_id = False
        if discuss_channel and discuss_channel.livechat_channel_id:
            livechat_channel = discuss_channel.livechat_channel_id
            available_operators = livechat_channel._get_available_users()
            if available_operators:
                user_id = available_operators[0].id

        # If no specific user found, assign to the admin
        if not user_id:
            admin = self.env.ref("base.user_admin", False)
            user_id = admin and admin.id or self.env.user.id

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
                f"<p><strong>Related to chat:</strong> "
                f"<a href='#' data-oe-model='discuss.channel' data-oe-id='{discuss_channel.id}'>{discuss_channel.name}</a></p>"
            )

        # Create mail activity as a to-do for the operator
        # Find todo activity type
        activity_type = self.env.ref("mail.mail_activity_data_todo", False) or self.env["mail.activity.type"].search(
            [("category", "=", "default")], limit=1
        )

        # Create activity on the livechat channel record
        model_id = self.env["ir.model"].search([("model", "=", "im_livechat.channel")], limit=1).id

        # Default to the first livechat channel if no specific channel is identified
        if discuss_channel and discuss_channel.livechat_channel_id:
            res_id = discuss_channel.livechat_channel_id.id
        else:
            livechat_channel = self.env["im_livechat.channel"].search([], limit=1)
            res_id = livechat_channel.id if livechat_channel else False

        if not res_id:
            raise ValidationError(_("No livechat channel found to create phone callback activity"))

        activity = self.env["mail.activity"].create(
            {
                "activity_type_id": activity_type.id,
                "note": note,
                "summary": summary,
                "user_id": user_id,
                "res_model_id": model_id,
                "res_id": res_id,
                # Set high importance
                # Remove priority field since it's not available
            }
        )

        return activity
