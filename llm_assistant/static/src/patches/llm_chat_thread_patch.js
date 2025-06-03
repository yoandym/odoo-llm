/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { LLMChatThread } from "@llm_thread/components/llm_chat_thread/llm_chat_thread";
import { LLMChatThreadHeaderWithAssistant } from "../components/llm_chat_thread_header/llm_chat_thread_header";

/**
 * Patch LLMChatThread to use our extended header component
 */
patch(LLMChatThread, {
    components: {
        ...LLMChatThread.components,
        LLMChatThreadHeader: LLMChatThreadHeaderWithAssistant,
    },
});
