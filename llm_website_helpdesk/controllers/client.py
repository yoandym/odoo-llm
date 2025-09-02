# -*- coding: utf-8 -*-

import logging

from odoo import _, http
from odoo.http import request

_logger = logging.getLogger(__name__)


class HelpdeskAssistantController(http.Controller):
    """Controller for handling helpdesk assistant initialization requests from client instances"""

    @http.route("/helpdesk/assistance/init", type="json", auth="public", methods=["POST"], csrf=False)
    def init_assistance(self):
        """Endpoint to initialize the assistance chat for external clients

        This endpoint expects the following JSON data:
        {
            'user': {
                'name': 'User Name',
                'email': 'user@example.com',
                'phone': '+123-456-7890'
            },
            'company': {
                'name': 'Company Name',
                'partner_id': 'partner_id assigned by Provider',
                'access_token': 'access token for authentication',

            }
        }

        Returns:
        {
            'success': True/False,
            'livechat_url': URL to the livechat channel,
            'error': Error message if success is False
        }
        """
        try:
            # Extract and validate data
            data = request.jsonrequest
            company_data = data.get("company", {})

            if not company_data.get("partner_id") or not company_data.get("access_token"):
                return {"success": False, "error": _("Missing authentication credentials")}

            # Identify the client
            client = self._identify_client(company_data.get("partner_id"), company_data.get("access_token"))
            if not client:
                return {"success": False, "error": _("Invalid authentication credentials")}

            # Check if client has an active support contract
            if not self._has_active_contract(client):
                return {"success": False, "error": _("Your support contract has expired. Please contact your support provider to renew.")}

            # Get the appropriate livechat channel
            channel = self._get_livechat_channel(client)
            if not channel:
                return {"success": False, "error": _("No support channel available. Please contact your support provider directly.")}

            return {"success": True, "livechat_url": channel.web_page}

        except Exception as e:
            _logger.exception("Error in helpdesk assistant initialization: %s", str(e))
            return {"success": False, "error": _("An unexpected error occurred. Please try again later.")}

    def _identify_client(self, client_partner_id, access_token):
        """Identify the client using partner ID and access token"""
        client = request.env["res.partner"].sudo().search([("id", "=", client_partner_id), ("helpdesk_access_token", "=", access_token)], limit=1)

        return client if client else False

    def _has_active_contract(self, client):
        """Check if the client has an active support contract"""
        # This is a simplified implementation
        # In a real-world scenario, you'd check contract status, expiration, etc.
        if client:
            return True

        return False

    def _get_or_create_visitor_partner(self, client, data):
        """Get or create a website visitor partner record for the client user"""
        user_data = data.get("user", {})

        # Try to find an existing partner for this visitor
        # the visitor partner is expected to be a child of client's partner_id
        partner = (
            request.env["res.partner"].sudo().search([("parent_id", "=", client.partner_id.id), ("email", "=", user_data.get("email"))], limit=1)
        )

        if not partner:
            # Create a new partner record
            partner_vals = {
                "parent_id": client.partner_id.id,
                "name": user_data.get("name") or "Unknown",
                "email": user_data.get("email"),
                "phone": user_data.get("phone"),
                "type": "contact",
            }
            partner = request.env["res.partner"].sudo().create(partner_vals)

        return partner

    def _get_livechat_channel(self, client):
        """Get the appropriate livechat channel for the client

        If the client linked partner has an specific channel return it
        Else, use the channel linked to the website visitor.
        """
        partner = request.env["res.partner"].sudo().browse(client.partner_id.id)
        channel = partner.helpdesk_livechat_channel_id

        if channel:
            return channel

        website = request.env["website"].sudo().get_current_website()
        channel = website.channel_id

        return channel
