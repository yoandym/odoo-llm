{
    "name": "Easy AI Chat",
    "summary": "Simple AI Chat for Odoo",
    "description": """
Easy AI Chat for Odoo
=====================
A user-friendly module that brings AI-powered chat to your Odoo environment. Integrate with multiple AI providers, manage real-time conversations,
and enhance workflows with multimodal support.

Key Features:
- Multiple AI Providers: OpenAI, Anthropic, Grok, Ollama, DeepSeek, and more
- Real-Time Chat: Instant AI conversations integrated with Odoo's mail system
- Multimodal Support: Go beyond text with advanced AI models
- Full Odoo Integration: Link chats to any Odoo record for context
- Tool Integration: Enable AI to execute custom tools and functions
- Function Calling: Select specific tools for each thread to enhance AI capabilities

Getting Started:
1. Install this module and the "LLM Integration Base" dependency
2. Configure your AI provider API keys
3. Fetch available models with one click
4. Start chatting from anywhere in Odoo

Use cases include customer support automation, data analysis, training assistance, custom AI workflows, and automated tool execution for your
business.

Contact: support@apexive.com
    """,
    "category": "Productivity, Discuss",
    "version": "17.0.1.1.3",
    "depends": ["base", "mail", "web", "llm", "llm_tool", "llm_mail_message_subtypes"],
    "author": "Apexive Solutions LLC",
    "website": "https://github.com/apexive/odoo-llm",
    "external_dependencies": {"python": ["emoji", "markdown2"]},
    "data": [
        "security/llm_thread_security.xml",
        # "security/ir.model.access.csv",
        "views/llm_thread_views.xml",
        "views/menu.xml",
    ],
    "assets": {
        "web.assets_backend": [
            # Core patches and services (load first)
            "llm_thread/static/src/core/llm_message_patch.js",
            "llm_thread/static/src/core/llm_message_patch.xml",
            "llm_thread/static/src/core/llm_message_patch.scss",
            "llm_thread/static/src/core/llm_message_type_service.js",
            # Services
            "llm_thread/static/src/services/llm_thread_service.js",
            "llm_thread/static/src/services/llm_chat_service.js",
            # Components
            "llm_thread/static/src/components/llm_chat_container/llm_chat_container.js",
            "llm_thread/static/src/components/llm_chat_container/llm_chat_container.xml",
            "llm_thread/static/src/components/llm_chat_container/llm_chat_container.scss",
            "llm_thread/static/src/components/llm_chat/llm_chat.js",
            "llm_thread/static/src/components/llm_chat/llm_chat.xml",
            "llm_thread/static/src/components/llm_chat/llm_chat.scss",
            "llm_thread/static/src/components/llm_chat_thread_list/llm_chat_thread_list.js",
            "llm_thread/static/src/components/llm_chat_thread_list/llm_chat_thread_list.xml",
            "llm_thread/static/src/components/llm_chat_thread_list/llm_chat_thread_list.scss",
            "llm_thread/static/src/components/llm_chat_thread/llm_chat_thread.js",
            "llm_thread/static/src/components/llm_chat_thread/llm_chat_thread.xml",
            "llm_thread/static/src/components/llm_chat_thread/llm_chat_thread.scss",
            "llm_thread/static/src/components/llm_chat_sidebar/llm_chat_sidebar.js",
            "llm_thread/static/src/components/llm_chat_sidebar/llm_chat_sidebar.xml",
            "llm_thread/static/src/components/llm_chat_sidebar/llm_chat_sidebar.scss",
            "llm_thread/static/src/components/llm_chat_composer/llm_chat_composer.js",
            "llm_thread/static/src/components/llm_chat_composer/llm_chat_composer.xml",
            "llm_thread/static/src/components/llm_chat_composer/llm_chat_composer.scss",
            "llm_thread/static/src/components/llm_chat_thread_header/llm_chat_thread_header.js",
            "llm_thread/static/src/components/llm_chat_thread_header/llm_chat_thread_header.xml",
            "llm_thread/static/src/components/llm_chat_thread_header/llm_chat_thread_header.scss",
            "llm_thread/static/src/components/llm_chatter/llm_chatter.js",
            "llm_thread/static/src/components/llm_chatter/llm_chatter.xml",
            "llm_thread/static/src/components/llm_chatter/llm_chatter.scss",
            # Form Button Widget
            "llm_thread/static/src/components/llm_form_button/llm_form_button.js",
            "llm_thread/static/src/components/llm_form_button/llm_form_button.xml",
            # Streaming indicator component
            "llm_thread/static/src/components/llm_streaming_indicator/llm_streaming_indicator.js",
            "llm_thread/static/src/components/llm_streaming_indicator/llm_streaming_indicator.xml",
            "llm_thread/static/src/components/llm_streaming_indicator/llm_streaming_indicator.scss",
            # Contact selector dialog
            "llm_thread/static/src/components/contact_selector_dialog/contact_selector_dialog.js",
            "llm_thread/static/src/components/contact_selector_dialog/contact_selector_dialog.xml",
            # Client Actions
            "llm_thread/static/src/llm_chat_client_action.js",
            "llm_thread/static/src/llm_message_actions.js",
            "llm_thread/static/src/llm_message_actions.scss",
        ],
    },
    "images": [
        "static/description/banner.jpeg",
    ],
    "license": "LGPL-3",
    "installable": True,
    "application": True,
    "auto_install": False,
}
