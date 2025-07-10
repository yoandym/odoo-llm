# Views

The LLM Thread module provides both traditional Odoo views and a sophisticated client action interface for AI chat functionality.

## Overview

The module offers two primary interfaces:
1. **Traditional Views** - Standard Odoo form/tree views for thread management
2. **Chat Client Action** - Modern OWL-based chat interface

## Traditional Views

### Thread Form View

```xml
<record id="llm_thread_view_form" model="ir.ui.view">
    <field name="name">llm.thread.view.form</field>
    <field name="model">llm.thread</field>
    <field name="arch" type="xml">
        <form>
            <header>
                <field name="active" widget="boolean_toggle" />
            </header>
            <sheet>
                <div class="oe_title">
                    <h1>
                        <field name="name" placeholder="Chat Title" />
                    </h1>
                </div>
                <group>
                    <group>
                        <field name="user_id" />
                        <field name="provider_id" />
                        <field name="model_id" />
                        <field name="tool_ids" widget="many2many_tags" 
                               options="{'no_create': True}" />
                    </group>
                    <group>
                        <field name="model" readonly="1" />
                        <field name="res_id" readonly="1" />
                    </group>
                </group>
            </sheet>
            <div class="oe_chatter">
                <field name="message_follower_ids" />
                <field name="message_ids" 
                       options="{'post_refresh': 'recipients'}" />
            </div>
        </form>
    </field>
</record>
```

**Key Features**:
- Toggle widget for active status
- Many2many tags widget for tool selection
- Native chatter integration showing all messages
- Related record display (model/res_id)

### Thread Tree View

```xml
<record id="llm_thread_view_tree" model="ir.ui.view">
    <field name="name">llm.thread.view.tree</field>
    <field name="model">llm.thread</field>
    <field name="arch" type="xml">
        <tree>
            <field name="name" />
            <field name="user_id" />
            <field name="provider_id" />
            <field name="model_id" />
            <field name="write_date" />
        </tree>
    </field>
</record>
```

Provides a simple list view for thread management with key information visible at a glance.

### Thread Search View

```xml
<record id="llm_thread_view_search" model="ir.ui.view">
    <field name="name">llm.thread.view.search</field>
    <field name="model">llm.thread</field>
    <field name="arch" type="xml">
        <search>
            <field name="name" />
            <field name="user_id" />
            <field name="provider_id" />
            <field name="model_id" />
        </search>
    </field>
</record>
```

Enables filtering threads by:
- Thread name
- Owner (user)
- AI Provider
- AI Model

## Client Action Interface

### Chat Client Action

The main chat interface is implemented as a client action:

```xml
<record id="action_llm_chat" model="ir.actions.client">
    <field name="name">Chat</field>
    <field name="tag">llm_thread.chat_client_action</field>
    <field name="params" eval="&quot;{}&quot;" />
</record>
```

This launches the full-featured chat interface with:
- Real-time messaging
- Thread management sidebar
- Model/tool selection
- Streaming responses

### Client Action Registration

```javascript
class LLMChatClientAction extends Component {
    static template = xml`
        <LLMChatContainer action="props.action" />
    `;
    static components = { LLMChatContainer };
}

registry.category("actions").add(
    "llm_thread.chat_client_action", 
    LLMChatClientAction
);
```

## Menu Structure

```xml
<!-- Main Chat Menu -->
<menuitem
    id="menu_llm_chat"
    name="Chat"
    action="action_llm_chat"
    parent="llm.menu_llm_root"
    sequence="10"
/>

<!-- Configuration Menu -->
<menuitem
    id="menu_llm_thread"
    name="Threads"
    action="llm_thread_action"
    parent="llm.menu_llm_config"
    sequence="27"
/>
```

**Menu Hierarchy**:
```
LLM (from base module)
├── Chat (launches chat interface)
└── Configuration
    └── Threads (thread management)
```

## Widget Integration

### LLM Chat Button Widget

The module provides a field widget for integrating chat into any form view:

```xml
<!-- In any model's form view -->
<field name="dummy_field" widget="llm_chat_button" invisible="1"/>
```

This creates a button that opens a chat thread linked to the current record.

### Widget Implementation

```javascript
export class LLMFormButton extends Component {
    static template = "llm_thread.LLMFormButton";
    
    async openChat() {
        const record = this.props.record;
        
        // Ensure thread exists for this record
        const thread = await this.llmChatService.ensureThread({
            model: record.resModel,
            res_id: record.resId,
        });
        
        // Open chat interface
        await this.action.doAction("llm_thread.action_llm_chat", {
            props: {
                initActiveId: `${record.resModel}_${record.resId}`,
            },
        });
    }
}

// Register as field widget
registry.category("fields").add("llm_chat_button", {
    component: LLMFormButton,
});
```

## View Extensions

### Chatter Integration

The module extends the standard chatter to display AI conversations:

```xml
<div class="oe_chatter">
    <field name="message_follower_ids" />
    <field name="message_ids" options="{'post_refresh': 'recipients'}" />
</div>
```

Messages are automatically formatted based on their subtype:
- User messages
- Assistant responses
- Tool execution results

### Message Display Customization

The module patches Odoo's message display to add:
- Voting buttons for AI responses
- Special formatting for code blocks
- Tool call visualization
- Streaming indicators

## Action Parameters

### Opening Chat with Context

```python
# Open chat for a specific record
self.env['ir.actions.client'].create({
    'name': 'Chat about Order',
    'tag': 'llm_thread.chat_client_action',
    'params': {
        'default_model': 'sale.order',
        'default_res_id': order.id,
    }
}).read()[0]
```

### URL Parameters

The chat interface supports URL parameters:
- `active_id` - Opens specific thread
- `model` - Pre-selects AI model
- `provider` - Pre-selects provider

Example: `/web#action=123&active_id=llm.thread_45`

## Mobile Responsiveness

The chat interface adapts to mobile devices:

```scss
.o_llm_chat {
    &--mobile {
        .o_llm_chat__sidebar {
            position: absolute;
            width: 100%;
            z-index: 10;
        }
    }
}
```

Mobile features:
- Collapsible sidebar
- Touch-optimized controls
- Responsive message layout

## View Inheritance Examples

### Adding Fields to Thread Form

```xml
<record id="llm_thread_form_inherit" model="ir.ui.view">
    <field name="name">llm.thread.form.inherit</field>
    <field name="model">llm.thread</field>
    <field name="inherit_id" ref="llm_thread.llm_thread_view_form"/>
    <field name="arch" type="xml">
        <field name="model_id" position="after">
            <field name="custom_field"/>
        </field>
    </field>
</record>
```

### Extending the Chat Interface

```javascript
patch(LLMChatContainer.prototype, {
    setup() {
        super.setup();
        // Add custom initialization
    }
});
```

## View Security

Views respect the module's security model:
- Users only see their own threads
- Tool selection limited by permissions
- Admin users have full access

## Best Practices

1. **Use Client Action for Chat**: The client action provides the best user experience
2. **Link to Records**: Use model/res_id to provide context
3. **Widget Integration**: Add chat buttons to relevant forms
4. **Mobile Testing**: Always test on mobile devices
5. **View Inheritance**: Extend views rather than replacing them

## Performance Considerations

1. **Lazy Loading**: The chat interface loads threads on demand
2. **Virtual Scrolling**: Message lists use virtual scrolling for large conversations
3. **Efficient Updates**: Only changed elements re-render
4. **Caching**: Thread list and models are cached in the service