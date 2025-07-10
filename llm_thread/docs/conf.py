# Configuration file for llm_thread

import sys
from pathlib import Path

# Add parent paths for imports
sys.path.insert(0, str(Path(__file__).parent.parent))  # Module root
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))  # Addons root

# Basic project info
project = "llm_thread"
author = "Fime Team"
release = "17.0.1.0.0"

# Extensions
extensions = [
    "sphinx.ext.autodoc",
    "sphinx.ext.viewcode",
    "sphinx.ext.napoleon",
    "sphinx.ext.intersphinx",
    "myst_parser",
]

# HTML output
html_theme = "agogo"

# Intersphinx
intersphinx_mapping = {
    "python": ("https://docs.python.org/3/", None),
    "odoo": ("https://www.odoo.com/documentation/17.0/", None),
    "main": ("../../../../docs/_build/html", None),  # Link to main docs
}

# Source suffix
source_suffix = {
    ".rst": "restructuredtext",
    ".md": "markdown",
}

# Master doc
master_doc = "index"
