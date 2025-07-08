API Reference
=============

This document provides a complete API reference for the LLM Tool module.

Module Overview
---------------

.. module:: odoo.addons.llm_tool
   :synopsis: LLM Tool - Function calling and tool execution for LLM models

The LLM Tool module provides a framework for creating and managing tools that Large Language Models can call to interact with Odoo.

Models
------

.. currentmodule:: odoo.addons.llm_tool.models

LLMTool Model
~~~~~~~~~~~~~

.. autoclass:: llm_tool.LLMTool
   :members:
   :undoc-members:
   :show-inheritance:
   :inherited-members:

   **Core Fields:**

   .. autoattribute:: name
      :annotation: = fields.Char(required=True, tracking=True)

      The unique name of the tool used by LLMs to call it.

   .. autoattribute:: description
      :annotation: = fields.Text(required=True, tracking=True)

      Technical description sent to the LLM explaining what the tool does.

   .. autoattribute:: user_description
      :annotation: = fields.Text()

      User-friendly description shown to end users.

   .. autoattribute:: implementation
      :annotation: = fields.Selection()

      The implementation that provides this tool's functionality.

   .. autoattribute:: input_schema
      :annotation: = fields.Text(compute='_compute_input_schema', store=True)

      JSON Schema defining the expected parameters for the tool.

   **Behavior Hint Fields:**

   .. autoattribute:: read_only_hint
      :annotation: = fields.Boolean(default=False)

      If true, the tool does not modify its environment.

   .. autoattribute:: idempotent_hint
      :annotation: = fields.Boolean(default=False)

      If true, repeated calls with same arguments have no additional effect.

   .. autoattribute:: destructive_hint
      :annotation: = fields.Boolean(default=True)

      If true, the tool may perform destructive updates.

   .. autoattribute:: open_world_hint
      :annotation: = fields.Boolean(default=True)

      If true, tool may interact with external entities.

   **Configuration Fields:**

   .. autoattribute:: requires_user_consent
      :annotation: = fields.Boolean(default=False)

      If true, user must consent before tool execution.

   .. autoattribute:: default
      :annotation: = fields.Boolean(default=False)

      If true, tool is included in all LLM requests by default.

   **Core Methods:**

   .. automethod:: execute

      Execute the tool with validated parameters.

      :param dict parameters: Parameters to pass to the tool implementation
      :returns: Standardized response dictionary
      :rtype: dict
      :raises UserError: If implementation not configured
      :raises NotImplementedError: If execute method not found for implementation

   .. automethod:: get_tool_definition

      Get the tool definition in the standard schema format.

      :returns: Tool definition including name, description, schema, and annotations
      :rtype: dict

   .. automethod:: get_input_schema

      Generate input schema from the implementation method signature.

      :param str method: Method name to generate schema for (default: "execute")
      :returns: JSON Schema dictionary
      :rtype: dict

   **Protected Methods:**

   .. automethod:: _compute_input_schema

      Compute and store the input schema from implementation.

   .. automethod:: _get_available_implementations

      Get all available tool implementations. Override in inherited models to register new implementations.

      :returns: List of (value, label) tuples for selection field
      :rtype: list[tuple[str, str]]

   .. automethod:: _selection_implementation

      Get selection values for implementation field.

      :returns: Available implementations
      :rtype: list[tuple[str, str]]

LLMToolConsentConfig Model
~~~~~~~~~~~~~~~~~~~~~~~~~~

.. autoclass:: llm_tool_consent_config.LLMToolConsentConfig
   :members:
   :undoc-members:
   :show-inheritance:

   **Fields:**

   .. autoattribute:: name
      :annotation: = fields.Char(required=True)

      Configuration name.

   .. autoattribute:: active
      :annotation: = fields.Boolean(default=False)

      Only one configuration can be active at a time.

   .. autoattribute:: tool_description_message
      :annotation: = fields.Text()

      Message appended to tool descriptions requiring consent.

   .. autoattribute:: system_message_template
      :annotation: = fields.Text()

      Template for system message sent to LLM about consent requirements.

   **Methods:**

   .. automethod:: get_active_config

      Get the active configuration or create default if none exists.

      :returns: Active consent configuration
      :rtype: LLMToolConsentConfig

   **Constraints:**

   .. automethod:: _check_active_unique

      Ensure only one configuration is active at a time.

      :raises ValidationError: If multiple active configurations exist

Built-in Tool Implementations
-----------------------------

User Greeting Tool
~~~~~~~~~~~~~~~~~~

.. autoclass:: llm_tool_greeting.LLMToolUserGreeting
   :show-inheritance:

   .. automethod:: user_greeting_execute

      Greet the user and provide information about available tools.

      :param str greeting_type: Type of greeting ('initial', 'help', 'capabilities')
      :param int thread_id: ID of the thread to get tools for
      :returns: Dictionary with greeting and available tools
      :rtype: dict

Model Inspector Tool
~~~~~~~~~~~~~~~~~~~~

.. autoclass:: llm_tool_model_inspector.LLMToolModelInspector
   :show-inheritance:

   .. automethod:: odoo_model_inspector_execute

      Comprehensive inspection of an Odoo model.

      :param str model: The Odoo model name to inspect
      :param bool include_fields: Whether to include field information
      :param bool include_methods: Whether to include method information
      :param int field_limit: Maximum number of fields to return
      :param int method_limit: Maximum number of methods to return
      :param bool include_private: Include private fields/methods
      :param str method_name_filter: Filter methods by name
      :param list[str] method_type_filter: Filter methods by type
      :param str field_name_filter: Filter fields by name
      :param list[str] field_type_filter: Filter fields by type
      :returns: Model information including fields, methods, and metadata
      :rtype: dict

Record Retriever Tool
~~~~~~~~~~~~~~~~~~~~~

.. autoclass:: llm_tool_record_retriever.LLMToolRecordRetriever
   :show-inheritance:

   .. automethod:: odoo_record_retriever_execute

      Retrieve records from an Odoo model.

      :param str model: The Odoo model to retrieve records from
      :param list domain: Domain to filter records
      :param list[str] fields: List of field names to retrieve
      :param int limit: Maximum number of records
      :returns: List of record dictionaries
      :rtype: dict

Record Creator Tool
~~~~~~~~~~~~~~~~~~~

.. autoclass:: llm_tool_record_creator.LLMToolRecordCreator
   :show-inheritance:

   .. automethod:: odoo_record_creator_execute

      Create a new record in an Odoo model.

      :param str model: The Odoo model to create record in
      :param dict values: Field values for the new record
      :returns: Created record information
      :rtype: dict

Record Updater Tool
~~~~~~~~~~~~~~~~~~~

.. autoclass:: llm_tool_record_updater.LLMToolRecordUpdater
   :show-inheritance:

   .. automethod:: odoo_record_updater_execute

      Update an existing record in an Odoo model.

      :param str model: The Odoo model containing the record
      :param int record_id: ID of the record to update
      :param dict values: Field values to update
      :returns: Update confirmation
      :rtype: dict

Record Unlinker Tool
~~~~~~~~~~~~~~~~~~~~

.. autoclass:: llm_tool_record_unlinker.LLMToolRecordUnlinker
   :show-inheritance:

   .. automethod:: odoo_record_unlinker_execute

      Delete records from an Odoo model.

      :param str model: The Odoo model to delete from
      :param list[int] record_ids: IDs of records to delete
      :returns: Deletion confirmation
      :rtype: dict

Method Executor Tool
~~~~~~~~~~~~~~~~~~~~

.. autoclass:: llm_tool_model_method_executor.LLMToolModelMethodExecutor
   :show-inheritance:

   .. automethod:: odoo_model_method_executor_execute

      Execute a method on an Odoo model.

      :param str model: The Odoo model
      :param str method: Method name to execute
      :param list args: Positional arguments
      :param dict kwargs: Keyword arguments
      :returns: Method execution result
      :rtype: dict

Response Schema
---------------

.. currentmodule:: odoo.addons.llm_tool.models.llm_tool_response_schema

StandardToolResponse
~~~~~~~~~~~~~~~~~~~~

.. autoclass:: StandardToolResponse

   Reference implementation for standardized tool responses.

   .. automethod:: create_response

      Create a standardized tool response.

      :param str status: Execution status ('success', 'error', 'warning', 'info')
      :param str message: Human-readable message
      :param dict data: Tool-specific data payload
      :param str flow_action: Optional flow control directive
      :param dict flow_params: Parameters for flow action
      :returns: Standardized response dictionary
      :rtype: dict

   .. automethod:: create_info_tool_response

      Helper for creating Information Tool responses.

      :param str message: Message to display
      :param dict data: Information data
      :returns: Response dictionary
      :rtype: dict

   .. automethod:: create_flow_control_response

      Helper for creating Flow Control Tool responses.

      :param str flow_action: Flow control action
      :param str message: Message to display
      :param dict flow_params: Flow parameters
      :returns: Response dictionary
      :rtype: dict

   .. automethod:: create_action_tool_response

      Helper for creating Action Tool responses.

      :param str message: Message to display
      :param dict data: Action result data
      :param str flow_action: Optional flow control
      :param dict flow_params: Flow parameters
      :returns: Response dictionary
      :rtype: dict

   .. automethod:: create_error_response

      Helper for creating error responses.

      :param str error_message: Error message
      :returns: Error response dictionary
      :rtype: dict

ToolStatus
~~~~~~~~~~

.. autoclass:: ToolStatus
   :members:
   :undoc-members:

   Enumeration of standard tool execution statuses.

   .. autoattribute:: SUCCESS
      :annotation: = "success"

   .. autoattribute:: ERROR
      :annotation: = "error"

   .. autoattribute:: WARNING
      :annotation: = "warning"

   .. autoattribute:: INFO
      :annotation: = "info"

FlowAction
~~~~~~~~~~

.. autoclass:: FlowAction

   Standard flow control actions that tools can request.

   .. autoattribute:: FORWARD_TO_OPERATOR
      :annotation: = "forward_to_operator"

      Hand over to human operator.

   .. autoattribute:: PHONE_CALLBACK
      :annotation: = "phone_callback"

      Create phone callback request.

   .. autoattribute:: CREATE_TICKET
      :annotation: = "create_ticket"

      Create helpdesk ticket.

   .. autoattribute:: CREATE_LEAD
      :annotation: = "create_lead"

      Create CRM lead.

   .. autoattribute:: SCHEDULE_MEETING
      :annotation: = "schedule_meeting"

      Schedule a meeting or call.

   .. autoattribute:: END_CONVERSATION
      :annotation: = "end_conversation"

      End the conversation.

   .. autoattribute:: RETURN_TO_SCRIPT
      :annotation: = "return_to_script"

      Return to standard script flow.

   .. autoattribute:: CONTINUE_CONVERSATION
      :annotation: = "continue_conversation"

      Default - stay in LLM conversation.

Utilities
---------

Schema Generation
~~~~~~~~~~~~~~~~~

.. function:: get_pydantic_model_from_signature(method)

   Create a Pydantic model from a method signature.

   :param callable method: Method to analyze
   :returns: Pydantic model class
   :rtype: type[pydantic.BaseModel]

   Example::

       def my_method(self, name: str, age: int = 0):
           pass
       
       model = get_pydantic_model_from_signature(my_method)
       # Creates model with 'name' (required) and 'age' (optional) fields

Examples
--------

Creating a Custom Tool
~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: python

    from odoo import api, models
    
    class MyCustomTool(models.Model):
        _inherit = "llm.tool"
        
        @api.model
        def _get_available_implementations(self):
            implementations = super()._get_available_implementations()
            return implementations + [
                ("my_tool", "My Custom Tool")
            ]
        
        def my_tool_execute(self, param1: str, param2: int = 10):
            """
            Execute my custom tool.
            
            Parameters:
                param1: Description of param1
                param2: Description of param2
            """
            # Implementation
            result = self._process_data(param1, param2)
            
            return {
                "status": "success",
                "message": f"Processed {param1}",
                "data": {"result": result}
            }

Using Tools Programmatically
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: python

    # Get a tool
    tool = self.env['llm.tool'].search([
        ('name', '=', 'customer_search')
    ], limit=1)
    
    # Get tool definition for LLM
    definition = tool.get_tool_definition()
    print(definition)
    # {
    #     "name": "customer_search",
    #     "description": "Search for customers",
    #     "inputSchema": {...},
    #     "annotations": {...}
    # }
    
    # Execute the tool
    result = tool.execute({
        "model": "res.partner",
        "domain": [("is_company", "=", True)],
        "limit": 5
    })
    
    # Handle the result
    if result["status"] == "success":
        customers = result["data"]
        print(f"Found {len(customers)} customers")
    else:
        print(f"Error: {result['message']}")

Tool with Flow Control
~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: python

    from odoo.addons.llm_tool.models.llm_tool_response_schema import (
        StandardToolResponse, FlowAction
    )
    
    class EscalationTool(models.Model):
        _inherit = "llm.tool"
        
        def escalation_execute(self, reason: str, priority: str = "normal"):
            """
            Escalate to human operator.
            
            Parameters:
                reason: Reason for escalation
                priority: Priority level (low, normal, high)
            """
            # Log the escalation
            self._create_escalation_log(reason, priority)
            
            # Return with flow control
            return StandardToolResponse.create_flow_control_response(
                flow_action=FlowAction.FORWARD_TO_OPERATOR,
                message="I'll connect you with a specialist who can help.",
                flow_params={
                    "reason": reason,
                    "priority": priority,
                    "timestamp": fields.Datetime.now()
                }
            )

JavaScript Integration
----------------------

When integrating with frontend components:

.. code-block:: javascript

    // Get available tools
    const tools = await this.rpc({
        model: 'llm.tool',
        method: 'search_read',
        args: [[['active', '=', true]], ['name', 'description']],
    });
    
    // Execute a tool
    const result = await this.rpc({
        model: 'llm.tool',
        method: 'execute',
        args: [toolId, parameters],
    });
    
    // Handle response
    if (result.status === 'success') {
        this.displayResult(result.data);
    } else {
        this.showError(result.message);
    }

Index
-----

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
