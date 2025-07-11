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

#### im_livechat.channel
The main configuration model for livechat channels:
- Defines livechat channel properties (name, button text, colors)
- Manages operator assignments
- Controls channel availability rules

#### im_livechat.channel.rule
Defines when and where livechat appears:
- URL regex patterns for page targeting
- Display modes (show, auto-popup, hide)
- Country-based restrictions
- Chatbot script assignment

#### discuss.channel
The actual conversation channel:
- Inherits from mail.thread for messaging capabilities
- Stores chat history
- Manages participant information
- Links to visitors via `livechat_visitor_id`

#### website.visitor
Tracks website visitors:
- Anonymous visitor identification
- Page visit history
- Geographic information
- Livechat interaction history

#### chatbot.script
Defines automated conversation flows:
- Step-based conversation structure
- Multiple step types (text, question, email, phone, etc.)
- Conditional branching logic
- Operator handover capabilities

#### chatbot.script.step
Individual conversation steps:
- Message content and type
- Answer options for questions
- Validation rules
- Next step logic

### 2. Controllers

#### LivechatController (`/im_livechat/*`)
Main controller handling:
- `/init`: Channel initialization and rule matching
- `/visitor_leave_session`: Visitor departure handling
- `/feedback`: Chat satisfaction ratings
- `/history`: Chat transcript requests

#### LivechatChatbotScriptController (`/chatbot/*`)
Handles chatbot interactions:
- `/step/trigger`: Process user responses
- `/step/validate_email`: Email validation
- `/step/validate_phone`: Phone validation
- Message posting and step progression

### 3. Frontend Architecture

#### JavaScript Services
- **LivechatService**: Core service managing chat state
- **ChatbotService**: Handles automated conversations
- **MessagingService**: Underlying messaging infrastructure

#### Components
- **LivechatButton**: Floating chat button widget
- **LivechatWindow**: Chat conversation interface
- **ChatbotMessages**: Renders bot messages and options

## Data Flow

### 1. Initialization Sequence

```
1. Visitor loads website page
2. LivechatService calls /im_livechat/init
3. Server checks matching rules (URL, country, etc.)
4. Returns channel configuration if rule matches
5. Frontend displays chat button based on settings
6. Creates discuss.channel when chat starts
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