Developer Guide
===============

This guide provides technical information for developers working with or extending the LLM Assistant module.

Architecture Overview
---------------------

The LLM Assistant module follows a clean architecture pattern with clear separation of concerns:

.. code-block:: text

   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
   │   Frontend UI   │    │   Controllers   │    │   Data Models   │
   │                 │    │                 │    │                 │
   │ • Assistant     │◄──►│ • HTTP Routes   │◄──►│ • llm.assistant │
   │   Selection     │    │ • JSON API      │    │ • llm.thread    │
   │ • Tool Sync     │    │ • Error Handle  │    │ • Security      │
   └─────────────────┘    └─────────────────┘    └─────────────────┘
           │                        │                        │
           ▼                        ▼                        ▼
   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
   │   Services      │    │   Business      │    │   Integration   │
   │                 │    │   Logic         │    │                 │
   │ • Chat Service  │◄──►│ • Prompt Render │◄──►│ • Tool Framework│
   │ • Notification  │    │ • Tool Assignm. │    │ • Provider API  │
   │ • ORM Service   │    │ • Config Apply  │    │ • Template Sys  │
   └─────────────────┘    └─────────────────┘    └─────────────────┘

Key Components
--------------

Data Layer
~~~~~~~~~~

**Models:**

- ``llm.assistant``: Core assistant configuration and behavior
- ``llm.thread``: Enhanced thread with assistant integration  
- Security groups and access controls

**Relationships:**

.. code-block:: python

   # Assistant to Tools (Many2many)
   assistant.tool_ids ←→ llm.tool
   
   # Assistant to Prompt Template (Many2one)
   assistant.prompt_template_id → llm.prompt.template
   
   # Thread to Assistant (Many2one)
   thread.assistant_id → llm.assistant

Business Logic Layer
~~~~~~~~~~~~~~~~~~~~

**Core Operations:**

.. py:function:: apply_assistant_to_thread(assistant_id, thread_id)

   Central business logic for applying assistant configuration to a thread.

   :param int assistant_id: ID of assistant to apply
   :param int thread_id: ID of target thread
   :raises UserError: If assistant not found or invalid
   :raises ValidationError: If configuration invalid

.. py:function:: render_system_prompt(template, context)

   Render prompt template with dynamic context variables.

   :param template: Prompt template record
   :param dict context: Variables for substitution
   :returns: Rendered prompt text
   :rtype: str

**State Management:**

.. code-block:: python

   # Thread state transitions
   thread_states = {
       'no_assistant': {
           'assistant_id': False,
           'tools': [],
           'system_prompt': None
       },
       'assistant_assigned': {
           'assistant_id': assistant.id,
           'tools': assistant.tool_ids,
           'system_prompt': rendered_prompt
       }
   }

Presentation Layer
~~~~~~~~~~~~~~~~~~

**Frontend Components:**

- ``LLMChatThreadHeader``: Enhanced header with assistant selection
- ``AssistantSelector``: Dropdown for assistant selection
- ``ToolSyncManager``: Handles tool synchronization

**State Management:**

.. code-block:: javascript

   // Component state structure
   state = {
       selectedAssistantId: null,
       selectedToolIds: [],
       assistants: [],
       isLoading: false,
       error: null
   }

Development Patterns
--------------------

Model Development
~~~~~~~~~~~~~~~~~

When extending the assistant model, follow these patterns:

**Field Additions:**

.. code-block:: python

   class LLMAssistant(models.Model):
       _inherit = 'llm.assistant'
       
       # New fields should be descriptive and follow naming conventions
       custom_behavior = fields.Selection([
           ('standard', 'Standard'),
           ('advanced', 'Advanced'),
           ('custom', 'Custom')
       ], default='standard', help="Assistant behavior mode")
       
       custom_config = fields.Text(
           string="Custom Configuration",
           help="JSON configuration for custom behavior"
       )

**Method Extensions:**

.. code-block:: python

   @api.model
   def create(self, vals):
       # Pre-processing
       if 'custom_config' in vals:
           vals['custom_config'] = self._validate_custom_config(vals['custom_config'])
       
       # Call parent
       result = super().create(vals)
       
       # Post-processing
       result._setup_custom_behavior()
       return result

   def _validate_custom_config(self, config_json):
       """Validate custom configuration JSON."""
       try:
           config = json.loads(config_json)
           # Validation logic here
           return config_json
       except json.JSONDecodeError:
           raise ValidationError("Invalid JSON in custom configuration")

Frontend Development
~~~~~~~~~~~~~~~~~~~~

**Component Extensions:**

.. code-block:: javascript

   // Extend existing components
   patch(LLMChatThreadHeader.prototype, 'my_module.LLMChatThreadHeader', {
       
       // Override setup to add custom functionality
       setup() {
           this._super();
           this.customService = useService('customService');
           this.state.customData = {};
       },
       
       // Add custom methods
       async onCustomAction(data) {
           try {
               await this.customService.performAction(data);
               this.notificationService.add('Action completed', { type: 'success' });
           } catch (error) {
               this.notificationService.add('Action failed', { type: 'danger' });
           }
       }
   });

**Service Development:**

.. code-block:: javascript

   // Create custom services for business logic
   export const customService = {
       dependencies: ['orm', 'rpc'],
       
       start(env, { orm, rpc }) {
           return {
               async performAction(data) {
                   return await rpc('/custom/endpoint', {
                       method: 'POST',
                       body: JSON.stringify(data)
                   });
               },
               
               async getCustomData(assistantId) {
                   return await orm.call('llm.assistant', 'get_custom_data', [assistantId]);
               }
           };
       }
   };

Controller Development
~~~~~~~~~~~~~~~~~~~~~~

**RESTful API Design:**

.. code-block:: python

   class CustomAssistantController(http.Controller):
       
       @http.route('/api/assistant/<int:assistant_id>/config', 
                   type='json', auth='user', methods=['GET'])
       def get_assistant_config(self, assistant_id):
           """Get assistant configuration."""
           try:
               assistant = request.env['llm.assistant'].browse(assistant_id)
               assistant.check_access_rights('read')
               assistant.check_access_rule('read')
               
               return {
                   'success': True,
                   'data': assistant._get_config_data()
               }
           except AccessError:
               return {'success': False, 'error': 'Access denied'}
           except Exception as e:
               return {'success': False, 'error': str(e)}
       
       @http.route('/api/assistant/<int:assistant_id>/config',
                   type='json', auth='user', methods=['POST'])
       def update_assistant_config(self, assistant_id, **data):
           """Update assistant configuration."""
           try:
               assistant = request.env['llm.assistant'].browse(assistant_id)
               assistant.check_access_rights('write')
               assistant.check_access_rule('write')
               
               assistant._update_config(data)
               
               return {
                   'success': True,
                   'message': 'Configuration updated successfully'
               }
           except ValidationError as e:
               return {'success': False, 'error': str(e)}

Testing Strategies
------------------

Unit Testing
~~~~~~~~~~~~

**Model Testing:**

.. code-block:: python

   class TestLLMAssistantExtensions(TransactionCase):
       
       def setUp(self):
           super().setUp()
           self.Assistant = self.env['llm.assistant']
           self.test_data = {
               'name': 'Test Assistant',
               'description': 'Test description'
           }
       
       def test_custom_config_validation(self):
           """Test custom configuration validation."""
           # Valid JSON
           valid_config = '{"key": "value"}'
           assistant = self.Assistant.create({
               **self.test_data,
               'custom_config': valid_config
           })
           self.assertEqual(assistant.custom_config, valid_config)
           
           # Invalid JSON
           with self.assertRaises(ValidationError):
               self.Assistant.create({
                   **self.test_data,
                   'custom_config': 'invalid json'
               })
       
       def test_behavior_modes(self):
           """Test different behavior modes."""
           for mode in ['standard', 'advanced', 'custom']:
               assistant = self.Assistant.create({
                   **self.test_data,
                   'custom_behavior': mode
               })
               self.assertEqual(assistant.custom_behavior, mode)

**Integration Testing:**

.. code-block:: python

   class TestAssistantIntegration(HttpCase):
       
       def test_api_endpoints(self):
           """Test custom API endpoints."""
           # Test GET endpoint
           response = self.url_open(f'/api/assistant/{self.assistant.id}/config')
           self.assertEqual(response.status_code, 200)
           data = response.json()
           self.assertTrue(data['success'])
           
           # Test POST endpoint
           config_data = {'temperature': 0.8, 'max_tokens': 500}
           response = self.url_open(
               f'/api/assistant/{self.assistant.id}/config',
               data=json.dumps(config_data),
               headers={'Content-Type': 'application/json'}
           )
           self.assertEqual(response.status_code, 200)

Frontend Testing
~~~~~~~~~~~~~~~~

**Component Testing:**

.. code-block:: javascript

   // Use QUnit for frontend testing
   QUnit.module('LLMAssistantExtensions');
   
   QUnit.test('custom action handling', async function (assert) {
       const component = await createComponent(LLMChatThreadHeader, {
           props: { threadId: 1 }
       });
       
       // Test custom action
       await component.onCustomAction({ test: 'data' });
       
       // Verify state changes
       assert.ok(component.state.customData);
       assert.equal(component.state.error, null);
   });

Performance Testing
~~~~~~~~~~~~~~~~~~~

**Database Performance:**

.. code-block:: python

   def test_assistant_query_performance(self):
       """Test query performance with large datasets."""
       # Create test data
       assistants = []
       for i in range(1000):
           assistants.append({
               'name': f'Assistant {i}',
               'temperature': 0.7,
           })
       
       # Measure query time
       start_time = time.time()
       created_assistants = self.Assistant.create(assistants)
       creation_time = time.time() - start_time
       
       # Query performance
       start_time = time.time()
       results = self.Assistant.search([('temperature', '=', 0.7)])
       query_time = time.time() - start_time
       
       # Assert reasonable performance
       self.assertLess(creation_time, 5.0)  # < 5 seconds
       self.assertLess(query_time, 1.0)     # < 1 second
       self.assertEqual(len(results), 1000)

Security Considerations
-----------------------

Access Control
~~~~~~~~~~~~~~

**Record Rules:**

.. code-block:: python

   # Implement record-level security
   class LLMAssistant(models.Model):
       _inherit = 'llm.assistant'
       
       def _get_domain_filter(self):
           """Apply domain filters based on user context."""
           domain = []
           
           # Restrict based on user department
           if not self.env.user.has_group('llm_assistant.group_llm_assistant_manager'):
               user_dept = self.env.user.department_id
               if user_dept:
                   domain.append(('allowed_departments', 'in', [user_dept.id]))
           
           return domain

**Input Validation:**

.. code-block:: python

   @api.constrains('custom_config')
   def _check_custom_config(self):
       """Validate custom configuration for security."""
       for record in self:
           if record.custom_config:
               try:
                   config = json.loads(record.custom_config)
                   # Check for dangerous keys
                   dangerous_keys = ['exec', 'eval', '__import__']
                   if any(key in str(config) for key in dangerous_keys):
                       raise ValidationError("Configuration contains forbidden operations")
               except json.JSONDecodeError:
                   raise ValidationError("Invalid JSON configuration")

Data Protection
~~~~~~~~~~~~~~~

**Sensitive Data Handling:**

.. code-block:: python

   class LLMAssistant(models.Model):
       _inherit = 'llm.assistant'
       
       def _sanitize_prompt_context(self, context):
           """Remove sensitive data from prompt context."""
           sensitive_keys = ['password', 'token', 'secret', 'key']
           sanitized = {}
           
           for key, value in context.items():
               if not any(sensitive in key.lower() for sensitive in sensitive_keys):
                   sanitized[key] = value
               else:
                   sanitized[key] = '[REDACTED]'
           
           return sanitized

Migration and Upgrades
----------------------

Database Migrations
~~~~~~~~~~~~~~~~~~~

**Migration Scripts:**

.. code-block:: python

   def migrate(cr, version):
       """Migration script for module upgrades."""
       if not version:
           return
       
       # Version-specific migrations
       if version < '1.1.0':
           _migrate_to_1_1_0(cr)
       
       if version < '1.2.0':
           _migrate_to_1_2_0(cr)
   
   def _migrate_to_1_1_0(cr):
       """Migrate to version 1.1.0."""
       # Add new fields with default values
       cr.execute("""
           ALTER TABLE llm_assistant 
           ADD COLUMN IF NOT EXISTS custom_behavior VARCHAR(20) DEFAULT 'standard'
       """)
       
       # Update existing records
       cr.execute("""
           UPDATE llm_assistant 
           SET custom_behavior = 'standard' 
           WHERE custom_behavior IS NULL
       """)

Configuration Migration
~~~~~~~~~~~~~~~~~~~~~~~

**Data Migration:**

.. code-block:: python

   def migrate_assistant_configs(env):
       """Migrate assistant configurations to new format."""
       assistants = env['llm.assistant'].search([])
       
       for assistant in assistants:
           old_config = assistant.legacy_config
           if old_config:
               # Convert old format to new
               new_config = convert_config_format(old_config)
               assistant.write({
                   'custom_config': json.dumps(new_config),
                   'legacy_config': False
               })

Deployment Considerations
-------------------------

Production Setup
~~~~~~~~~~~~~~~~

**Configuration Checklist:**

1. **Security Groups:** Properly assigned user permissions
2. **Rate Limiting:** API rate limits for external calls
3. **Monitoring:** Error tracking and performance monitoring
4. **Backup:** Regular backup of assistant configurations
5. **Caching:** Enable caching for frequent operations

**Performance Optimization:**

.. code-block:: python

   # Enable caching for expensive operations
   @tools.ormcache('assistant_id', 'context_hash')
   def _get_cached_prompt(self, assistant_id, context_hash):
       assistant = self.browse(assistant_id)
       return assistant.get_system_prompt(context)

Monitoring and Logging
~~~~~~~~~~~~~~~~~~~~~~

**Custom Logging:**

.. code-block:: python

   import logging
   _logger = logging.getLogger(__name__)
   
   class LLMAssistant(models.Model):
       _inherit = 'llm.assistant'
       
       def action_apply_to_thread(self, thread_id):
           _logger.info(f"Applying assistant {self.id} to thread {thread_id}")
           
           try:
               result = super().action_apply_to_thread(thread_id)
               _logger.info(f"Successfully applied assistant {self.id}")
               return result
           except Exception as e:
               _logger.error(f"Failed to apply assistant {self.id}: {str(e)}")
               raise

Troubleshooting for Developers
------------------------------

Common Development Issues
~~~~~~~~~~~~~~~~~~~~~~~~~

**Issue: Component Not Updating**

.. code-block:: javascript

   // Problem: State not reactive
   this.selectedAssistantId = newId;  // Won't trigger re-render
   
   // Solution: Use reactive state
   this.state.selectedAssistantId = newId;  // Triggers re-render

**Issue: Access Rights Error**

.. code-block:: python

   # Problem: Missing access check
   assistant = self.env['llm.assistant'].browse(assistant_id)
   assistant.write(data)  # May fail with access error
   
   # Solution: Proper access control
   assistant = self.env['llm.assistant'].browse(assistant_id)
   assistant.check_access_rights('write')
   assistant.check_access_rule('write')
   assistant.write(data)

**Issue: Memory Leaks in Frontend**

.. code-block:: javascript

   // Problem: Event listeners not cleaned up
   setup() {
       document.addEventListener('click', this.onClick);
   }
   
   // Solution: Proper cleanup
   setup() {
       document.addEventListener('click', this.onClick);
       onWillUnmount(() => {
           document.removeEventListener('click', this.onClick);
       });
   }

Debug Tools
~~~~~~~~~~~

**Backend Debugging:**

.. code-block:: python

   # Enable SQL debugging
   import logging
   logging.getLogger('odoo.sql_db').setLevel(logging.DEBUG)
   
   # Add debug breakpoints
   import pdb; pdb.set_trace()
   
   # Performance profiling
   import cProfile
   cProfile.run('assistant.action_apply_to_thread(thread_id)')

**Frontend Debugging:**

.. code-block:: javascript

   
   // Debug service calls
   const originalCall = this.orm.call;
   this.orm.call = function(...args) {
       console.log('ORM call:', args);
       return originalCall.apply(this, args);
   };

Contributing Guidelines
-----------------------

Code Standards
~~~~~~~~~~~~~~

**Python Code:**

- Follow PEP 8 style guidelines
- Use type hints where appropriate  
- Maximum line length: 150 characters
- Comprehensive docstrings for all public methods

**JavaScript Code:**

- Use ES6+ syntax
- Follow Odoo OWL conventions
- Prefer const/let over var
- Use template literals for strings with variables

**Documentation:**

- RST for technical documentation
- Markdown for user guides
- Include practical examples
- Keep documentation up-to-date with code changes

Pull Request Process
~~~~~~~~~~~~~~~~~~~~

1. **Branch Naming:** ``feature/description`` or ``fix/issue-number``
2. **Commit Messages:** Clear, descriptive commit messages
3. **Testing:** Include tests for new functionality
4. **Documentation:** Update relevant documentation
5. **Code Review:** Address all review comments before merging

**Example PR Template:**

.. code-block:: text

   ## Description
   Brief description of the change and its purpose.
   
   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update
   
   ## Testing
   - [ ] Unit tests added/updated
   - [ ] Integration tests added/updated
   - [ ] Manual testing performed
   
   ## Documentation
   - [ ] Code comments updated
   - [ ] User documentation updated
   - [ ] API documentation updated
   
   ## Checklist
   - [ ] Code follows project style guidelines
   - [ ] Self-review completed
   - [ ] Tests pass locally
   - [ ] No new linter warnings
