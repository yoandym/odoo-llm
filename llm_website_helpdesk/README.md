# LLM Website Helpdesk

This module integrates LLM Website Assistant with the Solt Helpdesk system to enable creating helpdesk tickets directly from livechat conversations.

## Features

- Provides an LLM tool to create support tickets from livechat
- Automatically links tickets to the website visitor and chat session
- Preserves context from the conversation in the ticket description
- Enables seamless handoff from chatbot to support team

## Usage

When a visitor interacts with the website assistant chatbot and their issue requires further attention, the system can create a support ticket with all the relevant information automatically.

## Technical Information

This module extends:

- `support.issue` model to add fields for linking to website visitors and chat sessions
- Creates a new `llm.tool.helpdesk` model to provide ticket creation capabilities

## Configuration

No specific configuration is needed. The module automatically registers the ticket creation tool with the website assistant profile.

## Dependencies

- solt_helpdesk
- llm_website_assistant
- llm
