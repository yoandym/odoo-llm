# LLM Website Assistant

Integrate LLM assistants with the Odoo live chat system on your website.

## Overview

This module bridges the LLM assistant capabilities with the standard Odoo live chat system, allowing website visitors to interact with your AI assistants directly through the website chat widget.

## Features

- Use LLM assistants as enhanced chatbots in website live chat
- Configure specific LLM assistants for different website pages or visitor countries
- Control which knowledge collections can be accessed by website visitors
- Automatic handover to human operators when needed
- Support for fallback mechanisms when no operators are available

## Configuration

### Setting up an LLM Website Assistant

1. Go to **Website → Live Chat → Channels**
2. Select or create a live chat channel
3. In the **Rules** tab, create a new rule or edit an existing one
4. Set the **Assistant Type** to **LLM Assistant**
5. Select the LLM assistant you want to use for this rule

### Configuring the LLM Assistant for Website Use

1. Go to **LLM → Assistants**
2. Select or create an assistant
3. Enable the **Available on Website** option
4. Configure the assistant with appropriate knowledge collections and tools

## Technical Implementation

The module extends the standard livechat system in the following ways:

1. Adds a new assistant type "LLM Assistant" to livechat channel rules
2. Creates a dynamic chatbot script when an LLM assistant is used in a livechat rule
3. Integrates with the LLM thread system to maintain conversation history
4. Extends the frontend chatbot to handle LLM-powered responses
5. Provides fallback mechanisms for error handling and operator handovers

## Dependencies

- im_livechat
- website_livechat
- llm_assistant
- llm_knowledge
- llm_thread

## Security Considerations

- Ensure that sensitive knowledge collections are not made available to public assistants
- Review the assistant's access to system tools before making it public
- Consider implementing conversation limits or throttling for public assistants
