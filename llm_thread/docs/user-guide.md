# User Guide for Easy AI Chat

## Overview

Easy AI Chat brings the power of artificial intelligence directly into your Odoo workflow. Whether you need customer support automation, data analysis assistance, or intelligent document processing, this module provides a seamless interface for AI-powered conversations.

## Getting Started

### First Steps

1. After installation, navigate to **Discuss > AI Chats** in the main menu
2. You'll see the AI Chat interface with a list of existing threads (if any)
3. To start a new conversation, click the **New Thread** button

### Basic Concepts

Before diving in, understand these key concepts:

- **Thread**: A conversation container that maintains context across messages
- **Provider**: The AI service (OpenAI, Anthropic, etc.) that powers responses
- **Model**: The specific AI model used for generating responses
- **Tools**: Functions the AI can call to perform actions in Odoo
- **Context**: Linking threads to Odoo records for relevant information

## Features

### Creating and Managing Threads

Create focused conversations for different purposes:

**How to create a thread:**

1. Navigate to **Discuss > AI Chats**
2. Click **New Thread**
3. Fill in the required fields:
   - **Title**: Descriptive name for the conversation
   - **Provider**: Select your AI provider
   - **Model**: Choose the AI model (filtered by provider)
   - **Available Tools**: Select tools the AI can use
4. Click **Save** to create the thread

**Example:**
```
Title: "Customer Support Assistant"
Provider: OpenAI
Model: GPT-4
Tools: [Search Customers, Create Tickets, Check Orders]
```

### Sending Messages

Interact with AI through natural conversation:

**How to send a message:**

1. Open a thread from the list
2. Type your message in the composer at the bottom
3. Press Enter or click Send
4. Watch as the AI response streams in real-time

**Tips:**
- Be specific in your requests for better responses
- Use @mentions to reference Odoo records
- Attach files for multimodal models to analyze

### Tool Integration

Enable AI to perform actions in Odoo:

**Available tool types:**
- **Search Tools**: Find records in Odoo
- **Create Tools**: Generate new records
- **Update Tools**: Modify existing data
- **Calculation Tools**: Perform complex computations
- **Integration Tools**: Connect with external services

**How to use tools:**

1. Ensure tools are activated in the thread configuration
2. Ask the AI to perform tool-supported actions
3. The AI will automatically call appropriate tools
4. Review tool results in the conversation

**Example conversation:**
```
User: "Find all customers from Spain with unpaid invoices"
AI: [Calls search_customers tool with country=Spain, invoice_status=unpaid]
AI: "I found 15 customers from Spain with unpaid invoices. Here are the details..."
```

### Contextual Conversations

Link threads to Odoo records for context-aware assistance:

**How to link to a record:**

1. Open any Odoo record (Sales Order, Invoice, etc.)
2. Find the AI Chat widget in the form view
3. Click **Start AI Conversation**
4. The thread automatically links to the current record

**Benefits:**
- AI has access to record data
- Responses are tailored to the specific context
- No need to manually provide record details

### Message Voting

Help improve AI responses by rating them:

**How to vote:**
1. Hover over any AI message
2. Click the thumbs up/down icon
3. Your vote is recorded for quality tracking

### Streaming Responses

Experience real-time AI generation:

- **Visual Indicator**: Animated dots show AI is thinking
- **Partial Responses**: See text as it's generated
- **Cancellation**: Close the tab to stop generation

## Common Use Cases

### Customer Support Automation

**Scenario**: Handle customer inquiries efficiently

**Solution**:
1. Create a thread named "Customer Support"
2. Enable customer search and ticket creation tools
3. When a customer inquiry comes in:
   - Paste the customer's question
   - AI analyzes and suggests responses
   - Optionally create support tickets
4. Copy AI suggestions to respond to customers

### Data Analysis Assistant

**Scenario**: Analyze sales trends and patterns

**Solution**:
1. Create a thread linked to sales reports
2. Enable analytical tools
3. Ask questions like:
   - "What are our top-selling products this month?"
   - "Which regions show declining sales?"
   - "Predict next quarter's revenue"
4. Receive insights with supporting data

### Document Processing

**Scenario**: Extract information from uploaded documents

**Solution**:
1. Create a thread with multimodal model
2. Upload documents (PDFs, images, etc.)
3. Ask AI to:
   - Extract key information
   - Summarize content
   - Create Odoo records from data
4. Review and confirm extracted data

## User Interface Guide

### Main Chat View

The primary interface consists of:

- **Thread List** (Left panel):
  - Search threads by name
  - Filter by active/archived
  - Quick access to recent threads
  
- **Conversation Area** (Center):
  - Message history with timestamps
  - User and AI messages clearly distinguished
  - Tool call results displayed inline
  
- **Thread Info** (Right panel):
  - Current model and provider
  - Linked record information
  - Available tools list
  - Thread settings

### Chat Composer

Located at the bottom of the conversation:
- **Text Input**: Type or paste messages
- **Attachment Button**: Upload files (for multimodal models)
- **Send Button**: Submit message (or press Enter)
- **Tool Indicator**: Shows when tools are available

### Menu Structure

```
Discuss
├── AI Chats
│   ├── All Threads
│   ├── My Threads
│   └── Archived Threads
└── Settings
    └── AI Configuration
        ├── Providers
        ├── Models
        └── Tools
```

## Workflows

### Standard Conversation Flow

```{mermaid}
graph LR
    A[User Message] --> B[AI Processing]
    B --> C{Tools Needed?}
    C -->|Yes| D[Execute Tools]
    C -->|No| E[Generate Response]
    D --> E
    E --> F[Stream Response]
    F --> G[User Reads]
    G --> A
```

### Tool Execution Flow

```{mermaid}
graph TD
    A[AI Identifies Need] --> B[Select Tool]
    B --> C[Prepare Arguments]
    C --> D[Execute Tool]
    D --> E{Success?}
    E -->|Yes| F[Process Results]
    E -->|No| G[Handle Error]
    F --> H[Include in Response]
    G --> H
```

## Best Practices

1. **Clear Communication**: Be specific in your requests to get accurate responses
2. **Tool Selection**: Only enable tools relevant to the thread's purpose
3. **Context Usage**: Link threads to records when working with specific data
4. **Thread Organization**: Use descriptive names and archive old threads
5. **Security**: Don't share sensitive information in threads accessible to others

## Permissions and Access Rights

### User Roles

- **AI Chat User**: Can create and use personal threads
- **AI Chat Manager**: Can manage all threads and configure settings
- **Administrator**: Full access to configuration and all threads

### Security Groups

- **Use AI Chat**: Basic access to create and use threads
- **Manage AI Chat**: Administrative access to all features
- **Configure AI Providers**: Access to provider and model settings

## FAQ

**Q: Why is my thread locked?**
A: The thread is currently generating a response. Wait for it to complete before sending another message.

**Q: Can I use multiple AI providers?**
A: Yes, but each thread uses a single provider. Create different threads for different providers.

**Q: How do I stop a long response?**
A: Close the browser tab or navigate away. The thread will unlock automatically.

**Q: Are conversations private?**
A: Threads are visible based on Odoo's standard security rules. Personal threads are private by default.

**Q: Can I export conversation history?**
A: Yes, use Odoo's standard export features on the thread list view.

## Tips and Tricks

- **Keyboard Shortcuts**: 
  - `Ctrl/Cmd + Enter`: Send message
  - `Esc`: Clear composer
  - `Up Arrow`: Edit last message (if supported)

- **Quick Templates**: Save common prompts as message templates

- **Bulk Operations**: Archive multiple old threads at once from list view

- **Search**: Use Odoo's advanced search to find threads by content

## Troubleshooting

### Common Issues

**Problem**: "Thread is locked" error
- **Cause**: Previous generation still in progress
- **Solution**: Wait a moment and try again, or refresh the page

**Problem**: No response from AI
- **Cause**: API key issues or model unavailable
- **Solution**: Check provider configuration and API key validity

**Problem**: Tools not working
- **Cause**: Insufficient permissions or tool not activated
- **Solution**: Verify user permissions and thread tool configuration
