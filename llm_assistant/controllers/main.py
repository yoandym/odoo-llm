from odoo import http
from odoo.http import request


class LLMAssistantController(http.Controller):
    @http.route("/llm/thread/set_assistant", type="json", auth="user")
    def set_thread_assistant(self, thread_id, assistant_id=False):
        """Set the assistant for a thread

        Args:
            thread_id (int): ID of the thread to update
            assistant_id (int, required): ID of the assistant to set

        Returns:
            dict: Result of the operation
        """
        try:
            # Get thread
            thread = request.env["llm.thread"].browse(int(thread_id))
            if not thread.exists():
                return {"success": False, "error": "Thread not found"}

            # Enforce assistant requirement
            if not assistant_id:
                return {
                    "success": False,
                    "error": "An assistant is required for all chat threads.",
                    "thread_id": thread_id,
                }

            # Set the assistant on the thread
            result = thread.set_assistant(assistant_id)

            return {
                "success": bool(result),
                "thread_id": thread_id,
                "assistant_id": assistant_id,
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

    @http.route("/llm/assistant/get_default", type="json", auth="user")
    def get_default_assistant(self):
        """Get the default assistant for new threads

        Returns:
            dict: Assistant data or empty dict
        """
        try:
            # Get default assistant
            assistant_model = request.env["llm.assistant"]
            default_assistant = assistant_model.get_default_assistant()
            
            if not default_assistant:
                return {
                    "success": False,
                    "error": "No default assistant found",
                    "assistant": None
                }
                
            # Return assistant data
            return {
                "success": True,
                "assistant": {
                    "id": default_assistant.id,
                    "name": default_assistant.name,
                    "isDefault": default_assistant.is_default,
                    "provider_id": default_assistant.provider_id.id if default_assistant.provider_id else False,
                    "model_id": default_assistant.model_id.id if default_assistant.model_id else False,
                    "tool_ids": default_assistant.tool_ids.ids,
                }
            }
            
        except Exception as e:
            return {"success": False, "error": str(e), "assistant": None}
