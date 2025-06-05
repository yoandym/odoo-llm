{
    "name": "LLM Prompt Templates",
    "summary": """
        Create and manage reusable prompt templates for LLM interactions""",
    "description": """
        This module extends the LLM integration base to support:
        - Creating reusable prompt templates
        - Dynamic arguments within prompts
        - Multi-step prompt workflows
        - Prompt discovery and retrieval
        - Categories and tags for organization
    """,
    "author": "Apexive Solutions LLC",
    "website": "https://github.com/apexive/odoo-llm",
    "category": "Technical",
    "version": "17.0.1.0.0",
    "depends": ["llm", "llm_thread"],
    "external_dependencies": {
        "python": ["jinja2"],
    },

    "data": [
        "security/ir.model.access.csv",
        "data/llm_prompt_tag_data.xml",
        "data/llm_prompt_category_data.xml",
        "views/llm_prompt_views.xml",
        "views/llm_prompt_template_views.xml",
        "views/llm_prompt_tag_views.xml",
        "views/llm_prompt_category_views.xml",
        "views/llm_thread_views.xml",
        "views/menu.xml",
        "wizards/llm_prompt_test_views.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "llm_prompt/static/src/services/llm_prompt_service.js",
            # "llm_prompt/static/src/services/llm_chat_service_patch.js",
            "llm_prompt/static/src/components/llm_chat_thread_header/llm_chat_thread_header.js",
            "llm_prompt/static/src/components/llm_chat_thread_header/llm_chat_thread_header.xml",
        ],
    },
    "images": [
        "static/description/banner.jpeg",
    ],
    "license": "LGPL-3",
    "installable": True,
    "application": False,
    "auto_install": False,
}
