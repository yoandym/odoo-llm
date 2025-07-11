# Odoo Native im_livechat Architecture

This document describes the technical architecture of Odoo's native `im_livechat` module, which provides real-time chat functionality for websites. The `im_livechat` module works in conjunction with `website_livechat` to enable visitor-operator communication.

## Module Dependencies

The livechat functionality in Odoo is provided by several interconnected modules:

- **im_livechat**: Core livechat functionality and backend models
- **website_livechat**: Website integration and visitor tracking
- **mail**: Messaging infrastructure that livechat builds upon
- **discuss**: Chat interface and channel management
- **website**: Web frontend integration

## Core Components

### 1. Models

```{mermaid}
:zoom:
classDiagram
    direction TB
    %% Backend Models
    class im_livechat_channel
    class im_livechat_channel_rule
    class discuss_channel
    class website_visitor
    class chatbot_script
    class chatbot_script_step

    %% Relationships
    im_livechat_channel --> im_livechat_channel_rule : "follow rules"
    im_livechat_channel --> discuss_channel : "creates/manages"
    discuss_channel --> website_visitor : "links to"
    discuss_channel --> chatbot_script : "uses script"
    chatbot_script --> chatbot_script_step : "has steps"

    %% Notes for key components
    note for im_livechat_channel "Defines channel properties<br />Manages operator assignments<br />Controls channel availability rules"
    note for im_livechat_channel_rule "URL regex patterns for page targeting<br />Display modes (show, auto-popup, hide)<br />Country-based restrictions<br />Chatbot script assignment"
    note for discuss_channel "Inherits from mail.thread<br />Stores chat history<br />Manages participant information<br />Links to visitors via livechat_visitor_id"
    note for website_visitor "Anonymous visitor identification<br />Page visit history<br />Geographic information<br />Livechat interaction history"
    note for chatbot_script "Step-based conversation structure<br />Multiple step types<br />Conditional branching logic<br />Operator handover capabilities"
    note for chatbot_script_step "Message content and type<br />Answer options for questions<br />Validation rules<br />Next step logic"
```

### 2. Controllers

#### LivechatController (`/im_livechat/*`)
Main controller handling:
- `/init`: Channel initialization and rule matching
- `/get_session`: Create or fetch a livechat session
- `/visitor_leave_session`: End visitor session and notify operator

#### LivechatChatbotScriptController (`/chatbot/*`)
Handles chatbot interactions:
- `/restart`: Restart chatbot conversation
- `/post_welcome_steps`: Post initial/welcome steps for chatbot
- `/answer/save`: Save selected answer for a chatbot step
- `/step/trigger`: Process user responses and advance script
- `/step/validate_email`: Validate email input in chatbot
- `/step/validate_phone`: Validate phone input in chatbot

### 3. Frontend Architecture

#### OWL Services
- **LivechatService**: Core service managing chat state
- **ChatbotService**: Handles automated conversations
- **MessagingService**: Underlying messaging infrastructure

#### OWL Components
- **LivechatButton**: Floating chat button widget
- **LivechatWindow**: Chat conversation interface
- **ChatbotMessages**: Renders bot messages and options

```{mermaid}
:zoom:
---
config:
  look: handDrawn
---
classDiagram
    direction TB
    %% OWL Services
    class LivechatService
    class ChatbotService
    class MessagingService
    %% OWL Components
    class LivechatButton
    class LivechatWindow
    class ChatbotMessages

    %% Relationships
    LivechatService --> LivechatButton : "controls"
    LivechatService --> LivechatWindow : "controls"
    LivechatService --> MessagingService : "uses"
    ChatbotService --> ChatbotMessages : "renders"

    %% Notes for key components
    note for LivechatService "Core JS service managing chat state"
    note for ChatbotService "Handles automated conversations and script logic"
    note for MessagingService "Underlying messaging infrastructure"
    note for LivechatButton "Floating chat button widget"
    note for LivechatWindow "Chat conversation interface"
    note for ChatbotMessages "Renders bot messages and options"
```

## Data Flow

### 1. Initialization Sequence

```
1. Visitor loads website page
2. LivechatService calls /im_livechat/init
3. Server checks matching rules (URL, country, etc.)
4. Returns channel configuration if rule matches
5. Frontend displays chat button based on settings
6. Creates discuss.channel when chat starts
7. Frontend calls /chatbot/post_welcome_steps to post initial bot message(s)
```

```{mermaid}
sequenceDiagram
    participant V as Visitor
    participant F as Frontend
    participant S as Server
    participant DC as discuss.channel
    V->>F: Load website page
    F->>S: /im_livechat/init
    S->>S: Check matching rules
    S-->>F: Return channel config
    F->>V: Display chat button
    V->>F: Start chat
    F->>S: Create discuss.channel
    S->>DC: Create channel
    F->>S: /chatbot/post_welcome_steps
    S->>DC: Post welcome steps
```

### 2. Message Flow

```
1. User sends message via frontend
2. Message posted to discuss.channel
3. If chatbot active: processes through script steps
4. If operator active: notifies operator
5. Response sent back through channel
6. Frontend updates conversation display
```

```{mermaid}
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant DC as discuss.channel
    participant CB as Chatbot
    participant OP as Operator
    U->>F: Send message
    F->>DC: Post message
    alt Chatbot active
        DC->>CB: Process script steps
        CB-->>DC: Bot response
    else Operator active
        DC->>OP: Notify operator
        OP-->>DC: Operator response
    end
    DC-->>F: Response
    F->>U: Update conversation
```

### 3. Chatbot Processing

```
1. User input triggers /chatbot/step/trigger
2. Current step validates input
3. Determines next step based on answer/logic
4. Posts bot message for next step
5. Updates conversation state
6. Handles special actions (operator handover, etc.)
```

```{mermaid}
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant CBC as ChatbotController
    participant CSS as ChatbotScriptStep
    U->>F: Input message
    F->>CBC: /chatbot/step/trigger
    CBC->>CSS: Validate input
    CSS->>CSS: Determine next step
    CSS-->>CBC: Bot message for next step
    CBC-->>F: Update state
    CSS->>CSS: Handle special actions
```

## Key Features

### 1. Multi-Channel Support
- Multiple livechat channels with different configurations
- Channel-specific operators and rules
- Independent chatbot scripts per channel

### 2. Visitor Tracking
- Anonymous visitor identification using cookies
- Persistent visitor history across sessions
- Geographic detection via GeoIP

### 3. Operator Management
- Operator availability status
- Automatic distribution of chats
- Operator chat capacity limits
- Away/offline handling

### 4. Chatbot Capabilities
- Visual script builder
- Multiple step types:
  - Text: Simple messages
  - Question: Multiple choice
  - Email: Email collection with validation
  - Phone: Phone number collection
  - Forward to Operator: Human handover
- Conditional logic and branching
- Integration with other Odoo apps (CRM, Helpdesk)

### 5. Session Persistence
- Chat history preservation
- Visitor context maintenance
- Conversation resumption

## Security Model

### 1. Access Rights
- Public users: Limited to their own chat sessions
- Portal users: Access to their chat history
- Internal users: Based on operator assignment
- Website visitors: Anonymous access with session tokens

### 2. Data Isolation
- Visitors only see their own conversations
- Operators see assigned chats only
- Cross-domain protection
- CSRF token validation

## Integration Points

### 1. CRM Integration (crm_livechat)
- Automatic lead creation from chats
- Visitor to lead conversion
- Chat transcript attachment

### 2. Helpdesk Integration
- Ticket creation from chat
- Chat history in ticket context
- Operator to support agent handover

### 3. Website Integration
- Page-specific targeting
- Visitor behavior tracking
- Multi-website support

## Performance Considerations

### 1. Polling Architecture
- Long-polling for real-time updates
- Configurable polling intervals
- Connection pooling

### 2. Caching
- Channel configuration caching
- Visitor session caching
- Static resource optimization

### 3. Scalability
- Operator load balancing
- Channel capacity management
- Database query optimization

## Extension Points

The im_livechat module is designed to be extended by other modules:

1. **Model Inheritance**: Extend core models with new fields
2. **Controller Override**: Modify endpoints behavior
3. **JavaScript Extension**: Patch frontend services
4. **View Inheritance**: Customize UI components
5. **Chatbot Step Types**: Add custom step types

This architecture provides a solid foundation for real-time customer communication while maintaining flexibility for customization and integration with other Odoo modules.