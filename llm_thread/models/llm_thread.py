import functools
import json
import logging

import emoji
from odoo import _, api, fields, models
from odoo.addons.llm_mail_message_subtypes.const import (  # pyright:ignore
    LLM_ASSISTANT_SUBTYPE_XMLID,
    LLM_TOOL_RESULT_SUBTYPE_XMLID,
    LLM_USER_SUBTYPE_XMLID,
)
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


def execute_with_new_cursor(func_to_decorate):
    """Decorator to execute a method within a new, immediately committed cursor context.

    It injects the browsed record from the new environment as the first argument
    after 'self'. Assumes the decorated method is called on a singleton recordset.
    """

    @functools.wraps(func_to_decorate)
    def wrapper(self, *args, **kwargs):
        self.ensure_one()
        with self.pool.cursor() as cr:
            env = api.Environment(cr, self.env.uid, self.env.context)
            record_in_new_env = env[self._name].browse(self.ids)
            return func_to_decorate(self, record_in_new_env, *args, **kwargs)

    return wrapper


class LLMThread(models.Model):
    _inherit = "discuss.channel"
    _description = "LLM-Enabled Chat Channel"
    _order = "write_date DESC"

    # LLM specific fields added to discuss.channel
    provider_id = fields.Many2one(
        "llm.provider",
        string="Provider",
        ondelete="restrict",
    )
    model_id = fields.Many2one(
        "llm.model",
        string="Model",
        domain="[('provider_id', '=', provider_id), ('model_use', 'in', ['chat', 'multimodal'])]",
        ondelete="restrict",
    )

    active = fields.Boolean(default=True)
    # The message_ids field is now inherited from discuss.channel

    # These fields are needed to link an LLM thread with another record (e.g., a sales order)
    model = fields.Char("Related Document Model")
    res_id = fields.Many2oneReference("Related Document ID", model_field="model")

    is_locked = fields.Boolean(
        string="Locked, Preventing Concurrent Generation",
        default=False,
        readonly=True,
        copy=False,
        help="Indicates if the thread is currently locked to prevent concurrent generation.",
    )

    tool_ids = fields.Many2many(
        "llm.tool",
        string="Available Tools",
        help="Tools that can be used by the LLM in this thread",
    )

    # LLM enabled field - base computation depends on model_id
    llm_enabled = fields.Boolean(
        string="Enable AI Assistant",
        compute="_compute_llm_enabled",
        store=True,
        help="Whether AI assistant is enabled for this channel",
    )

    @api.depends("model_id")
    def _compute_llm_enabled(self):
        for record in self:
            _enabled = record.llm_enabled or record.model_id
            record.llm_enabled = _enabled

    @api.model_create_multi
    def create(self, vals_list):
        """Set default title, provider, model, and tools if not provided"""
        for vals in vals_list:

            _llm_enabled = vals.get("llm_enabled", False)
            _llm_enabled = _llm_enabled or vals.get("model_id")

            if not _llm_enabled:
                continue

            # Set default provider if not explicitly provided
            # Case 1: Got no provider_id but got a model_id
            if "provider_id" not in vals and "model_id" in vals:
                model_id = vals.get("model_id")
                if model_id:
                    model = self.env["llm.model"].browse(model_id)
                    if model.exists():
                        vals["provider_id"] = model.provider_id.id
            # Case 2: Got no provider_id
            if "provider_id" not in vals:
                default_provider = self.env["llm.provider"].search([("active", "=", True)], limit=1)
                if default_provider:
                    vals["provider_id"] = default_provider.id

            # Set default model if not explicitly provided
            if "provider_id" in vals and "model_id" not in vals:
                provider_id = vals.get("provider_id")
                default_models = self.env["llm.model"].search(
                    [("provider_id", "=", provider_id), ("default", "=", True), ("model_use", "=", "chat")], limit=1
                )
                if not default_models:
                    # Fallback to any chat model for this provider
                    default_models = self.env["llm.model"].search([("provider_id", "=", provider_id), ("model_use", "=", "chat")], limit=1)
                default_model = default_models[0] if default_models else None
                if default_model:
                    vals["model_id"] = default_model.id

            # Set default tools if not explicitly provided
            if "provider_id" in vals and "model_id" in vals and "tool_ids" not in vals:
                default_tools = self.env["llm.tool"].search([("active", "=", True), ("default", "=", True)])
                if default_tools:
                    vals["tool_ids"] = [(6, 0, default_tools.ids)]

            # Set default name if not provided
            if not vals.get("name"):
                model_id = vals.get("model_id")
                if model_id:
                    model = self.env["llm.model"].browse(model_id)
                    vals["name"] = f"Chat with {model.name}" if model.exists() else "New Chat"
                else:
                    vals["name"] = "New Chat"

        return super().create(vals_list)

    def _post_message(self, **kwargs):
        self.ensure_one()
        # if subtype_xmlid is not provided or wrong,message_post automatically
        # uses the default subtype
        subtype_xmlid = kwargs.get("subtype_xmlid")
        author_id = kwargs.get("author_id")
        body = kwargs.get("body", "")
        email_from = self.get_email_from(
            self.provider_id.name,
            self.model_id.name,
            subtype_xmlid,
            author_id,
            kwargs.get("tool_name"),
        )
        post_vals = self.build_post_vals(subtype_xmlid, body, author_id, email_from)

        message = self.message_post(**post_vals)

        extra_vals = self.build_update_vals(**kwargs)

        if extra_vals:
            message.write(extra_vals)
        return message

    def _get_message_subtypes(self):
        """Return the message subtypes used by this thread type.
        This method is meant to be overridden by modules that use different subtypes.

        Returns:
            list: List of mail.message.subtype records
        """
        return [
            self.env.ref(LLM_USER_SUBTYPE_XMLID, raise_if_not_found=False),
            self.env.ref(LLM_ASSISTANT_SUBTYPE_XMLID, raise_if_not_found=False),
            self.env.ref(LLM_TOOL_RESULT_SUBTYPE_XMLID, raise_if_not_found=False),
        ]

    def _get_message_history_recordset(self, order="ASC", limit=None):
        """Get messages from the thread

        Args:
            limit: Optional limit on number of messages to retrieve

        Returns:
            mail.message recordset containing the messages
        """
        self.ensure_one()
        subtypes_to_fetch = self._get_message_subtypes()
        subtype_ids = [st.id for st in subtypes_to_fetch if st]
        order_clause = f"create_date {order}, id {order}"
        domain = [
            ("model", "=", self._name),
            ("res_id", "=", self.id),
            ("message_type", "=", "comment"),
            ("subtype_id", "in", subtype_ids),
        ]
        messages = self.env["mail.message"].search(domain, order=order_clause, limit=limit)
        return messages

    def _get_last_message_from_history(self):
        """Get the last message from the message history."""
        self.ensure_one()
        last_message = None
        result = self._get_message_history_recordset(order="DESC", limit=1)
        if result:
            last_message = result[0]
        if not last_message:
            raise UserError("No message found to process.")
        return last_message

    def _get_user_subtype_xmlid(self):
        """Return the user message subtype XMLID for this thread.
        This method is meant to be overridden by modules that use different subtypes.

        Returns:
            str: XMLID of the user message subtype
        """
        return LLM_USER_SUBTYPE_XMLID

    def _get_assistant_subtype_xmlid(self):
        """Return the assistant message subtype XMLID for this thread.
        This method is meant to be overridden by modules that use different subtypes.

        Returns:
            str: XMLID of the assistant message subtype
        """
        return LLM_ASSISTANT_SUBTYPE_XMLID

    def _get_tool_result_subtype_xmlid(self):
        """Return the tool result message subtype XMLID for this thread.
        This method is meant to be overridden by modules that use different subtypes.

        Returns:
            str: XMLID of the tool result message subtype
        """
        return LLM_TOOL_RESULT_SUBTYPE_XMLID

    def _init_message(self, user_message_body, **kwargs):
        """Initialize first message: user input or history."""
        if user_message_body:
            return self._post_message(
                subtype_xmlid=self._get_user_subtype_xmlid(),
                body=user_message_body,
                author_id=self.env.user.partner_id.id,
                **kwargs,
            )
        return self._get_last_message_from_history()

    def _should_continue(self, last_message):
        """Whether to keep looping on the last_message."""
        if not last_message:
            return False
        if last_message.is_user_message() or last_message.is_tool_result_message():
            _logger.debug("last message is user or tool result message, _should_continue: yes")
            return True
        if last_message.is_assistant_message() and last_message.tool_calls:
            _logger.debug("last message is assistant message with tool calls, _should_continue: yes")
            return True

        _logger.debug("last message dont comply, _should_continue: no")
        return False

    def _next_step(self, last_message):
        """Dispatch to the next generator based on message type."""
        if last_message.is_user_message() or last_message.is_tool_result_message():
            _logger.debug("last message is user or tool result message, next_step: _get_assistant_response")
            return self._get_assistant_response()
        if last_message.is_assistant_message() and last_message.tool_calls:
            _logger.debug("last message is assistant message with tool calls, next_step: _process_tool_calls")
            return self._process_tool_calls(last_message)
        return last_message

    def generate(self, user_message_body, **kwargs):
        self.ensure_one()
        if self.is_locked:
            raise UserError(_("This thread is already generating a response. Please wait."))
        self._lock()

        try:
            # orchestrate via hooks
            last = self._init_message(user_message_body, **kwargs)
            if user_message_body:
                yield {"type": "message_create", "message": last.message_format()[0]}  # type: ignore
            while self._should_continue(last):
                last = yield from self._next_step(last)
            return last
        finally:
            self._unlock()

    def _process_tool_calls(self, assistant_msg):
        self.ensure_one()
        defs = json.loads(assistant_msg.tool_calls or "[]")
        last_tool_msg = None
        for tool_def in defs:
            last_tool_msg = yield from self.env["mail.message"].stream_llm_tool_result(
                thread=self,
                tool_call_def=tool_def,
            )
        return last_tool_msg

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
        return []

    def get_related_record(self):
        """Get the related record if this thread is connected to a model.

        Returns:
            recordset: The related record if it exists, otherwise False
        """
        self.ensure_one()
        if self.model and self.res_id:
            try:
                return self.env[self.model].browse(self.res_id).exists()
            except Exception as e:
                _logger.error("Error getting related record: %s", str(e))
        return False

    def _get_assistant_response(self):
        self.ensure_one()
        message_history_rs = self._get_message_history_recordset()
        tool_rs = self.tool_ids
        chat_kwargs = {
            "messages": message_history_rs,
            "tools": tool_rs,
            "stream": True,
            "prepend_messages": self._get_prepend_messages(),
        }

        stream_response = self.model_id.chat(**chat_kwargs)
        assistant_msg = yield from self.env["mail.message"].create_message_from_stream(
            self,
            stream_response,
            self._get_assistant_subtype_xmlid(),
            placeholder_text="Thinking...",
        )
        return assistant_msg

    def _execute_tool(self, tool_name, arguments_str):
        """Execute a tool and return the result."""
        self.ensure_one()
        tool = self.tool_ids.filtered(lambda t: t.name == tool_name)[:1]
        if not tool:
            raise UserError(f"Tool '{tool_name}' not found in this thread")
        arguments = json.loads(arguments_str)

        # Automatically inject thread_id for tools that need it
        # Check if the tool's execute method accepts thread_id parameter
        impl_method_name = f"{tool.implementation}_execute"
        if hasattr(tool, impl_method_name):
            method = getattr(tool, impl_method_name)
            import inspect

            sig = inspect.signature(method)
            if "thread_id" in sig.parameters:
                arguments["thread_id"] = self.id

        return tool.execute(arguments)

    def _lock(self):
        """Acquires a lock on the thread, ensuring immediate commit."""
        self.ensure_one()
        if self._read_is_locked_decorated():  # pyright:ignore
            raise UserError(_("Lock Error: This thread is already generating a response. Please wait."))
        self._write_vals_decorated({"is_locked": True})  # pyright:ignore

    def _unlock(self):
        """Releases the lock on the thread, ensuring immediate commit."""
        self.ensure_one()
        if self._read_is_locked_decorated():  # pyright:ignore
            self._write_vals_decorated({"is_locked": False})  # pyright:ignore

    @execute_with_new_cursor
    def _read_is_locked_decorated(self, record_in_new_env):
        """Reads the 'is_locked' status using a new cursor."""
        return record_in_new_env.is_locked

    @execute_with_new_cursor
    def _write_vals_decorated(self, record_in_new_env, vals):
        """Writes values using a new, immediately committed cursor."""
        return record_in_new_env.write(vals)

    def send_message(self, message_content):
        """Send a user message to the thread and trigger AI response.

        Args:
            message_content (str): The message content to send

        Returns:
            dict: Success status and the posted message
        """

        try:
            self.ensure_one()

            # Post the user message
            message = self._post_message(
                subtype_xmlid=self._get_user_subtype_xmlid(),
                body=message_content,
                author_id=self.env.user.partner_id.id,
            )

            # Trigger AI response generation in the background
            # We don't pass user_message_body since we already posted it
            try:

                list(self.generate(None))  # Convert generator to list to fully execute it

            except Exception as gen_error:
                # Log the generation error but don't fail the message sending
                _logger.error("Failed to generate AI response for thread %s: %s", self.id, gen_error)

            return {"success": True, "message_id": message.id, "message": "Message sent successfully"}

        except Exception as e:
            _logger.error("Failed to send message to thread %s: %s", self.id, e)
            return {"success": False, "error": str(e), "message": "Failed to send message"}

    @api.ondelete(at_uninstall=False)
    def _unlink_llm_thread(self):
        unlink_ids = [record.id for record in self]
        self.env["bus.bus"]._sendone(self.env.user.partner_id, "llm.thread/delete", {"ids": unlink_ids})

    @api.model
    def get_email_from(
        self,
        provider_name,
        provider_model_name,
        subtype_xmlid,
        author_id,
        tool_name=None,
    ):
        if not author_id:
            if subtype_xmlid == LLM_TOOL_RESULT_SUBTYPE_XMLID:
                name = tool_name or "Tool"
                return f"{name} <tool@{provider_name.lower().replace(' ', '')}.ai>"
            elif subtype_xmlid == LLM_ASSISTANT_SUBTYPE_XMLID:
                model = provider_model_name or "Assistant"
                provider = provider_name.lower().replace(" ", "")
                return f"{model} <ai@{provider}.ai>"
        return None

    @api.model
    def _process_message_body(self, body):
        """Process message body content - keep as plain text to avoid HTML encoding issues."""
        if not body:
            return body

        # Just apply emoji processing, no HTML conversion
        return emoji.demojize(body)

    @api.model
    def build_post_vals(self, subtype_xmlid, body, author_id, email_from):
        # Process the message body to handle emojis
        processed_body = self._process_message_body(body)

        return {
            "body": processed_body,
            "message_type": "comment",
            "subtype_xmlid": subtype_xmlid,
            "author_id": author_id,
            "email_from": email_from or None,
            "partner_ids": [],
        }

    @api.model
    def build_update_vals(
        self,
        subtype_xmlid,
        tool_call_id=None,
        tool_calls=None,
        tool_call_definition=None,
        tool_call_result=None,
        **kwargs,
    ):
        if subtype_xmlid == LLM_ASSISTANT_SUBTYPE_XMLID and tool_calls:
            return {"tool_calls": tool_calls}
        if subtype_xmlid == LLM_TOOL_RESULT_SUBTYPE_XMLID:
            vals = {
                "tool_call_id": tool_call_id,
                "tool_call_definition": tool_call_definition,
                "tool_call_result": tool_call_result,
            }
            return {k: v for k, v in vals.items() if v is not None}

    @api.model
    def get_thread_from_context(self):
        """
        Try to get the thread from the context.
        This is useful when the template is used in a thread context.

        Returns:
            discuss.channel recordset or False
        """

        # Check if we have a thread_id in the context
        thread_id = self.env.context.get("thread_id", False)
        if thread_id:
            thread = self.env["discuss.channel"].browse(thread_id).exists()
            if thread:
                return thread
            else:
                _logger.warning("Thread with ID %s not found", thread_id)
                return False

        return False

    def reset_to_defaults(self):
        """Reset thread to system default values

        Returns:
            bool: True if successful
        """
        self.ensure_one()

        # Get default provider
        default_provider = self.env["llm.provider"].search([("active", "=", True)], limit=1)

        # Get default model
        default_model = None
        if default_provider:
            default_models = self.env["llm.model"].search(
                [("provider_id", "=", default_provider.id), ("default", "=", True), ("model_use", "=", "chat")], limit=1
            )

            if not default_models:
                # Fallback to any chat model for this provider
                default_models = self.env["llm.model"].search([("provider_id", "=", default_provider.id), ("model_use", "=", "chat")], limit=1)

            default_model = default_models[0] if default_models else None

        # Get default tools
        default_tools = self.env["llm.tool"].search([("active", "=", True), ("default", "=", True)])

        # Build update values
        update_vals = {}

        # Set tools with proper many2many format
        if default_tools:
            update_vals["tool_ids"] = [(6, 0, default_tools.ids)]

        # Set default provider and model if found
        if default_provider:
            update_vals["provider_id"] = default_provider.id
        if default_model:
            update_vals["model_id"] = default_model.id

        return self.write(update_vals)

    def _channel_basic_info(self):
        """Get basic information about the channel."""
        self.ensure_one()
        _basic_info = super()._channel_basic_info()
        _basic_info.update({
            "llm_enabled": self.llm_enabled,
            "model_id": self.model_id.id if self.model_id else False,
            "provider_id": self.provider_id.id if self.provider_id else False,
            "tool_ids": [tool.id for tool in self.tool_ids],
        })
        return _basic_info
