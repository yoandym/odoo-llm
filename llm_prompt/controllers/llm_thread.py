import logging

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class LLMThreadControllerExtended(http.Controller):
    @http.route("/llm/thread/set_prompt", type="json", auth="user")
    def set_thread_prompt(self, thread_id, prompt_id):
        """Set the prompt for a thread

        Args:
            thread_id (int): ID of the thread to update
            prompt_id (int): ID of the prompt to set, or False to clear

        Returns:
            bool: True if successful, False otherwise
        """
        thread = request.env["llm.thread"].browse(int(thread_id))
        if not thread.exists():
            return False

        # Update the thread with the prompt
        return thread.write({"prompt_id": prompt_id or False})
