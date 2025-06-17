import logging
from typing import Any

from odoo import api, models

_logger = logging.getLogger(__name__)


class LLMToolUserGreeting(models.Model):
    _inherit = "llm.tool"

    @api.model
    def _get_available_implementations(self) -> list[tuple[str, str]]:
        implementations = super()._get_available_implementations()
        return implementations + [
            ("user_greeting", "User Greeting and Available Tools")
        ]

    def user_greeting_execute(
        self,
        greeting_type: str = "initial",
        thread_id: int | None = None,
    ) -> dict[str, Any]:
        """
        Greet the user and provide information about available tools for the current thread.
        
        Parameters:
            greeting_type: Type of greeting ('initial', 'help', 'capabilities')
            thread_id: ID of the thread to get tools for (required for thread-specific tools)
        """
        _logger.info(
            f"Executing User Greeting with: greeting_type={greeting_type}, thread_id={thread_id}"
        )
        
        # Generate greeting based on type
        greeting_messages = {
            "initial": "👋 Hello! Welcome to your Odoo LLM Assistant.",
            "help": "🤝 I'm here to help you with your Odoo system.",
            "capabilities": "🛠️ Let me show you what I can do for you.",
        }

        greeting = greeting_messages.get(greeting_type, greeting_messages["initial"])

        # Get available tools for the thread
        available_tools = self._get_available_tools(thread_id)
        
        return {
            "greeting": greeting,
            "available_tools": available_tools,
            "thread_id": thread_id,
        }

    def _get_available_tools(self, thread_id: int | None = None) -> list[dict[str, Any]]:
        """Get available tools, thread-specific if thread_id provided, otherwise all system tools."""
        try:
            if thread_id:
                # Try to get thread-specific tools, but safely handle if thread model not available
                try:
                    # Get thread information if the llm.thread model is available
                    if 'llm.thread' in self.env:
                        thread_data = self.env['llm.thread'].search_read([
                            ('id', '=', thread_id)
                        ], ['tool_ids'], limit=1)
                        
                        if thread_data and thread_data[0].get('tool_ids'):
                            tool_ids = thread_data[0]['tool_ids']
                            # Get tools associated with this thread
                            tools_data = self.env['llm.tool'].search_read([
                                ('id', 'in', tool_ids),
                                ('active', '=', True)
                            ], ['name', 'description', 'implementation'])
                            
                            tools_info = []
                            for tool_data in tools_data:
                                tool_info = {
                                    "name": tool_data.get('name', 'Unnamed Tool'),
                                    "description": tool_data.get('description', 'No description available'),
                                    "implementation": tool_data.get('implementation', 'Unknown'),
                                    "active": True,
                                }
                                tools_info.append(tool_info)
                            
                            if tools_info:
                                return tools_info
                except Exception as e:
                    _logger.warning(f"Could not get thread-specific tools: {e}")
                    # Fall through to get all system tools
            
            # Get all active tools from the system as fallback
            tools_data = self.env['llm.tool'].search_read([
                ('active', '=', True)
            ], ['name', 'description', 'implementation'])
            
            tools_info = []
            for tool_data in tools_data:
                tool_info = {
                    "name": tool_data.get('name', 'Unnamed Tool'),
                    "description": tool_data.get('description', 'No description available'),
                    "implementation": tool_data.get('implementation', 'Unknown'),
                    "active": True,
                }
                tools_info.append(tool_info)
            
            return tools_info
                
        except Exception as e:
            _logger.error(f"Error retrieving available tools: {e}")
            return [{
                "name": "Error",
                "description": f"Could not retrieve tools: {str(e)}",
                "implementation": "error",
                "active": False,
            }]
