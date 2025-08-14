/* @odoo-module */

import { ChatBotService } from "@im_livechat/embed/common/chatbot/chatbot_service";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";

/**
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
        // If we're already streaming, just stay on the current step
        if (this.isTyping) {
            return;
        }
        
        try {
            this.currentStep.hasAnswer = true;

            // We don't need to post the message as it's already posted by the composer
            // Just trigger the LLM response generation based on the message ID
            const messageId = message.id;
            await this.livechatService.triggerLLMResponseForMessage(this.livechatService.thread.id, messageId);

            
        } catch (error) {
            console.error("[LLM Chatbot] Error processing answer:", error);
            this._handleLLMError();
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

    setup(env, services) {
        super.setup(env, services);
        
        this._onStreamingStart = this._onStreamingStart?.bind(this) || ((ev) => this._handleStreamingStart(ev));
        this._onStreamingStop = this._onStreamingStop?.bind(this) || ((ev) => this._handleStreamingStop(ev));
        this.livechatService.busService.addEventListener('streaming_start', this._onStreamingStart);
        this.livechatService.busService.addEventListener('streaming_stop', this._onStreamingStop);
    },

    _handleStreamingStart(ev) {
        if (ev?.detail?.threadId === this.livechatService.thread?.id) {
            this.isTyping = true;
        }
    },

    /**
     * Handle when streaming stops - complete the LLM response processing
     * 
     * @private
     * @param {CustomEvent} ev - The streaming stop event
     */
    async _handleStreamingStop(ev) {
        if (ev?.detail?.threadId === this.livechatService.thread?.id) {
            // Set a small timeout to ensure message state is stable before continuing flow
            setTimeout(() => {
                this.isTyping = false;
                                
                // Continue flow
                this._triggerNextStep();
            }, this.stepDelay);
        }
    },

    destroy() {
        this.livechatService.busService.removeEventListener('streaming_start', this._onStreamingStart);
        this.livechatService.busService.removeEventListener('streaming_stop', this._onStreamingStop);
        super.destroy?.();
    },

    get inputDisabledText() {
        if (this.currentStep?.isLlmStep && this.isTyping) {
            return _t("AI is generating response...");
        }

        return super.inputDisabledText;
    },

    /**
     * @param {import("models").Thread} thread
     */
    isChatbotThread(thread) {
        const operator_is_bot = thread?.operator?.id === this.chatbot?.partnerId;
        const llm_enabled = thread?.assistant?.llm_enabled;
        return operator_is_bot || llm_enabled;
    }

});
