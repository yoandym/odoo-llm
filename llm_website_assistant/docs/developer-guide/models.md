# Models Documentation

This module extends several core models from `im_livechat` and `llm_assistant` to enable AI-powered website chat functionality.

## Extended Models

### chatbot.script

**Inherits:** `im_livechat.chatbot.script`

Extends the standard chatbot script to support LLM assistants.

#### New Fields

```python
llm_assistant_id = fields.Many2one(
    "llm.assistant", 
    string="LLM Assistant", 
    domain="[('is_website_visible', '=', True)]",
    help="LLM assistant to use for this chatbot script"
)

is_llm_enabled = fields.Boolean(
    string="LLM Enabled",
    help="Whether this script has LLM capabilities enabled"
)
```

#### Key Methods

##### `_format_for_frontend()`
```python
def _format_for_frontend(self):
    """Override to include LLM information for frontend consumption"""
```
Adds `isLlmEnabled`, `llmAssistantId`, and `llmAssistantName` to the frontend data.

##### `action_create_llm_steps()`
```python
def action_create_llm_steps(self):
    """Generate standard LLM chatbot flow steps"""
```

Creates the following step structure:
1. **Welcome step** (optional) - Uses channel's default message
2. **LLM input step** - Main conversation handler
3. **Operator forwarding step** - For human handover
4. **No operator available step** - Offers ticket creation
5. **Email collection step** - For ticket creation
6. **Confirmation step** - Confirms ticket creation

### chatbot.script.step

**Inherits:** `im_livechat.chatbot.script.step`

Extends script steps to handle LLM-powered conversations.

#### New Step Type

```python
step_type = fields.Selection(
    selection_add=[('llm_processed_input', 'LLM Processed Input')],
    ondelete={'llm_processed_input': 'set default'}
)
```

#### Key Methods

##### `_process_answer(discuss_channel, message_body)`
```python
def _process_answer(self, discuss_channel, message_body):
    """Process user input through LLM assistant"""
```

For LLM steps:
1. Extracts plain text from HTML message
2. Stores user message in chatbot history
3. Gets LLM response with context
4. Processes flow actions if present
5. Returns next step and parameters

##### Flow Action Handlers

Dynamic dispatch pattern for tool-triggered actions:

```python
def _process_flow_action_forward_to_operator(self, response_data):
    """Handle operator handover request"""
    # Transitions to the forward_operator step
    # Returns (next_step, {'reason': reason})
    
def _process_flow_action_phone_callback(self, response_data):
    """Handle phone callback scheduling"""
    # Collects phone information
    # Returns (phone_step, params)
    
def _process_flow_action_create_ticket(self, response_data):
    """Handle ticket creation"""
    # Creates support ticket
    # Returns (confirmation_step, params)
```

**Extensibility Pattern:**
This module uses method name dispatch similar to Odoo's standard patterns:
1. Tools return responses with `flow_action` field
2. System looks for `_process_flow_action_{action_name}` method
3. If found, calls it with response data
4. Method returns `(next_step, params_dict)`

To add new flow actions in other modules:
1. Define action in `FlowAction` enum
2. Add handler method following naming convention
3. Return appropriate step and parameters

##### `process_llm_step(discuss_channel, user_input)`
```python
def process_llm_step(self, discuss_channel, user_input):
    """Main entry point for LLM step processing"""
```

Handles:
- Thread creation/retrieval
- Message posting
- Tool execution
- Flow action processing

### llm.assistant

**Inherits:** `llm_assistant.llm.assistant`

Extends LLM assistants with website-specific features.

#### New Fields

```python
is_website_visible = fields.Boolean(
    string="Available on public Website",
    default=False,
    tracking=True,
    help="If enabled, this assistant can be selected for use in website live chat channels."
)

allowed_knowledge_collection_ids = fields.Many2many(
    "llm.knowledge.collection",
    string="Allowed Knowledge Collections",
    help="Knowledge collections that this assistant can access. If empty, the assistant can access all collections."
)

website_session_count = fields.Integer(
    string="Website Chat Sessions",
    compute="_compute_website_session_count",
    help="Number of website chat sessions using this assistant"
)
```

### llm.thread

**Inherits:** `llm_thread.llm.thread`

Extends threads to track website livechat source.

#### Key Methods

##### `create(vals_list)`
```python
@api.model_create_multi
def create(self, vals_list):
    """Auto-configure threads from website livechat"""
```

When context contains `from_website_livechat=True`:
- Sets `source='website_livechat'`
- Auto-fills provider, model, prompt from assistant
- Copies tool configuration

### llm.tool (Livechat Handover)

**Inherits:** `llm.tool`

Provides a specialized tool for handing over conversations to human operators.

#### Implementation

```python
def livechat_handover_execute(
    self,
    reason: str = "",
    thread_id: Optional[int] = None,
    urgent: bool = False,
) -> Dict[str, Any]:
    """Handover a livechat conversation to a human operator"""
```

**Parameters:**
- `reason`: The reason for handover (shown to operator)
- `thread_id`: ID of the thread requesting handover
- `urgent`: Priority flag for urgent requests

**Returns:** StandardToolResponse with:
- `flow_action`: `FORWARD_TO_OPERATOR`
- `message`: Handover message for the user
- `flow_params`: Additional parameters for the flow

### llm.tool (Phone Handover)

**Inherits:** `llm.tool`

Provides a tool for scheduling phone callbacks.

#### Implementation

```python
def phone_handover_execute(
    self,
    phone_number: str = "",
    preferred_time: str = "",
    reason: str = "",
    thread_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Schedule a phone callback with the customer"""
```

**Parameters:**
- `phone_number`: Customer's phone number
- `preferred_time`: When to call back
- `reason`: Purpose of the callback
- `thread_id`: Associated thread ID

**Returns:** StandardToolResponse with phone callback flow

## Relationships

```{mermaid}
erDiagram
    chatbot_script ||--o| llm_assistant : "uses"
    chatbot_script ||--o{ chatbot_script_step : "has"
    chatbot_script_step ||--o{ chatbot_message : "creates"
    chatbot_script_step }o--|| discuss_channel : "processes"
    
    llm_assistant ||--o{ llm_thread : "manages"
    llm_assistant }o--o{ llm_knowledge_collection : "accesses"
    
    llm_thread ||--|| discuss_channel : "linked to"
    
    chatbot_script {
        int id PK
        string title
        int llm_assistant_id FK
        boolean is_llm_enabled
    }
    
    chatbot_script_step {
        int id PK
        string step_type
        text message
        boolean is_llm_step
    }
    
    llm_assistant {
        int id PK
        string name
        boolean is_website_visible
        int website_session_count
    }
    
    llm_thread {
        int id PK
        string source
        int res_id
        string model
    }
```

## Model Interactions

### Message Flow

1. **User sends message** → `discuss.channel`
2. **Chatbot processes** → `chatbot.script.step`
3. **LLM generates response** → `llm.assistant` → `llm.thread`
4. **Response posted** → `mail.message` → `chatbot.message`

### Thread Management

- One `llm.thread` per `discuss.channel` (chat session)
- Thread inherits assistant configuration
- Messages tracked for context
- Tools executed within thread context

### Security Model

- Public users can only access `is_website_visible` assistants
- Knowledge collections filtered by `allowed_knowledge_collection_ids`
- All operations use appropriate `sudo()` for public access

## Best Practices

1. **Always check `is_llm_enabled`** before processing LLM steps
2. **Use `with_context(from_website_livechat=True)`** when creating threads
3. **Handle flow actions** through the dispatch pattern
4. **Maintain conversation state** in the same step for continuity
5. **Limit message history** to prevent context overflow