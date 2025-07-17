# Odoo Native im_livechat Architecture

This document describes the technical architecture of Odoo's native `im_livechat` module, which provides real-time chat functionality for websites. The `im_livechat` module works in conjunction with `website_livechat` to enable visitor-operator communication.

## Module Dependencies

The livechat functionality in Odoo is provided by several interconnected modules:

- **im_livechat**: Core livechat functionality and backend models
- **website_livechat**: Website integration and visitor tracking
- **mail**: Messaging infrastructure that livechat builds upon
- **discuss**: Chat interface and channel management
- **website**: Web frontend integration

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


## High-Level Architecture

```{mermaid}
graph TB
    subgraph "Frontend Layer"
        WV[Website Visitor]
        LCB[LiveChat Button]
        LCW[LiveChat Window]
        CSS[ChatbotService]
    end
    
    subgraph "Controller Layer"
        LC[LivechatController]
        LCBC[ChatbotScriptController]
    end
    
    subgraph "Model Layer"
        LCC[im_livechat.channel]
        LCCR[im_livechat.channel.rule]
        CBS[chatbot.script]
        CSS2[chatbot.script.step]
        WVS[website.visitor]
        DC[discuss.channel]
    end
    
    WV -->|Interacts With| LCB
    LCB -->|Opens| LCW
    LCW -->|Uses| CSS
    
    LCB -->|Init| LC
    CSS -->|Process Steps| LCBC
    
    LC -->|Creates/Manages| DC
    LC -->|Follows| LCCR
    LCCR -->|Belongs To| LCC
    LCCR -->|References| CBS
    CBS -->|Contains| CSS2
    LC -->|Links To| WVS
    DC -->|References| WVS
    
    classDef frontend fill:#e3f2fd,stroke:#1976d2
    classDef controller fill:#f3e5f5,stroke:#7b1fa2
    classDef model fill:#e8f5e9,stroke:#388e3c
    
    class WV,LCB,LCW,CSS frontend
    class LC,LCBC controller
    class LCC,LCCR,CBS,CSS2,WVS,DC model
```

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

## Relevant Sequences

### 1. Initialization Sequence

```
1. Visitor loads website page
2. LivechatService.initialize() calls /im_livechat/init
3. Server checks matching livechat channel rules
4. Returns channel configuration and availability if a rule matches
5. Frontend creates LivechatButton component based on settings
6. User clicks chat button which calls ThreadService.openChat()
7. ThreadService.openChat() calls LivechatService.getOrCreateThread()
8. LivechatService calls /im_livechat/get_session to create a discuss.channel
9. ChatBotService.start() runs to begin the chatbot flow
10. ChatBotService.postWelcomeSteps() calls /chatbot/post_welcome_steps
11. ChatBotService._triggerNextStep() begins the conversation
```

```{mermaid}
:zoom:
sequenceDiagram
    participant Visitor
    participant LivechatButton
    participant ThreadService
    participant LivechatService
    participant ChatBotService
    participant Server
    participant DiscussChannel
    
    Visitor->>LivechatButton: Load page with widget
    LivechatButton->>LivechatService: initialize()
    LivechatService->>Server: rpc("/im_livechat/init", {channel_id})
    Server->>Server: Check im_livechat.channel.rule entries
    Server-->>LivechatService: {available: true, rule: {...}}
    LivechatService->>LivechatButton: Display button (available=true)
    
    Visitor->>LivechatButton: Click chat button
    LivechatButton->>ThreadService: onClick() → openChat()
    ThreadService->>LivechatService: getOrCreateThread({persist: false})
    
    alt No existing thread
        LivechatService->>Server: rpc("/im_livechat/get_session", {channel_id, anonymous_name})
        Server->>DiscussChannel: create()
        Server-->>LivechatService: {channel: {id, uuid, operator_pid, ...}}
        LivechatService->>LivechatService: updateSession(threadData)
        LivechatService->>LivechatService: store.Thread.insert({...})
    end
    
    ThreadService->>ChatBotService: start()
    
    alt Has chatbot script
        ChatBotService->>ChatBotService: postWelcomeSteps()
        ChatBotService->>Server: rpc("/chatbot/post_welcome_steps", {channel_uuid, chatbot_script_id})
        Server->>DiscussChannel: _post_welcome_steps()
        Server-->>ChatBotService: [{message_1}, {message_2}, ...]
        ChatBotService->>ChatBotService: _triggerNextStep()
        ChatBotService->>Server: rpc("/chatbot/step/trigger", {channel_uuid})
        Server-->>ChatBotService: {chatbot_posted_message, chatbot_step}
    end
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


## Security

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
