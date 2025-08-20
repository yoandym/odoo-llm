# -*- coding: utf-8 -*-
"""
Reference Schema for LLM Tool Responses

This file defines the standard response format for LLM tools. It serves as a reference
and documentation for developers creating new tools or refactoring existing ones.

The goal is to standardize how tools communicate back to the LLM assistant and any
handlers that need to process the tool's output.

Note: This is currently a reference implementation. Enforcement of this schema
will be implemented in a future update.
"""
import logging
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from odoo import _

_logger = logging.getLogger(__name__)


class ToolStatus(Enum):
    """Standard status codes for tool execution results"""

    SUCCESS = "success"
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class StandardToolResponse:
    """
    Standard response format for LLM tools.

    This class defines the structure and validation rules for tool responses.
    It's not currently enforced but serves as documentation for the expected format.

    Three main types of tools:
    1. Information Tools - Retrieve or process information, no flow control
    2. Flow Control Tools - Signal need for conversation flow change
    3. Action Tools - Perform system actions and may also affect flow

    Each tool should return a dictionary with these standardized fields:
    - status: The execution status ("success", "error", etc.)
    - message: Human-readable message for the user
    - data: Tool-specific data payload
    - flow_action: Optional flow control directive
    - flow_params: Parameters for flow action
    """

    @staticmethod
    def create_response(
        status: Union[str, ToolStatus] = ToolStatus.SUCCESS,
        message: str = "",
        data: Optional[Dict[str, Any]] = None,
        flow_action: Optional[str] = None,
        flow_params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create a standardized tool response.

        Args:
            status: Execution status (success, error, warning, info)
            message: Human-readable message to display to the user
            data: Tool-specific data payload
            flow_action: Optional flow control directive (e.g., "forward_to_operator")
            flow_params: Optional parameters for the flow action

        Returns:
            Dictionary with the standardized response format
        """
        if isinstance(status, ToolStatus):
            status = status.value

        return {"status": status, "message": message, "data": data or {}, "flow_action": flow_action, "flow_params": flow_params or {}}

    @staticmethod
    def create_info_tool_response(message: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Helper for creating Information Tool responses"""
        return StandardToolResponse.create_response(status=ToolStatus.SUCCESS, message=message, data=data, flow_action=None)

    @staticmethod
    def create_flow_control_response(flow_action: str, message: str, flow_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Helper for creating Flow Control Tool responses"""
        return StandardToolResponse.create_response(
            status=ToolStatus.SUCCESS, message=message, data={}, flow_action=flow_action, flow_params=flow_params
        )

    @staticmethod
    def create_action_tool_response(
        message: str, data: Dict[str, Any], flow_action: Optional[str] = None, flow_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Helper for creating Action Tool responses"""
        return StandardToolResponse.create_response(
            status=ToolStatus.SUCCESS, message=message, data=data, flow_action=flow_action, flow_params=flow_params
        )

    @staticmethod
    def create_error_response(error_message: str) -> Dict[str, Any]:
        """Helper for creating error responses"""
        return StandardToolResponse.create_response(status=ToolStatus.ERROR, message=error_message)


# Standard flow action types that tools can request
class FlowAction:
    """
    Standard flow control actions that tools can request.

    When adding a new flow action:
    1. Add it as a constant here
    2. Add a corresponding _process_flow_action_{name} method to ChatbotScriptStep
    """

    # Flow control actions
    FORWARD_TO_OPERATOR = "forward_to_operator"  # LiveChat Hand over to human operator
    PHONE_CALLBACK = "phone_callback"  # Create phone callback request
    CREATE_TICKET = "create_ticket"  # Create helpdesk ticket
    CREATE_LEAD = "create_lead"  # Create CRM lead
    SCHEDULE_MEETING = "schedule_meeting"  # Schedule a meeting/call
    END_CONVERSATION = "end_conversation"  # End the conversation
    RETURN_TO_SCRIPT = "return_to_script"  # Return to standard script flow
    CONTINUE_CONVERSATION = "continue_conversation"  # Default - stay in LLM conversation


"""
Example Usage:

# Information Tool (knowledge retrieval)
def retrieve_knowledge(self, query, max_results=3):
    # Perform the search
    results = self._search_knowledge_base(query, max_results)

    return StandardToolResponse.create_info_tool_response(
        message=_("Here's what I found in our knowledge base:"),
        data={
            "query": query,
            "results": results
        }
    )

# Flow Control Tool (handover)
def livechat_handover_execute(self, reason="", thread_id=None, urgent=False):
    # Prepare handover message
    handover_message = _("I'll connect you with a human operator who can help you further.")
    if reason:
        handover_message = _(f"I'll connect you with a human operator who can help with: {reason}")

    return StandardToolResponse.create_flow_control_response(
        flow_action=FlowAction.FORWARD_TO_OPERATOR,
        message=handover_message,
        flow_params={
            "reason": reason,
            "urgent": urgent,
            "thread_id": thread_id
        }
    )

# Action Tool (ticket creation)
def create_helpdesk_ticket(self, subject, description, priority="normal", thread_id=None):
    # Create the actual ticket
    ticket = self.env['helpdesk.ticket'].create({
        'name': subject,
        'description': description,
        'priority': priority,
    })

    return StandardToolResponse.create_action_tool_response(
        message=_(f"I've created ticket #{ticket.id} for you: '{subject}'"),
        data={
            "ticket_id": ticket.id,
            "ticket_name": ticket.name
        }
    )

# Action Tool with flow control
def create_and_handover_ticket(self, subject, description, thread_id=None):
    # Create ticket...

    return StandardToolResponse.create_action_tool_response(
        message=_(f"I've created ticket #{ticket.id} and will connect you with an agent"),
        data={
            "ticket_id": ticket.id,
        },
        flow_action=FlowAction.FORWARD_TO_OPERATOR,
        flow_params={"ticket_id": ticket.id}
    )
"""
