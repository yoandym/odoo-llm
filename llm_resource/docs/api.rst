API Reference
=============

This document provides a complete API reference for the module.

Module Overview
---------------

.. automodule:: llm_resource
   :members:
   :undoc-members:
   :show-inheritance:

Models
------

.. currentmodule:: llm_resource.models

Model Classes
~~~~~~~~~~~~~

.. autoclass:: [module_name].models.[ModelName]
   :members:
   :undoc-members:
   :show-inheritance:
   :inherited-members:

   .. automethod:: __init__

   **Fields:**

   .. autoattribute:: field_name
   .. autoattribute:: another_field

   **Computed Fields:**

   .. automethod:: _compute_field_name

   **Constraints:**

   .. automethod:: _check_constraint_name

   **Business Methods:**

   .. automethod:: action_method_name


Controllers
-----------

.. currentmodule:: [module_name].controllers

HTTP Controllers
~~~~~~~~~~~~~~~~

.. autoclass:: [module_name].controllers.[ControllerName]
   :members:
   :undoc-members:
   :show-inheritance:

   **Routes:**

   .. automethod:: route_method_name


Wizards
-------

.. currentmodule:: [module_name].wizard

Transient Models
~~~~~~~~~~~~~~~~

.. autoclass:: [module_name].wizard.[WizardName]
   :members:
   :undoc-members:
   :show-inheritance:


Services
--------

.. currentmodule:: [module_name].services

Service Classes
~~~~~~~~~~~~~~~

.. autoclass:: [module_name].services.[ServiceName]
   :members:
   :undoc-members:
   :show-inheritance:


Utilities
---------

.. currentmodule:: [module_name].utils

Utility Functions
~~~~~~~~~~~~~~~~~

.. automodule:: [module_name].utils
   :members:
   :undoc-members:


Exceptions
----------

.. currentmodule:: [module_name].exceptions

Custom Exceptions
~~~~~~~~~~~~~~~~~

.. autoexception:: [module_name].exceptions.[ExceptionName]
   :members:
   :show-inheritance:


Constants
---------

.. currentmodule:: [module_name].constants

Module Constants
~~~~~~~~~~~~~~~~

.. autodata:: CONSTANT_NAME
.. autodata:: ANOTHER_CONSTANT


Mixins
------

.. currentmodule:: [module_name].mixins

Mixin Classes
~~~~~~~~~~~~~

.. autoclass:: [module_name].mixins.[MixinName]
   :members:
   :undoc-members:
   :show-inheritance:


External API
------------

If this module provides external API endpoints:

REST API Endpoints
~~~~~~~~~~~~~~~~~~

.. http:get:: /api/[module_name]/[endpoint]

   Brief description of the endpoint

   **Request**:

   .. sourcecode:: http

      GET /api/[module_name]/[endpoint] HTTP/1.1
      Host: example.com
      Accept: application/json

   **Response**:

   .. sourcecode:: http

      HTTP/1.1 200 OK
      Content-Type: application/json

      {
        "status": "success",
        "data": {}
      }

   :query param1: Description of query parameter
   :query param2: Description of another parameter
   
   :statuscode 200: Success
   :statuscode 400: Bad request
   :statuscode 404: Not found


XML-RPC Methods
~~~~~~~~~~~~~~~

.. function:: model.method_name(param1, param2)

   Description of the XML-RPC method

   :param param1: Description
   :param param2: Description
   :returns: Description of return value
   :rtype: dict


JavaScript API
--------------

If this module includes JavaScript components:

.. js:module:: [module_name]

.. js:class:: ClassName

   :param Object options: Configuration options

   .. js:method:: methodName(param)

      :param type param: Description
      :returns: Description
      :rtype: ReturnType


Examples
--------

Basic Usage
~~~~~~~~~~~

.. code-block:: python

    from odoo import api, fields, models

    # Example of using the main model
    model = self.env['module.model']
    records = model.search([('field', '=', 'value')])
    
    for record in records:
        record.process_action()

Advanced Usage
~~~~~~~~~~~~~~

.. code-block:: python

    # Example of advanced usage with context
    with_context = self.env['module.model'].with_context(
        special_mode=True
    )
    result = with_context.complex_operation()


Integration Examples
~~~~~~~~~~~~~~~~~~~~

.. code-block:: python

    # Example of integrating with other modules
    def integrate_example(self):
        # Get related model
        related = self.env['related.model']
        
        # Perform integration
        for record in self:
            related.create({
                'reference': record.id,
                'data': record.prepare_data(),
            })


Index
-----

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
