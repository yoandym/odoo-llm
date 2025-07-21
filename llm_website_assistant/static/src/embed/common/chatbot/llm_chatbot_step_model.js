/* @odoo-module */

import { ChatbotStep } from "@im_livechat/embed/common/chatbot/chatbot_step_model";
import { patch } from "@web/core/utils/patch";

/**
 * Patch the ChatbotStep to handle LLM-enabled steps
 */
patch(ChatbotStep.prototype, {
    /**
     * Override the expectAnswer getter to include LLM steps
     */
    get expectAnswer() {
        super_expectAnswer = this._super();
        return super_expectAnswer || this.isLlmStep;
    },
});

/**
 * Also patch the static parse method
 */
patch(ChatbotStep, {
    /**
     * @override
     */
    parse(data) {
        const step = this._super(...arguments);

        // Add LLM-specific properties
        step.isLlmStep = data.isLlmStep || data.type === 'llm_processed_input';

        return step;
    },
});
