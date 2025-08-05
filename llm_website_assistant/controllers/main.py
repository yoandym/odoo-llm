# -*- coding: utf-8 -*-
import json
import logging

from odoo import api, http
from odoo.addons.im_livechat.controllers.main import LivechatController
from odoo.http import Response, request
from odoo.modules.registry import Registry as registry
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
            # Add LLM-specific attributes to the result for reactive components
            result["rule"]["chatbot"].update(
                {
                    "assistant_id": matching_channel_rule.chatbot_script_id.llm_assistant_id.id,  # Presence of assistant_id implies LLM capabilities
                    "assistant_name": matching_channel_rule.chatbot_script_id.llm_assistant_id.name,
                    "assistant_partner_id": (
                        matching_channel_rule.chatbot_script_id.llm_assistant_id.partner_id.id
                        if matching_channel_rule.chatbot_script_id.llm_assistant_id.partner_id
                        else False
                    ),
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

                if (
                    chatbot_script.exists()
                    and chatbot_script.is_llm_enabled
                    and chatbot_script.llm_assistant_id
                    and chatbot_script.llm_assistant_id.is_website_visible
                ):
                    # link the LLM assistant to the channel
                    channel = request.env["discuss.channel"].sudo().browse(int(channel_info.get("id")))
                    channel.assistant_id = chatbot_script.llm_assistant_id

                    # Ensure the assistant_id is also passed back in the channel_info
                    channel_info["assistant_id"] = chatbot_script.llm_assistant_id.id
                    channel_info["assistant_name"] = chatbot_script.llm_assistant_id.name
                    channel_info["assistant_partner_id"] = (
                        chatbot_script.llm_assistant_id.partner_id.id if chatbot_script.llm_assistant_id.partner_id else False
                    )
                else:
                    _logger.warning(
                        f"Requested Assistant {chatbot_script.llm_assistant_id.name} (ID: {chatbot_script.llm_assistant_id.id}) is not website visible, "
                        f"not setting it on thread {channel_info.get('id')}"
                    )
            except Exception as e:
                _logger.exception(f"Error setting LLM assistant on thread: {e}")
                # We don't return an error to the frontend as the channel was created successfully
                # The chat will just work without LLM functionality

        return channel_info

    def _llm_livechat_generate(self, dbname, env, thread_id=None, **kwargs):
        """Generate SSE stream for LLM responses using the standard llm_thread generate method

        This simplified version handles both message posting and streaming response generation,
        similar to the llm_thread controller implementation.

        Args:
            dbname: Database name
            env: Environment object
            thread_id: Thread/Channel ID
        """
        # Use request.env and uid directly
        uid = env.uid if env else None
        context = env.context if env and hasattr(env, "context") else {}

        with registry(dbname).cursor() as cr:
            env = api.Environment(cr, uid, context)
            client_connected = True

            try:
                if not thread_id:
                    yield f"data: {json.dumps({'type': 'error', 'error': 'Thread ID is required'})}\n\n".encode()
                    return

                # Get the LLM thread (which is the same as the livechat channel)
                llmThread = env["discuss.channel"].sudo().browse(int(thread_id))
                if not llmThread.exists():
                    yield f"data: {json.dumps({'type': 'error', 'error': 'Thread not found'})}\n\n".encode()
                    return

                # Verify this is an LLM-enabled thread
                if not llmThread.assistant_id:
                    yield f"data: {json.dumps({'type': 'error', 'error': 'This is not an LLM-enabled thread'})}\n\n".encode()
                    return

                # Generate the LLM response with streaming
                # The generate method will handle the appropriate action based on parameters
                try:
                    # Call the generate method with the appropriate parameters
                    for response in llmThread.sudo().generate(None):
                        try:
                            yield f"data: {json.dumps(response, default=str)}\n\n".encode()
                        except GeneratorExit:
                            client_connected = False
                            break

                except Exception as e:
                    _logger.exception(f"Error generating LLM response: {e}")
                    yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n".encode()

                # Ensure the final message has been properly persisted to the database
                # This will commit any remaining database changes
                env.cr.commit()

                # Send done event if client is still connected
                if client_connected:
                    # Include the messageId in the done event so the client can update the message
                    yield f"data: {json.dumps({'type': 'done'})}\n\n".encode()

            except Exception as e:
                _logger.exception(f"Error in SSE stream generator: {e}")
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n".encode()

            finally:
                # Clear caches when the transaction is done
                env.clear()

    @http.route("/im_livechat/llm/generate", type="http", auth="public", website=True)
    def llm_livechat_generate(self, thread_id, **kwargs):
        """Stream LLM responses via SSE

        This endpoint generates an LLM response for the given thread_id.

        Note: In livechat context, thread_id and channel_id are the same.
        """
        if not thread_id:
            return BadRequest("Missing thread_id parameter")

        headers = {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }

        dbname = request.session.db
        _env = request.env if hasattr(request, "env") else None
        _logger.info(f"Received request to /im_livechat/llm/generate for thread_id={thread_id}")

        # Pass all parameters to the generator function
        return Response(
            self._llm_livechat_generate(dbname, _env, thread_id),
            direct_passthrough=True,
            headers=headers,
        )
