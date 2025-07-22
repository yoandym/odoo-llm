/* @odoo-module */

import { ChatbotStep } from "@im_livechat/embed/common/chatbot/chatbot_step_model";
import { patch } from "@web/core/utils/patch";

// Save original expectAnswer getter
const originalExpectAnswerGetter = Object.getOwnPropertyDescriptor(ChatbotStep.prototype, "expectAnswer").get;

/**
 * Patch the ChatbotStep to handle LLM-enabled steps
 */
patch(ChatbotStep.prototype, {
    /**
     * Override the expectAnswer getter to include LLM steps
     */
    get expectAnswer() {
        const super_expectAnswer = originalExpectAnswerGetter.call(this);
        return super_expectAnswer || this.isLlmStep;
    },

    get isLlmStep() {
        // Check if this step is an LLM step
        return this.type === 'llm_processed_input';
    }
});

