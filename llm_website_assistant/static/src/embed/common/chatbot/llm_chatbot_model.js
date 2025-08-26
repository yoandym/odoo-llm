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
        chatbot.assistant_id = data.assistant_id || false;
        chatbot.assistant_name = data.assistant_name || '';
        
        // Infer LLM capabilities from the presence of an assistant
        chatbot.llm_enabled = Boolean(chatbot.assistant_id);

        return chatbot;
    },
});
