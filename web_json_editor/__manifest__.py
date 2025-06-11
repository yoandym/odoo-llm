{
    "name": "Web JSON Editor",
    "version": "1.1",
    "category": "Web",
    "summary": "JSON Editor widget for Odoo",
    "description": """
        Provides a reusable JSON Editor widget for Odoo with schema-based autocomplete.
        Features:
        - JSON syntax highlighting
        - Schema-based autocomplete
        - Multiple view modes (code, tree, form, view)
        - Validation
    """,
    "depends": [
        "web",
    ],
    "assets": {
        "web.assets_backend": [
            # JSONEditor library
            "web_json_editor/static/lib/jsoneditor/jsoneditor.min.js",
            "web_json_editor/static/lib/jsoneditor/jsoneditor.min.css",
            "web_json_editor/static/lib/jsoneditor/img/jsoneditor-icons.svg",

            # Field widgets
            "web_json_editor/static/src/fields/json_field.scss",
            "web_json_editor/static/src/fields/json_field.xml",
            "web_json_editor/static/src/fields/json_field.js",

            "web_json_editor/static/src/fields/markdown_field.xml",
            "web_json_editor/static/src/fields/markdown_field.js",

            # OWL Components
            "web_json_editor/static/src/components/json_editor/json_editor.xml",
            "web_json_editor/static/src/components/json_editor/json_editor.js",

            "web_json_editor/static/src/components/markdown_renderer/markdown_renderer.xml",
            "web_json_editor/static/src/components/markdown_renderer/markdown_renderer.js",
            "web_json_editor/static/src/components/markdown_renderer/markdown_renderer.scss",
        ],
    },
    "author": "Apexive Solutions LLC",
    "website": "https://github.com/apexive/odoo-llm",
    "installable": True,
    "application": False,
    "auto_install": False,
    "license": "LGPL-3",
}
