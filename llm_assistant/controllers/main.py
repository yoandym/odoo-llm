from odoo import http
from odoo.http import request


class LLMAssistantController(http.Controller):
    @http.route("/llm/thread/set_assistant", type="json", auth="user")
    def set_thread_assistant(self, thread_id, assistant_id=False):
        """Set the assistant for a thread

        Args:
            thread_id (int): ID of the thread to update
            assistant_id (int, optional): ID of the assistant to set, or False to clear

        Returns:
            dict: Result of the operation
        """
        try:
            # Get thread
            thread = request.env["llm.thread"].browse(int(thread_id))
            if not thread.exists():
                return {"success": False, "error": "Thread not found"}

            # Set or clear the assistant on the thread
            if assistant_id:
                result = thread.set_assistant(assistant_id)
            else:
                result = thread.clear_assistant()

            return {
                "success": bool(result),
                "thread_id": thread_id,
                "assistant_id": assistant_id if assistant_id else False,
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}

    @http.route("/llm/thread/get_assistant_values", type="json", auth="user")
    def get_thread_assistant_values(self, thread_id, assistant_id):
        """Get thread-specific evaluated default values for an assistant

        Args:
            thread_id (int): ID of the thread
            assistant_id (int): ID of the assistant

        Returns:
            dict: Result with evaluated default values
        """
        try:
            # Get thread
            thread = request.env["llm.thread"].browse(int(thread_id))
            if not thread.exists():
                return {"success": False, "error": "Thread not found"}

            # Get assistant
            assistant = request.env["llm.assistant"].browse(int(assistant_id))
            if not assistant.exists():
                return {"success": False, "error": "Assistant not found"}

            # Get assistant values with the thread context
            return assistant.get_assistant_values(thread)
            
        except Exception as e:
            return {"success": False, "error": str(e)}
