/* @odoo-module */

import { ChatBotService, STEP_DELAY } from "@im_livechat/embed/common/chatbot/chatbot_service";
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

    setup(env, services) {
        super.setup(env, services);

        this._onStreamingStart = this._handleStreamingStart.bind(this);
        this._onStreamingStop = this._handleStreamingStop.bind(this);
        this._onFlowAction = this._handleFlowAction.bind(this);

        // streaming
        this.livechatService.busService.addEventListener('streaming_start', this._onStreamingStart);
        this.livechatService.busService.addEventListener('streaming_stop', this._onStreamingStop);
        
        // flow change
        this.livechatService.busService.addEventListener('flow_action', this._onFlowAction);

    },
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

        if (this.currentStep.isLlmStep && !this.livechatService.thread.llm_mute) {
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
     * Handle LLM processing errors
     * 
     * @private
     */
    _handleLLMError() {
        const errorMessage = _t("I'm sorry, I encountered an issue. Let me connect you with a human operator.");

        // setting expectAnswer to false will allow _getNextStep to ask the backend what's the next step
        // lets hope the backend can provide a meaningful response .. like forwarding to an operator
        this.currentStep.expectAnswer = false;

        // Trigger the forward to operator step
        setTimeout(() => {
            this._triggerNextStep();
        }, STEP_DELAY);
    },



    _handleStreamingStart(ev) {
        if (ev?.detail?.threadId === this.livechatService.thread?.id) {
            this.isTyping = true;
        }
    },

    /**
     * Handle flow action events from the backend
     * 
     * @private
     * @param {CustomEvent} ev - The flow action event
     */
    _handleFlowAction(ev) {
        const eventData = ev?.detail;
        if (!eventData) {
            console.warn("[LLM Chatbot] Received flow action event without data");
            return;
        }

        // Only process events for the current thread
        if (eventData.thread_id !== this.livechatService.thread?.id) {
            console.debug("[LLM Chatbot] Ignoring flow action for different thread", {
                eventThreadId: eventData.thread_id,
                currentThreadId: this.livechatService.thread?.id
            });
            return;
        }

        console.log("[LLM Chatbot] Received flow action:", eventData);

        const action = eventData.flow_action;
        switch(action) {
            case 'forward_to_operator':
                // setting expectAnswer to false will allow _getNextStep to ask the backed what's the next step
                // at this point the chatbot current step is a forward_operator step
                this.currentStep.expectAnswer = false;

                // let the operator handle the conversation.
                this.livechatService.muteAssistant(eventData.thread_id, true);
                break;
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
            }, STEP_DELAY);
        }
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
    },


    destroy() {
        this.livechatService.busService.removeEventListener('streaming_start', this._onStreamingStart);
        this.livechatService.busService.removeEventListener('streaming_stop', this._onStreamingStop);
        this.livechatService.busService.removeEventListener('flow_action', this._onFlowAction);
        super.destroy?.();
    }

});
