/** @odoo-module **/

import { patch } from "@web/core/utils/patch";

import { LivechatButton } from "@im_livechat/embed/common/livechat_button";

/**
 * Minimal Livechat Button Extension
 * 
 * This component now focuses ONLY on essential UI concerns,
 * removing all duplicated functionality and relying on native
 * Odoo implementations whenever possible.
 */
patch(LivechatButton.prototype, {


    /**
     * Add visual feedback for LLM errors
     * 
     * @param {string} errorMessage - Error message to display
     */
    showLLMError(errorMessage) {
        this._addMessage({
            id: Date.now(),
            author_id: this.props.options.operator_pid,
            body: `<div class="o_llm_error">${errorMessage}</div>`,
            date: new Date(),
            is_discussion: true,
            is_error: true,
        });
    },

    /**
     * Clean up on unmount
     */
    onWillUnmount() {
        // Clean up any resources in LivechatService
        if (this.livechatService && this.props?.options?.channel_id) {
            this.livechatService.cleanupLLMResources(this.props.options.channel_id);
        }
        
        super.onWillUnmount?.();
    }
});