# LLM CRM Lead Creation

This module adds a tool for LLM assistants to create CRM leads when handover to a human operator isn't possible or practical.

## Features

- Allows LLM assistants to create CRM leads directly from conversations
- Includes conversation context in the lead description
- Supports both leads and opportunities
- Configurable priority levels and sales team assignment

## Usage

This tool is designed to be used by LLM assistants when:

1. No operators are available for handover
2. The conversation has clear commercial context
3. The user expresses interest in products/services
4. Creating a lead would better serve the user than waiting for an operator

## Tool Parameters

- `name`: Title/subject of the lead
- `contact_name`: Name of the contact person
- `email`: Email address of the contact (optional)
- `phone`: Phone number of the contact (optional)
- `description`: Detailed description of the lead/opportunity
- `priority`: Priority level (0=Low, 1=Medium, 2=High, 3=Very High)
- `team_id`: ID of the sales team to assign (optional)
- `type`: Type of record to create (opportunity or lead)
- `thread_id`: ID of the llm.thread creating this lead (optional)

## Example Assistant Prompts

When offering to create a lead:

```
I understand you're interested in our [product/service]. Since all our sales representatives are currently unavailable, I'd be happy to create a lead in our system so someone can follow up with you. Could you please provide your name and preferred contact method (email or phone)?
```

When confirming lead creation:

```
Thank you for providing your information. I've created a lead in our CRM system, and one of our sales representatives will contact you soon to discuss [specific topic]. Is there anything else I can help you with today?
```

## Integration with Website Assistants

When using this module alongside `llm_website_assistant`, the LLM can offer lead creation as an alternative when handover to a human operator isn't possible. This ensures that commercial opportunities aren't lost even when operators are offline or unavailable.
