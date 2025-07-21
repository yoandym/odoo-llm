# -*- coding: utf-8 -*-
import logging
from typing import Any, Dict, Optional

from odoo import _, api, models

_logger = logging.getLogger(__name__)


class LLMToolCRMLead(models.Model):
    _inherit = "llm.tool"

    @api.model
    def _get_available_implementations(self) -> list[tuple[str, str]]:
        implementations = super()._get_available_implementations()
        return implementations + [
            ("crm_lead", "CRM Lead Creation")
        ]

    def crm_lead_execute(
        self,
        name: str,
        contact_name: str,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        description: str = "",
        priority: str = "0",  # 0=Low, 1=Medium, 2=High, 3=Very High
        team_id: Optional[int] = None,
        type: str = "opportunity",  # opportunity or lead
        thread_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Create a CRM lead from an LLM conversation.
        
        This tool should only be used when the conversation has a clear commercial context
        and the customer is expressing interest in products, services, or requesting a quote.
        Do not use for general inquiries, technical support, or non-commercial conversations.
        
        Parameters:
            name: Title/subject of the lead
            contact_name: Name of the contact person
            email: Email address of the contact (optional)
            phone: Phone number of the contact (optional)
            description: Detailed description of the lead/opportunity
            priority: Priority level (0=Low, 1=Medium, 2=High, 3=Very High)
            team_id: ID of the sales team to assign (optional)
            type: Type of record to create (opportunity or lead)
            thread_id: ID of the discuss.channel creating this lead (optional)
            
        Returns:
            Dict with lead creation status and message
        """
        _logger.info(
            f"Creating CRM lead: {name}, contact: {contact_name}, priority: {priority}"
        )
        
        # Handle thread context if available
        thread = None
        if thread_id:
            thread = self.env['discuss.channel'].browse(thread_id)
        else:
            # Find the active thread for the current user/conversation
            context_thread = self.env.context.get('thread_id')
            if context_thread:
                thread = self.env['discuss.channel'].browse(context_thread)
            
        # Get the associated chat channel if this is a website livechat thread
        discuss_channel = None
        channel_name = ""
        if thread and thread.res_model == 'discuss.channel' and thread.res_id:
            discuss_channel = self.env['discuss.channel'].browse(thread.res_id)
            channel_name = discuss_channel.name
        
        # Validate lead type
        if type not in ["opportunity", "lead"]:
            type = "opportunity"  # Default to opportunity if invalid type
            
        # Validate priority
        if priority not in ["0", "1", "2", "3"]:
            priority = "0"  # Default to low priority if invalid
        
        # Construct lead values
        lead_values = {
            "name": name,
            "contact_name": contact_name,
            "description": description,
            "priority": priority,
            "type": type,
            "source_id": self.env.ref("crm.crm_source_website_chat", False).id,
            "active": True,
        }
        
        # Add optional values if present
        if email:
            lead_values["email_from"] = email
        if phone:
            lead_values["phone"] = phone
        if team_id:
            # Verify team exists
            team = self.env["crm.team"].browse(team_id).exists()
            if team:
                lead_values["team_id"] = team_id
        
        try:
            # Add additional context from the discussion if available
            if discuss_channel:
                # Get conversation summary for lead description
                messages = self.env["mail.message"].search([
                    ("model", "=", "discuss.channel"),
                    ("res_id", "=", discuss_channel.id)
                ], order="id asc", limit=20)
                
                conversation_summary = "\n\n".join([
                    f"{msg.author_id.name or 'Unknown'}: {msg.body}"
                    for msg in messages if msg.body
                ])
                
                if conversation_summary:
                    lead_values["description"] = (
                        f"{description}\n\n"
                        f"--- Chat Conversation Summary ---\n"
                        f"{conversation_summary}"
                    )
            
            # Create the lead
            lead = self.env["crm.lead"].create(lead_values)
            
            # Link the thread to the lead if available
            if thread:
                # Post a note in the lead chatter about the source
                thread_info = f"Created from {thread.name}" if thread.name else "Created from LLM conversation"
                if channel_name:
                    thread_info += f" (channel: {channel_name})"
                
                lead.message_post(
                    body=thread_info,
                    message_type="notification",
                    subtype_xmlid="mail.mt_note"
                )
            
            # Prepare success response
            success_message = _(
                "Thank you for your interest! I've created a lead in our system "
                "and our sales team will get back to you soon."
            )
            
            if email:
                success_message += _(" We'll contact you via email.")
            elif phone:
                success_message += _(" We'll call you back at the number you provided.")
            
            return {
                "status": "success",
                "lead_id": lead.id,
                "message": success_message,
                "trigger": "lead_created",
                "lead_info": {
                    "id": lead.id,
                    "name": lead.name,
                    "type": lead.type,
                    "team_id": lead.team_id.id if lead.team_id else False,
                }
            }
            
        except Exception as e:
            _logger.error(f"Error creating CRM lead: {e}")
            return {
                "status": "error",
                "message": _("I'm sorry, I couldn't create a lead in our system. "
                            "Please try again later or contact us directly."),
                "error": str(e)
            }
