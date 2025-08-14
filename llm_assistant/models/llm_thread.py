import logging

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)


class LLMThread(models.Model):
    _inherit = "discuss.channel"

    assistant_id = fields.Many2one(
        "llm.assistant",
        string="Assistant",
        ondelete="restrict",
        help="The assistant used for this thread",
        required=False,
    )

    @api.constrains("assistant_id")
    def _check_assistant_required(self):
        """Ensure an assistant is always set"""
        for thread in self:
            if not thread.assistant_id:
                raise ValidationError(_("An assistant is required for all chat threads."))

    # Default assistant for new threads
    @api.model_create_multi
    def create(self, vals_list):
        """Ensure thread's assistant consistency"""
        for vals in vals_list:

            _llm_enabled = vals.get("llm_enabled", False)
            if not _llm_enabled:
                # If LLM is not enabled, skip setting assistant
                continue

            _assistant_id = vals.get("assistant_id")
            _assistant = self.env["llm.assistant"].browse(_assistant_id)
            if _assistant_id and _assistant.exists():

                # set provider, model and tools for consistency
                vals["provider_id"] = _assistant.provider_id.id
                vals["model_id"] = _assistant.model_id.id
                vals["tool_ids"] = [(6, 0, _assistant.tool_ids.ids)]
                vals["prompt_id"] = False

                # Set default name if not provided
                if not vals.get("name"):
                    vals["name"] = f"Chat with {_assistant.name}"
            else:
                # get / set a default assistant
                default_assistant = self.env["llm.assistant"].get_default_assistant()
                if default_assistant:
                    vals["assistant_id"] = default_assistant.id
                    vals["provider_id"] = default_assistant.provider_id.id
                    vals["model_id"] = default_assistant.model_id.id
                    vals["tool_ids"] = [(6, 0, default_assistant.tool_ids.ids)]
                    vals["prompt_id"] = False

        # Call super to create the records
        return super().create(vals_list)

    def write(self, vals):
        """Override write to reset thread parameters when assistant changes"""
        res = super().write(vals)
        if "assistant_id" in vals:
            self.reset_to_defaults()
        return res

    def set_assistant(self, assistant_id):
        """Set the assistant for this thread and update related fields

        Args:
            assistant_id (int): The ID of the assistant to set

        Returns:
            bool: True if successful, False otherwise
        """
        self.ensure_one()

        # Get the assistant record
        assistant = self.env["llm.assistant"].browse(assistant_id)
        if not assistant.exists():
            return False

        # Update the thread with the assistant and related fields
        update_vals = {
            "assistant_id": assistant_id,
        }

        self.write(update_vals)
        self.reset_to_defaults()

        return True

    def reset_to_defaults(self):
        """Set thread parameters based on the assistant"""

        self.ensure_one()

        # call super
        if not self.assistant_id:
            # If no assistant, just call the base method
            return super(LLMThread, self).reset_to_defaults()

        # Update llm related params (tools, prompt) based on the assistant
        self.provider_id = self.assistant_id.provider_id
        self.model_id = self.assistant_id.model_id
        self.tool_ids = self.assistant_id.tool_ids
        self.prompt_id = False

    def action_open_thread(self):
        """Open the thread in the chat client interface

        Returns:
            dict: Action to open the thread in the chat client
        """
        self.ensure_one()
        return {
            "type": "ir.actions.client",
            "tag": "llm_thread.chat_client_action",
            "params": {
                "default_active_id": self.id,
            },
            "context": {
                "active_id": self.id,
            },
            "target": "current",
        }

    # override to include assistant's messages
    def _get_prepend_messages(self):
        """Hook: return a list of formatted messages to prepend to the conversation.
        Override in other modules if needed.

        Returns:
            list: List of message dictionaries in the format:
                [{"role": "system", "content": "..."},
                 {"role": "user", "content": "..."},
                 ...]
        """
        self.ensure_one()
        # Get base messages from parent class
        messages = super()._get_prepend_messages()

        # Get messages from assistant if available
        if self.assistant_id:
            # Use the new get_messages method which returns a list of messages
            assistant_messages = self.assistant_id.get_messages(thread=self)

            if assistant_messages:
                # Use the helper method from llm_prompt to merge the messages
                messages = self.merge_message_lists(assistant_messages, messages)
                _logger.info("Added %d messages from assistant", len(assistant_messages))
            else:
                # Fallback to the old method if get_messages returns empty
                # This ensures backward compatibility
                assistant_system_prompt = self.assistant_id.get_formatted_system_prompt(thread=self)
                if assistant_system_prompt:
                    # Create a system message with the assistant's prompt
                    assistant_message = {
                        "role": "system",
                        "content": assistant_system_prompt,
                    }

                    # Add it to existing messages or create a new list
                    if messages:
                        # Check if there's already a system message
                        has_system_message = False
                        for msg in messages:
                            if msg.get("role") == "system":
                                # Append to existing system message
                                msg["content"] = f"{assistant_system_prompt}\n\n{msg['content']}"
                                has_system_message = True
                                break

                        # If no system message found, add the new one at the beginning
                        if not has_system_message:
                            messages.insert(0, assistant_message)
                    else:
                        # No existing messages, create a new list with just the system message
                        messages = [assistant_message]

                    _logger.info(
                        "Added system message from assistant: %s",
                        assistant_system_prompt,
                    )

        return messages

    @api.model
    def get_thread_by_id(self, thread_id):
        """Get a thread record by its ID

        Args:
            thread_id (int): ID of the thread

        Returns:
            tuple: (thread, error_response)
                  If successful, error_response will be None
                  If error, thread will be None
        """
        thread = self.browse(int(thread_id))
        if not thread.exists():
            return None, {"success": False, "error": "Thread not found"}
        return thread, None

    @api.model
    def get_thread_and_assistant(self, thread_id, assistant_id=False):
        """Get thread and assistant records by their IDs

        Args:
            thread_id (int): ID of the thread
            assistant_id (int, optional): ID of the assistant, or False to clear

        Returns:
            tuple: (thread, assistant, error_response)
                  If successful, error_response will be None
                  If error, thread and/or assistant will be None
        """
        # Get thread
        thread, error = self.get_thread_by_id(thread_id)
        if error:
            return None, None, error

        # If no assistant_id, return just the thread
        if not assistant_id:
            return thread, None, None

        # Get assistant from the assistant model
        assistant, error = self.env["llm.assistant"].get_assistant_by_id(assistant_id)
        if error:
            return thread, None, error

        return thread, assistant, None

    def clear_assistant(self):
        """Clear the assistant and reset thread to default values

        Returns:
            bool: True if successful
        """
        self.ensure_one()

        # Use the base thread method to reset to defaults
        result = self.reset_to_defaults()

        # Also clear the assistant_id
        if result:
            result = self.write({"assistant_id": False})

        return result

    def _post_message(self, **kwargs):
        """Overriden to set autor_id to the assistant partner_id"""
        self.ensure_one()

        author_id = kwargs.get("author_id")

        extra_vals = {}
        # For assistant messages, use the assistant's partner if available
        if not author_id and self.assistant_id and self.assistant_id.partner_id:
            extra_vals = {"author_id": self.assistant_id.partner_id.id}

        assistant_kwargs = kwargs.copy()
        assistant_kwargs.update(extra_vals)

        message = super()._post_message(**assistant_kwargs)
        return message

    def _channel_basic_info(self):
        """Get basic information about the channel."""
        self.ensure_one()
        _basic_info = super(LLMThread, self.sudo())._channel_basic_info()
        _basic_info.update({
            "assistant_id": self.assistant_id.id if self.assistant_id else False,
            "assistant_name": self.assistant_id.name if self.assistant_id else "",
        })
        return _basic_info
