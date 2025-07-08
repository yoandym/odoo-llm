LLM Tool Module
===============

.. toctree::
   :maxdepth: 2
   :caption: Contents:

   installation
   user-guide
   admin-guide
   developer-guide
   api

Overview
--------

The LLM Tool module provides a robust framework for integrating Large Language Models (LLMs) with Odoo through function calling and tool execution. This module enables AI assistants to interact with your Odoo database by executing predefined tools, making it possible to automate workflows, retrieve information, and perform actions based on natural language requests.

Key Features
------------

* **Function Calling Framework** - Enable LLMs to call specific functions based on user requests with automatic parameter validation
* **Dynamic Tool Management** - Define and manage LLM tools with custom implementations through a flexible architecture
* **Schema Generation** - Automatic JSON Schema generation from Python method signatures using Pydantic
* **User Consent Management** - Built-in consent system for tools that require explicit user permission
* **Built-in Tool Implementations** - Ready-to-use tools for common operations:

  - User greeting and capability discovery
  - Odoo model inspection
  - Record CRUD operations (Create, Read, Update, Delete)
  - Method execution on Odoo models

* **Integration with Mail Threads** - Seamless integration with Odoo's mail system for chat-like interactions
* **Extensible Architecture** - Easy addition of new tool implementations through inheritance

Requirements
------------

* Odoo 17.0+
* Python 3.8+
* Dependencies:

  - ``base`` - Odoo base module
  - ``mail`` - Odoo mail module  
  - ``llm`` - LLM Integration Base module (provides core LLM functionality)

* Python packages:

  - ``pydantic>=2.0.0`` - For schema generation and validation

Quick Start
-----------

.. code-block:: python

    # Create a new tool
    tool = self.env['llm.tool'].create({
        'name': 'get_customer_info',
        'description': 'Retrieve customer information by name or ID',
        'implementation': 'odoo_record_retriever',
        'active': True,
    })

    # Execute the tool
    result = tool.execute({
        'model': 'res.partner',
        'domain': [('is_company', '=', True)],
        'fields': ['name', 'email', 'phone'],
        'limit': 5
    })

    # Get tool definition for LLM
    tool_def = tool.get_tool_definition()
    # Returns formatted tool specification with input schema

Module Structure
----------------

The module is organized as follows::

    llm_tool/
    ├── models/
    │   ├── llm_tool.py                    # Core tool model
    │   ├── llm_tool_consent_config.py     # Consent configuration
    │   ├── llm_tool_response_schema.py    # Response standardization
    │   └── llm_tool_*.py                  # Built-in implementations
    ├── views/
    │   ├── llm_tool_views.xml             # Tool management views
    │   └── llm_menu_views.xml             # Menu structure
    ├── security/
    │   └── ir.model.access.csv            # Access rights
    └── data/
        └── llm_tool_data.xml              # Default data

Integration Points
------------------

This module integrates with:

* **LLM Integration Base** (``llm``): Provides core LLM functionality and model management
* **Mail Module**: Enables chat-like interactions through mail threads
* **Easy AI Chat** (if installed): Tools become available in chat conversations

Related Modules
---------------

* `LLM Integration Base <../llm/index.html>`_ - Core LLM functionality (required dependency)
* `Easy AI Chat <../llm_thread/index.html>`_ - Interactive AI conversations using tools
* `LLM Mail Message Subtypes <../llm_mail_message_subtypes/index.html>`_ - Enhanced message types for AI interactions

Support
-------

For issues and questions:

* Email: support@apexive.com
* GitHub Issues: `Report an issue <https://github.com/apexive/odoo-llm/issues>`_
* Documentation: `Full Documentation <https://github.com/apexive/odoo-llm>`_

Contributing
------------

We welcome contributions! When adding new tool implementations:

1. Inherit from ``llm.tool`` model
2. Add your implementation to ``_get_available_implementations()``
3. Create an execute method: ``your_implementation_execute(**kwargs)``
4. Follow the standardized response format
5. Add appropriate docstrings for schema generation

See the :doc:`developer-guide` for detailed instructions.

Changelog
---------

See :doc:`../../../changelog` for version history and migration notes.

Indices and Tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
