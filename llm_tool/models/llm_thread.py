import json
import logging

from odoo import api, models

_logger = logging.getLogger(__name__)


class LLMProvider(models.Model):
    _inherit = "llm.provider"

    @api.model
    def _is_tool_call_complete(self, function_data, expected_endings=("]", "}")):
        tool_name = function_data.get("name")
        args_str = function_data.get("arguments", "").strip()

        if not tool_name or not args_str:
            return False

        try:
            json.loads(args_str)
            if args_str.endswith(expected_endings):
                return True
        except json.JSONDecodeError:
            pass

        return False

    def _prepare_chat_params(
        self,
        model,
        messages,
        stream,
        tools,
        system_prompt=None,
        prepend_messages=None,
        **kwargs,
    ):
        """Generic method to prepare chat parameters for API call."""
        params = {
            "model": model.name,
            "stream": stream,
        }

        messages = messages or []

        # Handle prepend_messages parameter (new approach)
        if prepend_messages and isinstance(prepend_messages, list):
            # Format the messages from the thread
            formatted_messages = self.format_messages(messages)
            # Prepend the additional messages
            params["messages"] = prepend_messages + formatted_messages
        else:
            # Legacy approach using system_prompt
            system_prompt = system_prompt or None
            formatted_messages = self.format_messages(messages, system_prompt)
            params["messages"] = formatted_messages

        if tools:
            formatted_tools = self.format_tools(tools)
            if formatted_tools:
                params["tools"] = formatted_tools
                if "tool_choice" in kwargs:
                    params["tool_choice"] = kwargs["tool_choice"]

                consent_required_tools = tools.filtered(
                    lambda t: t.requires_user_consent
                )
                if consent_required_tools:
                    consent_tool_names = ", ".join(
                        [f"'{t.name}'" for t in consent_required_tools]
                    )
                    config = self.env["llm.tool.consent.config"].get_active_config()
                    consent_instruction = config.system_message_template.format(
                        tool_names=consent_tool_names
                    )

                    if "messages" not in params:
                        params["messages"] = []

                    has_system_message = False
                    for msg in params["messages"]:
                        if msg.get("role") == "system":
                            content = msg.get("content")

                            # Handle different content formats
                            if (
                                isinstance(content, list)
                                and len(content) > 0
                                and isinstance(content[0], dict)
                            ):
                                # Content is a list of objects format
                                if all(item.get("type") == "text" for item in content):
                                    # Append to the text of the first item
                                    existing_text = content[0].get("text", "")
                                    separator = "\n\n" if existing_text else ""
                                    content[0]["text"] = (
                                        f"{existing_text}{separator}{consent_instruction}"
                                    )
                            else:
                                # Content is a string
                                existing_content = content or ""
                                separator = "\n\n" if existing_content else ""
                                msg["content"] = (
                                    f"{existing_content}{separator}{consent_instruction}"
                                )

                            has_system_message = True
                            break

                    if not has_system_message:
                        # Insert a new system message using the list format for content
                        params["messages"].insert(
                            0,
                            {
                                "role": "system",
                                "content": [
                                    {"type": "text", "text": consent_instruction}
                                ],
                            },
                        )

        return params
