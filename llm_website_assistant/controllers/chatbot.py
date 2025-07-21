# -*- coding: utf-8 -*-

import logging
from typing import Any

from odoo import http
from odoo.addons.im_livechat.controllers.chatbot import LivechatChatbotScriptController
from odoo.http import request

_logger = logging.getLogger(__name__)


class LLMLivechatChatbotScriptController(LivechatChatbotScriptController):
    """Controller to handle LLM Chatbot Script"""

    def _valid_channel_and_chatbot(self, channel_uuid, chatbot_script_id) -> bool | tuple[Any, Any]:
        """Validate the discuss channel and chatbot script existence and link.

        Args:
            channel_uuid (str): UUID of the discuss channel.
            chatbot_script_id (int): ID of the chatbot script.

        Returns:
            bool | tuple[Any, Any]: (discuss_channel, chatbot_script), if both channel and chatbot exist. False otherwise
        """

        chatbot_language = self._get_chatbot_language()
        discuss_channel = request.env["discuss.channel"].with_context(lang=chatbot_language).sudo().search([("uuid", "=", channel_uuid)], limit=1)

        chatbot = request.env["chatbot.script"].sudo().browse(chatbot_script_id)
        if not discuss_channel.exists():
            return False

        if chatbot_script_id and not chatbot.exists():
            return False

        return (discuss_channel, chatbot)
