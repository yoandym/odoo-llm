# -*- coding: utf-8 -*-
"""
Chatbot Script Step Model

This model extends the standard chatbot script to support LLM-powered conversations.
It uses a dynamic dispatch pattern for handling different flow actions requested by tools.

Flow Action Extensibility Pattern:
----------------------------------
This module uses a dynamic dispatch pattern for handling flow actions, similar to how
Odoo handles step types in the im_livechat and crm_livechat modules:

1. Tools return standardized responses with a 'flow_action' field
2. The chatbot step looks for a method named '_process_flow_action_{action_name}'
3. If found, it calls that method with the response data
4. Each method returns the next step and parameters

To add a new flow action handler:
1. Define the flow action constant in llm_tool.models.llm_tool_response_schema.FlowAction
2. Add a method here named '_process_flow_action_{action_name}'
3. The method should return (next_step, params_dict)

This allows other modules to extend the flow handling without modifying this file.
"""
import logging

from odoo import _, api, fields, models
from odoo.tools import html2plaintext, plaintext2html

_logger = logging.getLogger(__name__)


class ChatbotScriptStep(models.Model):
    _inherit = "chatbot.script.step"

    # Add a new step type for LLM-processed input
    step_type = fields.Selection(
        selection_add=[("llm_processed_input", "LLM Processed Input")],
        ondelete={"llm_processed_input": "set default"},
    )

    is_llm_step = fields.Boolean(
        string="LLM Step",
        default=False,
        help="This step will use LLM to generate responses",
        compute="_compute_is_llm_step",
        store=True,
    )

    # No longer needed as we use chatbot_script_id.llm_assistant_id

    @api.depends("step_type")
    def _compute_is_llm_step(self):
        """Set is_llm_step based on step_type"""
        for step in self:
            step.is_llm_step = step.step_type == "llm_processed_input"

    def _fetch_next_step(self, selected_answer_ids):
        """Override to handle LLM steps specially

        For LLM steps, we stay on the same step since the LLM will handle the conversation flow.
        For standard scripts without LLM enabled or standard steps, we use the original logic.

        Args:
            selected_answer_ids: The selected answers from the previous step

        Returns:
            chatbot.script.step: The next step to display
        """
        if self.is_llm_step and self.chatbot_script_id.llm_assistant_id:
            # For LLM steps, we stay on the same step (the LLM will handle the conversation)
            return self

        # For standard steps, use the original logic
        return super()._fetch_next_step(selected_answer_ids)

    def _process_answer(self, discuss_channel, message_body):
        """Process the user's answer using LLM if applicable

        For LLM steps, this method:
        1. Saves the user's input to chatbot_message
        2. Prepares context for the controller to trigger LLM response
        3. Processes any flow actions in the response
        4. Updates the message with the LLM response

        Note: This method does NOT trigger LLM generation. The controller must call thread.generate.

        Args:
            discuss_channel (discuss.channel): The channel where the conversation happens
            message_body (str): The user's message HTML body

        Returns:
            chatbot.script.step: The next step to display
        """
        # Check if this is an LLM step in a chatbot with a configured assistant
        if self.is_llm_step and self.chatbot_script_id and self.chatbot_script_id.llm_assistant_id:
            _logger.info(f"Processing LLM step response for channel {discuss_channel.id}")

            try:
                # Get the user's message as plain text
                user_text = html2plaintext(message_body)

                # Store the user message in chatbot_message to maintain history
                chatbot_message = self.env["chatbot.message"].search(
                    [
                        ("discuss_channel_id", "=", discuss_channel.id),
                        ("script_step_id", "=", self.id),
                    ],
                    limit=1,
                )

                if chatbot_message:
                    chatbot_message.write({"user_raw_answer": user_text})

                # Prepare context for LLM assistant
                response_data = self._prepare_llm_streaming_context(message_body, discuss_channel)

                # Process the response according to the standardized tool response schema
                if isinstance(response_data, dict):
                    # Get the flow_action field (standardized schema)
                    flow_action = response_data.get("flow_action")

                    # Process flow actions using dynamic dispatch pattern
                    if flow_action:
                        _logger.info(f"LLM response contains flow action: {flow_action}")

                        # Get message if provided
                        if response_data.get("message"):
                            self.message = response_data.get("message")

                        # Dynamic dispatch to appropriate flow action handler
                        # Similar to how Odoo handles step types in im_livechat/crm_livechat
                        method_name = f"_process_flow_action_{flow_action}"
                        if hasattr(self, method_name):
                            method = getattr(self, method_name)
                            next_step, _ = method(response_data)
                            return next_step
                        else:
                            _logger.warning(f"No handler found for flow action: {flow_action}")
                            # Default behavior - stay in conversation
                            return self

                # Check if this is an async streaming response
                if isinstance(response_data, dict) and response_data.get("stream"):
                    # For async responses, the message will be generated later
                    # Store thread info in the channel's context for the controller
                    discuss_channel._context = dict(discuss_channel._context or {})
                    discuss_channel._context["llm_thread_id"] = response_data.get("thread_id")
                    discuss_channel._context["llm_assistant_id"] = response_data.get("assistant_id")

                    # Set the temporary message
                    self.message = response_data.get("message", "I'm thinking...")
                else:
                    # Handle sync responses (fallback)
                    response_text = None
                    if isinstance(response_data, dict):
                        # Get message from the standardized format
                        if response_data.get("message"):
                            response_text = response_data.get("message")
                    else:
                        response_text = response_data

                    if not response_text:
                        response_text = "I'm sorry, I couldn't generate a response. Let me connect you with a human operator."
                        _logger.warning(f"Empty LLM response for channel {discuss_channel.id}")

                        # Fall back to operator step
                        forward_operator_step = self.chatbot_script_id.script_step_ids.filtered(lambda step: step.step_type == "forward_operator")
                        if forward_operator_step:
                            return forward_operator_step[0]

                    # Update the message with the LLM response
                    self.message = response_text

                # Stay on this step to continue the LLM conversation
                return self

            except Exception as e:
                _logger.exception(f"Error processing LLM response: {e}")
                # Fall back to a standard error message
                self.message = "I'm sorry, I encountered an issue processing your request. Let me connect you with a human operator."

                # Try to redirect to operator
                forward_operator_step = self.chatbot_script_id.script_step_ids.filtered(lambda step: step.step_type == "forward_operator")
                if forward_operator_step:
                    return forward_operator_step[0]

                # Stay on this step as fallback
                return self

        # For standard steps, use the original logic
        return super(ChatbotScriptStep, self)._process_answer(discuss_channel, message_body)

    def _prepare_llm_streaming_context(self, message_body, discuss_channel):
        """Prepare context for async LLM response generation.

        This method does NOT trigger LLM generation. It only returns the identifiers needed
        for the controller to call thread.generate and start the LLM response.

        Args:
            message_body (str): The user's message HTML body
            discuss_channel (discuss.channel): The channel where the conversation happens

        Returns:
            dict: Response structure for async processing
        """
        llm_assistant = self.chatbot_script_id.llm_assistant_id
        if not llm_assistant:
            _logger.warning("No LLM assistant configured for this chatbot script")
            return "I'm sorry, I'm not configured properly. Please contact support."

        _logger.info(f"Preparing LLM streaming context for assistant {llm_assistant.name}")

        # Get plain text message
        user_message = html2plaintext(message_body).strip()

        try:
            thread = discuss_channel
            return {
                "type": "llm_streaming",
                "message": "I'm thinking...",
                "thread_id": thread.id,
                "assistant_id": llm_assistant.id,
                "stream": True,
            }
        except Exception as e:
            _logger.exception(f"Error preparing LLM streaming context: {e}")
            return "I'm sorry, I encountered an issue while processing your request. Please try again or contact support."

    def _format_for_frontend(self):
        """Override to add LLM-specific data for frontend rendering

        For LLM steps, we add:
        - isLlmStep: True to identify this as an LLM-powered step
        - type: Always set to llm_processed_input for consistent handling
        - expectAnswer: True to ensure user input is accepted

        Returns:
            dict: The formatted step data for frontend use
        """
        res = super()._format_for_frontend()

        if self.is_llm_step:
            res.update({"isLlmStep": True, "type": "llm_processed_input", "expectAnswer": True})

        return res

    def _process_flow_action_forward_to_operator(self, response_data):
        """Handle the forward_to_operator flow action - transfer to human agent"""
        _logger.info("Processing forward_to_operator flow action")
        # Route to operator step
        forward_operator_step = self.chatbot_script_id.script_step_ids.filtered(lambda step: step.step_type == "forward_operator")
        if forward_operator_step:
            return forward_operator_step[0], {}
        # Fallback if no operator step found
        return self, {}

    def _process_flow_action_phone_callback(self, response_data):
        """Handle the phone_callback flow action - schedule phone callback"""
        _logger.info("Processing phone_callback flow action")
        # Phone callback doesn't change the flow - user stays in conversation
        # We could add additional logic here to handle phone callback data if needed
        return self, {}

    def _process_flow_action_create_ticket(self, response_data):
        """Handle the create_ticket flow action - create helpdesk ticket"""
        _logger.info("Processing create_ticket flow action")
        # Ticket creation doesn't change the flow - user stays in conversation
        # We could add additional logic here to create helpdesk tickets if needed
        return self, {}

    def _process_step(self, discuss_channel):
        """Override to handle LLM steps specially

        For LLM steps, we need to:
        1. Set the current step in the discuss channel
        2. Process any previous user message with the LLM if needed
        3. Post the response to the channel

        For standard steps, we use the original logic.

        Args:
            discuss_channel (discuss.channel): The channel where the conversation happens

        Returns:
            mail.message: The message posted by the bot
        """
        # Check if this is an LLM step with a configured assistant
        if self.is_llm_step and self.chatbot_script_id and self.chatbot_script_id.llm_assistant_id:
            _logger.info(f"Processing LLM step for channel {discuss_channel.id}")

            # We change the current step to the new step (keep standard behavior)
            discuss_channel.chatbot_current_step_id = self.id

            # If this is the first interaction with the LLM step, we can use the default welcome message
            # Otherwise, we'd use the message set by _process_answer (which should have already run)
            if not self.message:
                # Set a default welcome message for first interaction with LLM
                self.message = _("Hello! I'm an AI assistant. How can I help you today?")

            # Convert message to HTML and make sure it's not None
            message_html = plaintext2html(self.message) if self.message else plaintext2html(_("I'm here to help!"))

            # Post the message to the channel using the standard method
            return discuss_channel._chatbot_post_message(self.chatbot_script_id, message_html)

        # For standard steps, use the original logic
        return super(ChatbotScriptStep, self)._process_step(discuss_channel)
