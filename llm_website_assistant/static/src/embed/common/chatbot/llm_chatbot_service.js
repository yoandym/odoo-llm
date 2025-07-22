/* @odoo-module */

import { ChatBotService } from "@im_livechat/embed/common/chatbot/chatbot_service";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";

/**
 * Refactored LLM Chatbot Service
 * 
 * This service focuses ONLY on chatbot script flow:
 * - Detecting and marking LLM steps
 * - Processing LLM step answers
 * - Managing step transitions
 * 
 * All network/streaming/thread management is delegated to livechatService
 */
patch(ChatBotService.prototype, {


    /**
     * Process user answer for LLM steps
     * 
     * @override
     * @param {Object} message - The user message
     */
    async _processUserAnswer(message) {
        if (!this.active || 
            message.originThread.localId !== this.livechatService.thread?.localId ||
            !this.currentStep?.expectAnswer) {
            return;
        }

        if (this.currentStep.isLlmStep) {
            await this._llmProcessUserAnswer(message);
        } else {
            await super._processUserAnswer(message);
        }
    },

    /**
     * Process answer for LLM step
     * 
     * @private
     * @param {Object} message - The user message
     */
    async _llmProcessUserAnswer(message) {
        // TODO: if we are already streming, just return the same step
        
        
        try {
            this.isTyping = true;
            this.currentStep.hasAnswer = true;

            // call LiveChatService.sendMessage to handle LLM processing
            // This will trigger the LLM response generation/streaming
            const result = await this.livechatService.sendMessage({
                threadId: this.livechatService.thread.id,
                messageContent: message.body,

            });

            // TODO: if we are result succed and we are streaming, just return the same step
            // TODO: else let the normal flow be -> `_triggerNextStep()` -> `_getNextStep()` -> ...

            this.save();
            
        } catch (error) {
            console.error("[LLM Chatbot] Error processing answer:", error);
            this._handleLLMError();
        } finally {
            this.isTyping = false;
        }
    },

    /**
     * Handle flow actions from LLM responses
     * 
     * @private
     * @param {string} action - The flow action
     * @param {Object} params - Action parameters
     */
    async _handleFlowAction(action, params) {
        console.log("[LLM Chatbot] Handling flow action:", action);
        
        switch (action) {
            case 'forward_to_operator':
                const operatorStep = this._findStepByType('forward_operator');
                if (operatorStep) {
                    this.currentStep = operatorStep;
                }
                break;
                
            case 'phone_callback':
                // Stay on current step, callback handled by backend
                break;
                
            case 'create_ticket':
                // Stay on current step, ticket handled by backend
                break;
                
            default:
                console.warn("[LLM Chatbot] Unknown flow action:", action);
        }
    },

    /**
     * Find a step by type in the script
     * 
     * @private
     * @param {string} stepType - The step type to find
     * @returns {Object|null} The found step
     */
    _findStepByType(stepType) {
        return this.chatbot.scriptSteps?.find(step => step.type === stepType) || null;
    },

    /**
     * Handle LLM processing errors
     * 
     * @private
     */
    _handleLLMError() {
        const errorMessage = _t("I'm sorry, I encountered an issue. Let me connect you with a human operator.");
        
        // Try to forward to operator
        const operatorStep = this._findStepByType('forward_operator');
        if (operatorStep) {
            operatorStep.message = errorMessage;
            this.currentStep = operatorStep;
        } else {
            // Create a temporary error step
            this.currentStep = {
                type: 'text',
                message: errorMessage,
                isLast: true
            };
        }
    },

});
