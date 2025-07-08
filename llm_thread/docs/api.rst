API Reference
=============

This document provides a complete API reference for the Easy AI Chat (llm_thread) module.

Module Overview
---------------

.. automodule:: odoo.addons.llm_thread
   :members:
   :undoc-members:
   :show-inheritance:

Models
------

.. currentmodule:: odoo.addons.llm_thread.models

LLMThread Model
~~~~~~~~~~~~~~~

.. autoclass:: llm_thread.LLMThread
   :members:
   :undoc-members:
   :show-inheritance:
   :inherited-members:

   **Fields:**

   .. autoattribute:: name
      :annotation: = fields.Char(string="Title", required=True)
      
      The title of the chat thread.

   .. autoattribute:: user_id
      :annotation: = fields.Many2one("res.users", string="User", required=True)
      
      The user who owns this thread.

   .. autoattribute:: provider_id
      :annotation: = fields.Many2one("llm.provider", string="Provider", required=True)
      
      The AI provider used for this thread.

   .. autoattribute:: model_id
      :annotation: = fields.Many2one("llm.model", string="Model", required=True)
      
      The specific AI model used for generation.

   .. autoattribute:: active
      :annotation: = fields.Boolean(default=True)
      
      Whether the thread is active or archived.

   .. autoattribute:: message_ids
      :annotation: = fields.One2many("mail.message", inverse_name="res_id")
      
      All messages in this thread.

   .. autoattribute:: model
      :annotation: = fields.Char("Related Document Model")
      
      The model name of any linked Odoo record.

   .. autoattribute:: res_id
      :annotation: = fields.Many2oneReference("Related Document ID")
      
      The ID of any linked Odoo record.

   .. autoattribute:: is_locked
      :annotation: = fields.Boolean(readonly=True)
      
      Indicates if the thread is currently generating a response.

   .. autoattribute:: tool_ids
      :annotation: = fields.Many2many("llm.tool")
      
      Tools available for the AI to use in this thread.

   .. autoattribute:: source
      :annotation: = fields.Selection([...])
      
      Origin of the thread (website_livechat, backend, api, etc.)

   **Key Methods:**

   .. automethod:: generate(user_message_body, **kwargs)
      
      Generate AI response with streaming support.
      
      :param str user_message_body: The user's message text
      :param kwargs: Additional parameters for generation
      :yields: dict with response chunks containing type and data
      :raises UserError: If thread is locked or generation fails

   .. automethod:: send_message(message_content)
      
      Send a user message and trigger AI response.
      
      :param str message_content: The message to send
      :returns: dict with success status and message info
      :rtype: dict

   .. automethod:: _process_tool_calls(assistant_msg)
      
      Process and execute tool calls from AI response.
      
      :param assistant_msg: Message containing tool calls
      :yields: Tool execution results

   .. automethod:: _get_message_history_recordset(order="ASC", limit=None)
      
      Get messages from the thread.
      
      :param str order: Sort order (ASC or DESC)
      :param int limit: Maximum number of messages
      :returns: mail.message recordset

   .. automethod:: get_related_record()
      
      Get the linked Odoo record if any.
      
      :returns: The linked record or False
      :rtype: recordset or bool

   .. automethod:: reset_to_defaults()
      
      Reset thread to system default configuration.
      
      :returns: True if successful
      :rtype: bool


MailMessage Extensions
~~~~~~~~~~~~~~~~~~~~~~

.. autoclass:: mail_message.MailMessage
   :members:
   :undoc-members:
   :show-inheritance:

   **Additional Fields:**

   .. autoattribute:: tool_calls
      :annotation: = fields.Text("Tool Calls JSON")
      
      JSON string containing tool call definitions.

   .. autoattribute:: tool_call_id
      :annotation: = fields.Char("Tool Call ID")
      
      Unique identifier for tool call results.

   .. autoattribute:: tool_call_definition
      :annotation: = fields.Text("Tool Call Definition")
      
      JSON definition of the tool call.

   .. autoattribute:: tool_call_result
      :annotation: = fields.Text("Tool Call Result")
      
      JSON result from tool execution.

   **Methods:**

   .. automethod:: is_llm_assistant_message()
      
      Check if this is an AI assistant message.
      
      :returns: True if AI message
      :rtype: bool

   .. automethod:: is_llm_user_message()
      
      Check if this is a user message.
      
      :returns: True if user message
      :rtype: bool

   .. automethod:: is_llm_tool_result_message()
      
      Check if this is a tool result message.
      
      :returns: True if tool result
      :rtype: bool

   .. automethod:: create_message_from_stream(thread, stream_response, subtype_xmlid, placeholder_text="Thinking...")
      
      Create message from streaming AI response.
      
      :param thread: The LLM thread
      :param stream_response: Generator yielding response chunks
      :param str subtype_xmlid: Message subtype XML ID
      :param str placeholder_text: Initial placeholder text
      :yields: Response chunks for client

   .. automethod:: stream_llm_tool_result(thread, tool_call_def)
      
      Stream tool execution results.
      
      :param thread: The LLM thread
      :param dict tool_call_def: Tool call definition
      :yields: Tool execution updates


Controllers
-----------

.. currentmodule:: odoo.addons.llm_thread.controllers

LLMThreadController
~~~~~~~~~~~~~~~~~~~

.. autoclass:: llm_thread.LLMThreadController
   :members:
   :undoc-members:
   :show-inheritance:

   **HTTP Routes:**

   .. automethod:: llm_thread_update(thread_id, **kwargs)
      
      Update thread properties via JSON-RPC.
      
      :param int thread_id: Thread ID to update
      :param kwargs: Fields to update
      :returns: {'status': 'success'} or {'status': 'error', 'error': message}

   .. automethod:: llm_thread_generate(thread_id, message=None, **kwargs)
      
      Stream AI responses using Server-Sent Events.
      
      :param int thread_id: Thread ID
      :param str message: Optional user message
      :returns: SSE stream response

   .. automethod:: llm_message_vote(message_id, vote_value)
      
      Vote on message quality.
      
      :param int message_id: Message to vote on
      :param int vote_value: Vote value (1 for up, -1 for down)
      :returns: {'success': True} or {'error': message}


JavaScript API
--------------

Services
~~~~~~~~

.. js:module:: llm_thread

.. js:class:: LLMChatService

   Main service for chat operations.

   .. js:method:: sendMessage(threadId, message)

      Send a message to a thread.

      :param Number threadId: Thread ID
      :param String message: Message content
      :returns: Promise resolving to message data

   .. js:method:: subscribeToThread(threadId, callback)

      Subscribe to real-time thread updates.

      :param Number threadId: Thread ID
      :param Function callback: Callback for updates
      :returns: Function to unsubscribe

   .. js:method:: voteMessage(messageId, vote)

      Vote on a message.

      :param Number messageId: Message ID
      :param Number vote: 1 for up, -1 for down
      :returns: Promise

Components
~~~~~~~~~~

.. js:class:: LLMChatContainer

   Main container component for chat interface.

   :param Number threadId: Thread to display
   :param Boolean showSidebar: Whether to show sidebar

.. js:class:: LLMChatThread

   Thread display component.

   :param Object thread: Thread data
   :param Boolean isActive: Whether thread is active

.. js:class:: LLMChatComposer

   Message composer component.

   :param Function onSend: Callback when sending message
   :param Boolean disabled: Whether composer is disabled


REST API Endpoints
------------------

Thread Generation
~~~~~~~~~~~~~~~~~

.. http:get:: /llm/thread/generate

   Stream AI responses for a thread.

   **Request**:

   .. sourcecode:: http

      GET /llm/thread/generate?thread_id=123&message=Hello HTTP/1.1
      Host: example.com
      Accept: text/event-stream

   **Response**:

   .. sourcecode:: http

      HTTP/1.1 200 OK
      Content-Type: text/event-stream
      Cache-Control: no-cache

      data: {"type": "message_create", "message": {...}}

      data: {"type": "content_update", "content": "Hello! How can I..."}

      data: {"type": "done"}

   :query thread_id: Thread ID (required)
   :query message: Optional user message
   
   :statuscode 200: Success, streaming response
   :statuscode 404: Thread not found
   :statuscode 403: Access denied

Message Voting
~~~~~~~~~~~~~~

.. http:post:: /llm/message/vote

   Vote on message quality.

   **Request**:

   .. sourcecode:: http

      POST /llm/message/vote HTTP/1.1
      Host: example.com
      Content-Type: application/json

      {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
          "message_id": 456,
          "vote_value": 1
        }
      }

   **Response**:

   .. sourcecode:: http

      HTTP/1.1 200 OK
      Content-Type: application/json

      {
        "jsonrpc": "2.0",
        "result": {"success": true}
      }


XML-RPC Methods
~~~~~~~~~~~~~~~

.. function:: llm.thread.create(vals)

   Create a new chat thread.

   :param dict vals: Thread values (name, provider_id, model_id, etc.)
   :returns: Created thread ID
   :rtype: int

.. function:: llm.thread.send_message(thread_id, message)

   Send message to thread.

   :param int thread_id: Thread ID
   :param str message: Message content
   :returns: Result dictionary
   :rtype: dict

.. function:: llm.thread.generate(thread_id, user_message_body)

   Generate AI response (non-streaming).

   :param int thread_id: Thread ID
   :param str user_message_body: User message
   :returns: Final message
   :rtype: dict


Examples
--------

Python Usage
~~~~~~~~~~~~

Creating and Using Threads
^^^^^^^^^^^^^^^^^^^^^^^^^^

.. code-block:: python

    from odoo import api, fields, models

    # Create a new thread
    thread = self.env['llm.thread'].create({
        'name': 'Customer Support',
        'provider_id': provider.id,
        'model_id': model.id,
        'tool_ids': [(6, 0, [tool1.id, tool2.id])],
    })

    # Send a message
    result = thread.send_message("Hello, I need help")
    
    # Generate response (blocking)
    messages = list(thread.generate("What can you help me with?"))

Context-Aware Threads
^^^^^^^^^^^^^^^^^^^^^

.. code-block:: python

    # Link thread to a record
    sale_order = self.env['sale.order'].browse(123)
    
    thread = self.env['llm.thread'].create({
        'name': f'Assistant for {sale_order.name}',
        'model': 'sale.order',
        'res_id': sale_order.id,
        'provider_id': provider.id,
        'model_id': model.id,
    })
    
    # AI can now access sale order data
    thread.send_message("What's the total amount of this order?")

Custom Tool Integration
^^^^^^^^^^^^^^^^^^^^^^^

.. code-block:: python

    # Create thread with custom tools
    tools = self.env['llm.tool'].search([
        ('name', 'in', ['search_products', 'calculate_price'])
    ])
    
    thread = self.env['llm.thread'].create({
        'name': 'Sales Assistant',
        'provider_id': provider.id,
        'model_id': model.id,
        'tool_ids': [(6, 0, tools.ids)],
    })

JavaScript Usage
~~~~~~~~~~~~~~~~

Basic Chat Implementation
^^^^^^^^^^^^^^^^^^^^^^^^^

.. code-block:: javascript

    // Get the service
    const chatService = this.env.services.llm_chat;
    
    // Send a message
    await chatService.sendMessage(threadId, "Hello AI!");
    
    // Subscribe to updates
    const unsubscribe = chatService.subscribeToThread(
        threadId,
        (update) => {
            console.log("Thread update:", update);
        }
    );

Streaming Response Handling
^^^^^^^^^^^^^^^^^^^^^^^^^^^

.. code-block:: javascript

    // Handle streaming responses
    const eventSource = new EventSource(
        `/llm/thread/generate?thread_id=${threadId}&message=${message}`
    );
    
    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch(data.type) {
            case 'message_create':
                // New message created
                break;
            case 'content_update':
                // Streaming content update
                break;
            case 'tool_call':
                // Tool being called
                break;
            case 'done':
                // Generation complete
                eventSource.close();
                break;
        }
    };

External Integration
~~~~~~~~~~~~~~~~~~~~

.. code-block:: python

    import requests
    import json

    # External API usage
    base_url = "https://odoo.example.com"
    headers = {
        "Content-Type": "application/json",
        "Cookie": "session_id=..."
    }

    # Create thread via XML-RPC
    payload = {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "service": "object",
            "method": "execute",
            "args": [
                "odoo_db",
                uid,
                "password",
                "llm.thread",
                "create",
                {
                    "name": "API Thread",
                    "provider_id": 1,
                    "model_id": 1
                }
            ]
        }
    }
    
    response = requests.post(
        f"{base_url}/jsonrpc",
        json=payload,
        headers=headers
    )
    thread_id = response.json()["result"]


Error Handling
--------------

Common Exceptions
~~~~~~~~~~~~~~~~~

.. exception:: ThreadLockError

   Raised when attempting to generate while thread is locked.

.. exception:: ProviderError

   Raised when AI provider encounters an error.

.. exception:: ToolExecutionError

   Raised when tool execution fails.

Error Response Format
~~~~~~~~~~~~~~~~~~~~~

All API endpoints return consistent error format:

.. code-block:: json

    {
        "error": {
            "code": 403,
            "message": "Access Denied",
            "data": {
                "debug": "User lacks permission llm_thread.use"
            }
        }
    }


Index
-----

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
