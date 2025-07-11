# Views Documentation

This module extends existing views from `im_livechat` and `llm_assistant` to integrate LLM functionality into the website chat system.

## View Extensions Overview

```{mermaid}
graph LR
    subgraph "Base Views"
        CSF[chatbot.script Form]
        CST[chatbot.script Tree]
        LAF[llm.assistant Form]
        LAS[llm.assistant Search]
    end
    
    subgraph "Extended Views"
        CSFI[+ LLM Configuration]
        CSTI[+ LLM Columns]
        LAFI[+ Website Settings]
        LASI[+ Website Filter]
    end
    
    CSF -->|inherits| CSFI
    CST -->|inherits| CSTI
    LAF -->|inherits| LAFI
    LAS -->|inherits| LASI
```

## Chatbot Script Views

### Form View Extension (`chatbot_script_view_form_inherit`)

**Inherits:** `im_livechat.chatbot_script_view_form`

**Purpose:** Adds LLM assistant configuration to chatbot scripts.

#### Added Elements

##### AI Assistant Configuration Group
```xml
<group string="AI Assistant Configuration">
    <field name="is_llm_enabled"/>
    <field name="llm_assistant_id" 
           options="{'no_create': True}" 
           invisible="not is_llm_enabled"/>
</group>
```

**Features:**
- Toggle to enable/disable LLM functionality
- Assistant selection limited to website-visible assistants
- No inline creation of assistants (security)

##### Helper Alert
```xml
<div class="alert alert-warning" role="alert">
    <p>
        <i class="fa fa-exclamation-triangle"/>
        When using an AI assistant, you need to create appropriate steps for your chatbot.
    </p>
</div>
```

##### Action Buttons
```xml
<button name="action_create_llm_steps" 
        type="object"
        string="Generate AI Assistant Steps" 
        class="btn btn-primary"
        invisible="script_step_ids or not is_llm_enabled or not llm_assistant_id"/>
        
<button name="action_create_llm_steps" 
        type="object"
        string="Reset AI Assistant Steps" 
        class="btn btn-primary"
        invisible="not script_step_ids or not is_llm_enabled or not llm_assistant_id"/>
```

**Button Logic:**
- "Generate" shown when no steps exist and LLM is configured
- "Reset" shown when steps exist and might need regeneration
- Both require LLM to be enabled with an assistant selected

### Tree View Extension (`chatbot_script_view_tree_inherit`)

**Inherits:** `im_livechat.chatbot_script_view_tree`

**Purpose:** Shows LLM configuration in list views.

#### Added Columns
```xml
<field name="is_llm_enabled"/>
<field name="llm_assistant_id"/>
```

**Benefits:**
- Quick identification of LLM-enabled scripts
- See which assistant is configured without opening form

## LLM Assistant Views

### Form View Extension (`view_llm_assistant_form_inherit_website`)

**Inherits:** `llm_assistant.view_llm_assistant_form`

**Purpose:** Adds website-specific configuration to assistants.

#### Added Fields

##### Website Visibility
```xml
<xpath expr="//field[@name='is_default']" position="after">
    <field name="is_website_visible"/>
</xpath>
```

**Placement:** After the default flag for logical grouping

##### Website Settings Tab
```xml
<page string="Website Settings" name="website_settings">
    <group>
        <group string="Knowledge Access">
            <field name="allowed_knowledge_collection_ids" 
                   widget="many2many_tags"/>
            <div class="alert alert-info" role="alert">
                <p>
                    <i class="fa fa-info-circle"/>
                    If no collections are selected, the assistant will not have access to any knowledge.
                </p>
            </div>
        </group>
        <group string="Stats">
            <field name="website_session_count"/>
        </group>
    </group>
</page>
```

**Features:**
- Knowledge collection restrictions for security
- Usage statistics for monitoring
- Clear warning about knowledge access

### Search View Extension (`view_llm_assistant_search_inherit_website`)

**Inherits:** `llm_assistant.view_llm_assistant_search`

**Purpose:** Adds website-specific filters.

#### Added Filter
```xml
<filter string="Website Visible" 
        name="website_visible" 
        domain="[('is_website_visible', '=', True)]"/>
<separator/>
```

**Usage:** Quickly find assistants available for website chat

## View Interactions

### Chatbot Script Configuration Flow

```{mermaid}
stateDiagram-v2
    [*] --> NewScript: Create Script
    NewScript --> EnableLLM: Toggle is_llm_enabled
    EnableLLM --> SelectAssistant: Choose Assistant
    SelectAssistant --> GenerateSteps: Click Generate
    GenerateSteps --> ConfiguredScript: Steps Created
    ConfiguredScript --> ResetSteps: Click Reset
    ResetSteps --> GenerateSteps: Regenerate
    ConfiguredScript --> [*]: Save
```

### Domain Filtering

```python
# Assistant selection domain
domain="[('is_website_visible', '=', True)]"
```

Ensures only appropriate assistants are selectable for public chat.

## UI/UX Considerations

### Visual Hierarchy

1. **Configuration Section**: Prominent placement after title
2. **Warning Alert**: Eye-catching yellow alert for important info
3. **Action Buttons**: Primary button styling for main actions

### Field Dependencies

```xml
<!-- Progressive disclosure pattern -->
<field name="llm_assistant_id" invisible="not is_llm_enabled"/>
```

Fields appear only when relevant, reducing cognitive load.

### Button State Management

```python
# Generate button visibility
invisible="script_step_ids or not is_llm_enabled or not llm_assistant_id"

# Reset button visibility  
invisible="not script_step_ids or not is_llm_enabled or not llm_assistant_id"
```

Buttons change based on current state for clear user guidance.

## Technical Details

### Widget Usage

- `many2many_tags`: For knowledge collection selection
- `options="{'no_create': True}"`: Prevents inline record creation

### XPath Positioning

```xml
<!-- After specific field -->
<xpath expr="//field[@name='title']/.." position="after">

<!-- Inside notebook -->
<xpath expr="//notebook" position="inside">
```

### Security Attributes

- All views respect standard access rights
- No special groups required for viewing
- Editing requires appropriate permissions

## Best Practices

1. **Use Inheritance**: Extend existing views rather than replacing
2. **Progressive Disclosure**: Show fields only when relevant
3. **Clear Labeling**: Use descriptive strings for fields and buttons
4. **Help Text**: Provide context with alerts and help attributes
5. **Consistent Styling**: Follow Odoo's UI patterns
6. **Domain Filtering**: Apply appropriate security domains