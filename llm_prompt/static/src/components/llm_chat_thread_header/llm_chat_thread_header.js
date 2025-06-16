/** @odoo-module **/

import { LLMChatThreadHeader } from "@llm_thread/components/llm_chat_thread_header/llm_chat_thread_header";
import { patch } from "@web/core/utils/patch";

// Note: With the new assistant-centric workflow, prompts are no longer 
// selectable through the UI. Prompts are only applied through assistant
// configuration. This file is maintained for compatibility but no longer
// extends the chat header functionality for prompt selection.

patch(LLMChatThreadHeader.prototype, {
  // No additional functionality needed - prompts are handled by assistants
});
