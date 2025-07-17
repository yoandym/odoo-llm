# -*- coding: utf-8 -*-
import json
import logging

from odoo import http
from odoo.addons.im_livechat.controllers.main import LivechatController
from odoo.http import Response, request
from werkzeug.exceptions import BadRequest

_logger = logging.getLogger(__name__)


class LlmLivechatController(LivechatController):
    """Controller to handle LLM Website Assistant functionality"""

    @http.route()
    def livechat_init(self, channel_id):
        """Override the original /im_livechat/init endpoint to handle LLM assistants"""
        # Get the standard result first
        result = super().livechat_init(channel_id)

        # The original implementation does not handle LLM assistants,
        # so we need to check for a matching rule's assistant_type and and assistant_id
        matching_channel_rule = self._get_matching_rule(channel_id)

        if matching_channel_rule and matching_channel_rule.chatbot_script_id and matching_channel_rule.chatbot_script_id.is_llm_enabled:
            # Add LLM-specific attributes to the result
            result["rule"]["chatbot"].update(
                {
                    "isLlmEnabled": True,
                    "llmAssistantId": matching_channel_rule.chatbot_script_id.llm_assistant_id.id,
                    "llmAssistantName": matching_channel_rule.chatbot_script_id.llm_assistant_id.name,
                }
            )

        return result

    def _get_matching_rule(self, channel_id):
        # find the country from the request
        country_id = False
        if request.geoip.country_code:
            country_id = request.env["res.country"].sudo().search([("code", "=", request.geoip.country_code)], limit=1).id
        # extract url
        url = request.httprequest.headers.get("Referer")
        # find the first matching rule for the given country and url
        res = request.env["im_livechat.channel.rule"].sudo().match_rule(channel_id, url, country_id)
        matching_channel_rule = res or None

        return matching_channel_rule

    @http.route("/im_livechat/get_session", methods=["POST"], type="json", auth="public")
    def get_session(self, channel_id, anonymous_name, previous_operator_id=None, chatbot_script_id=None, persisted=True, **kwargs):
        """Override to associate LLM assistant with the livechat channel"""
        # Let native implementation create the session
        channel_info = super(LlmLivechatController, self).get_session(
            channel_id, anonymous_name, previous_operator_id, chatbot_script_id, persisted, **kwargs
        )

        if not channel_info:
            return channel_info

        # If chatbot_script_id is provided and channel was created successfully
        if chatbot_script_id and persisted:
            try:
                # Get the script to check if it has an LLM assistant
                chatbot_script = request.env["chatbot.script"].sudo().browse(int(chatbot_script_id))

                if chatbot_script.exists() and chatbot_script.is_llm_enabled and chatbot_script.llm_assistant_id:

                    # Validate that the assistant is allowed for website use
                    assistant = chatbot_script.llm_assistant_id
                    if assistant.is_website_visible:

                        # Get the thread and set the assistant_id
                        thread = request.env["discuss.channel"].sudo().browse(channel_info.get("id"))
                        if thread.exists():
                            thread.sudo().write(
                                {
                                    "assistant_id": assistant.id,
                                }
                            )
                    else:
                        _logger.warning(
                            f"Requested Assistant {assistant.name} (ID: {assistant.id}) is not website visible, "
                            f"not setting it on thread {channel_info.get('id')}"
                        )
            except Exception as e:
                _logger.exception(f"Error setting LLM assistant on thread: {e}")
                # We don't return an error to the frontend as the channel was created successfully
                # The chat will just work without LLM functionality

        return channel_info

    def _stream_generator(self, thread_id, channel_id=None):
        """Generate SSE stream for LLM responses using the standard llm_thread generate method

        This simplified version only handles the streaming response generation.
        The message posting is now handled separately through the standard message
        posting mechanism.
        """
        try:
            if not thread_id:
                yield f"data: {json.dumps({'type': 'error', 'error': 'Thread ID is required'})}\n\n".encode()
                return

            # Get the LLM thread (which is the same as the livechat channel)
            thread = request.env["discuss.channel"].sudo().browse(int(thread_id))
            if not thread.exists():
                yield f"data: {json.dumps({'type': 'error', 'error': 'Thread not found'})}\n\n".encode()
                return

            # Verify this is an LLM-enabled thread
            if not thread.assistant_id:
                yield f"data: {json.dumps({'type': 'error', 'error': 'This is not an LLM-enabled thread'})}\n\n".encode()
                return

            # Use the standard llm_thread generate method with streaming
            try:
                for response in thread.sudo().with_context(website_livechat=True).generate(None):
                    # The generate method already returns properly formatted responses
                    yield f"data: {json.dumps(response, default=str)}\n\n".encode()

            except Exception as e:
                _logger.exception(f"Error generating LLM response: {e}")
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n".encode()

            # Send done event
            yield f"data: {json.dumps({'type': 'done'})}\n\n".encode()

        except Exception as e:
            _logger.exception(f"Error in SSE stream generator: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n".encode()

    @http.route("/im_livechat/llm/stream", type="http", auth="public", website=True)
    def stream_llm_response(self, thread_id, channel_id=None, **kwargs):
        """Stream LLM responses via SSE

        Note: In livechat context, thread_id and channel_id are the same.
        """
        if not thread_id:
            return BadRequest("Missing thread_id parameter")

        headers = {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }

        return Response(self._stream_generator(thread_id, channel_id), direct_passthrough=True, headers=headers)
