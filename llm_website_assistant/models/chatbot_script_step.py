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

from odoo import api, fields, models

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
