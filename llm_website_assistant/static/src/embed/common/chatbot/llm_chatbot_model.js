/* @odoo-module */

import { Chatbot } from "@im_livechat/embed/common/chatbot/chatbot_model";
import { patch } from "@web/core/utils/patch";

// Save original parse method
const originalParse = Chatbot.parse;

/**
 * Patch the Chatbot model to handle LLM-specific properties
 */
patch(Chatbot, {
    /**
     * @override
     */
    parse(data) {
        const chatbot = originalParse.call(this, ...arguments);
        // Add LLM-specific properties
        chatbot.isLlmEnabled = data.isLlmEnabled || false;
        chatbot.llmAssistantId = data.llmAssistantId || false;
        chatbot.llmAssistantName = data.llmAssistantName || '';
        return chatbot;
    },
});
