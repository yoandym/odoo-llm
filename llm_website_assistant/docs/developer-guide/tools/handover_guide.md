# LLM Website Assistant Handover Guide

## Introduction

The LLM Website Assistant module integrates Odoo's LLM capabilities with the website livechat functionality. One of the key features is the ability to handle handovers from the AI assistant to human operators, either via direct chat handover or via phone callback.

## Handover Options

### Chat Handover

The chat handover feature allows the LLM assistant to transfer the conversation to a human operator when:
- The user explicitly requests to speak with a human
- The conversation becomes too complex for the AI to handle
- Sensitive topics are discussed that require human attention
- The AI detects frustration or dissatisfaction from the user

When a chat handover occurs, the system will:
1. Look for an available operator according to the livechat channel configuration
2. Transfer the full conversation history to the operator
3. Notify the user that they are being connected to a human agent

### Phone Handover

The phone handover feature provides an alternative option when:
- The user prefers to speak by phone rather than chat
- The issue might be better resolved through a voice conversation
- The user needs to step away from the computer but still wants help
- Extended support beyond chat hours is needed (callback during business hours)

When a phone handover occurs, the system will:
1. Collect the user's phone number and callback details
2. Create a high-priority activity for an operator to call back
3. Confirm to the user that a callback has been scheduled
4. Provide an estimated timeframe for the callback

## Tools for Developers

### livechat_handover Tool

```python
def livechat_handover_execute(
    self,
    reason: str = "",
    thread_id: Optional[int] = None,
    urgent: bool = False,
):
    """
    Handover a livechat conversation to a human operator.
    
    Parameters:
        reason: The reason for the handover, to be shown to the human operator
        thread_id: ID of the thread requesting handover
        urgent: Whether this handover should be treated as urgent
        
    Returns:
        Dict with handover status and message
    """
```

### phone_handover Tool

```python
def phone_handover_execute(
    self,
    customer_name: str,
    phone_number: str,
    topic: str,
    notes: str = "",
    thread_id: Optional[int] = None,
):
    """
    Create a phone callback request for a customer
    
    Parameters:
        customer_name: Name of the customer requesting callback
        phone_number: Phone number where customer can be reached
        topic: Brief description of the topic or issue
        notes: Additional context about the customer's situation
        thread_id: ID of the LLM thread
        
    Returns:
        Dict with callback request status and message
    """
```

## Implementation

When configuring an LLM assistant for website chat, ensure that both handover tools are enabled. The assistant should be instructed to:

1. Offer both handover options when appropriate
2. Collect necessary information before initiating handover
3. Explain what the user can expect after handover
4. Confirm the handover has been scheduled

## Example Prompts for LLM Assistant

For offering handover options:

```
I see that you're having trouble with [issue]. I'd be happy to connect you with one of our human operators who can help you further. Would you prefer:

1. Continue this chat with a human operator right now, or
2. Have someone call you back at a phone number you provide?
```

For chat handover:

```
I'll connect you with a human operator right away. They'll have access to our conversation history, so you won't need to repeat yourself. Please hold while I transfer you.
```

For phone handover:

```
I'd be happy to arrange a callback. Could you please provide:
1. Your name
2. Your phone number
3. A brief description of what you need help with

Once you provide this information, I'll schedule a callback from one of our representatives.
```
