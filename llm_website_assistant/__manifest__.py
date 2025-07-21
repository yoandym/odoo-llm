{
    "name": "LLM Website Assistant",
    "summary": "Integrate LLM assistants with website live chat",
    "description": """
LLM Website Assistant
=====================

Integrate AI assistants from the LLM module with the website live chat system.

This module connects your LLM assistants with the live chat feature on your website, 
allowing website visitors to interact with your AI assistants directly.

Key Features:
- Use LLM assistants as enhanced chatbots in website live chat
- Configure which assistants can be used in public chat channels
- Control which knowledge collections can be accessed by website visitors
- Automatic handover to human operators when needed
- Support for fallback mechanisms when no operators are available

This module serves as a bridge between the LLM assistant functionality and the standard
Odoo live chat system, enhancing the capabilities of chatbots with AI.
    """,
    "author": "FIME Development Team",
    "website": "https://www.fime.cl",
    "category": "Website/Live Chat",
    "version": "17.0.2.0.0",
    "depends": [
        "mail",
        "im_livechat",
        "website_livechat",
        "llm_assistant",
        "llm_knowledge",
        "llm_thread",
    ],
    "data": [
        "security/ir.model.access.csv",
        "data/llm_tool_data.xml",
        "views/llm_assistant_views.xml",
        "views/chatbot_script_views.xml",
        "views/chatbot_script_steps_views.xml",
    ],
    "assets": {
        "web.assets_frontend": [
            # livechat service
            "llm_website_assistant/static/src/js/llm_livechat_service.js",
            # thread model
            "llm_website_assistant/static/src/js/thread_model_patch.js",
            # chatbot
            "llm_website_assistant/static/src/embed/common/chatbot/llm_chatbot_model.js",
            "llm_website_assistant/static/src/embed/common/chatbot/llm_chatbot_step_model.js",
            "llm_website_assistant/static/src/embed/common/chatbot/llm_chatbot_service.js",
            # livechat button
            "llm_website_assistant/static/src/js/llm_livechat_button.js",
        ],
    },
    "license": "LGPL-3",
    "installable": True,
    "application": False,
    "auto_install": False,
}
