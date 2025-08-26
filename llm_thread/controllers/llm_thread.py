import json
import logging

from odoo import _, api, http, registry
from odoo.exceptions import MissingError
from odoo.http import Response, request

_logger = logging.getLogger(__name__)


class LLMThreadController(http.Controller):
    @http.route(
        "/llm/thread/<int:thread_id>/update",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=True,
    )
    def llm_thread_update(self, thread_id, **kwargs):
        try:
            thread = request.env["discuss.channel"].browse(thread_id)
            if not thread.exists():
                raise MissingError(_("LLM Thread not found."))
            thread.write(kwargs)
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    @http.route("/llm/thread/mute_llm", type="json", auth="public")
    def mute_assistant(self, uuid, mute, **kwargs):
        """Mute or unmute the assistant for a specific thread identified by UUID

        UUID-based authentication ensures only users with access to the
        specific thread can modify its settings.

        Args:
            uuid: The UUID of the thread (not the numeric ID)
            mute: Boolean indicating whether to mute (True) or unmute (False)

        Returns:
            dict: Result with success status
        """
        if not uuid:
            return {"success": False, "error": "Missing UUID"}

        # Find the thread by UUID - this is more secure than using ID
        thread = request.env["discuss.channel"].sudo().search([("uuid", "=", uuid)], limit=1)
        if not thread:
            return {"success": False, "error": "Thread not found"}

        # Security check: Verify the requester has access to this thread
        livechat_uuid = False
        if thread.channel_type == "livechat":
            livechat_uuid = request.httprequest.cookies.get("im_livechat_uuid")
            if livechat_uuid != uuid:
                return {"success": False, "error": "Access denied"}

        # For authenticated users, check if they are members of this channel
        is_authenticated = request.session.uid is not None
        is_member = False
        if is_authenticated:
            channel_member = (
                request.env["discuss.channel.member"]
                .sudo()
                .search([("partner_id", "=", request.env.user.partner_id.id), ("channel_id", "=", thread.id)], limit=1)
            )
            is_member = bool(channel_member)

            # Validation: either UUID matches or the user is a member
            if not is_member:
                return {"success": False, "error": "Access denied"}
        elif thread.channel_type != "livechat":
            # right now, only livechat can be unauthenticated
            return {"success": False, "error": "Access denied"}

        try:
            thread.sudo().write({"llm_mute": bool(mute)})
            return {"success": True}
        except Exception as e:
            _logger.exception(e)
            return {"success": False, "error": str(e)}

    def _safe_yield(self, data_to_yield):
        """Helper generator to yield data safely, handling BrokenPipeError(Disconnected user)."""
        try:
            yield data_to_yield
            return True
        except BrokenPipeError:
            return False
        except Exception:
            return False

    def _llm_thread_generate(self, dbname, env, thread_id, user_message_body, **kwargs):
        """Generate LLM responses with streaming and safe yielding."""
        with registry(dbname).cursor() as cr:
            env = api.Environment(cr, env.uid, env.context)
            llmThread = env["discuss.channel"].browse(int(thread_id))
            if not llmThread.exists():
                yield from self._safe_yield(f"data: {json.dumps({'type': 'error', 'error': 'LLM Thread not found.'})}\n\n".encode())
                return

            client_connected = True
            try:
                for response in llmThread.generate(user_message_body, **kwargs):
                    json_data = json.dumps(response, default=str)
                    success = yield from self._safe_yield(f"data: {json_data}\n\n".encode())
                    if not success:
                        client_connected = False
                        break

            except GeneratorExit:
                # Client disconnected explicitly
                client_connected = False
                if llmThread.exists():
                    llmThread._unlock()
                return

            except Exception as e:
                _logger.exception(f"Error in llm_thread_generate for thread {thread_id}: {e}")
                if llmThread.exists():
                    llmThread._unlock()

                if client_connected:
                    success = yield from self._safe_yield(f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n".encode())
                    if not success:
                        client_connected = False

            finally:
                if client_connected:
                    yield from self._safe_yield(f"data: {json.dumps({'type': 'done'})}\n\n".encode())

    @http.route("/llm/thread/generate", type="http", auth="user", csrf=True)
    def llm_thread_generate(self, thread_id, message=None, **kwargs):
        headers = {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
        user_message_body = message
        return Response(
            self._llm_thread_generate(request.cr.dbname, request.env, thread_id, user_message_body),
            direct_passthrough=True,
            headers=headers,
        )

    @http.route("/llm/message/vote", type="json", auth="user", methods=["POST"])
    def llm_message_vote(self, message_id, vote_value):
        """Updates the user vote on a specific message by calling the model method."""
        try:
            msg_id = int(message_id)
            vote_val = int(vote_value)
            request.env["mail.message"].set_user_vote(msg_id, vote_val)
            return {"success": True}

        except (ValueError, TypeError):
            return {"error": _("Invalid message ID or vote value format.")}
        except Exception as e:
            return {"error": str(e)}
