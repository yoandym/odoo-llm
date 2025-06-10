/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { Chatter } from "@mail/core/web/chatter";
import { useState, Component, useRef } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { LLMChatThread } from "../llm_chat_thread/llm_chat_thread";

/**
 * Patch the Chatter component to add LLM chat integration
 * 
 * This allows users to switch between normal chatter and AI chat
 * directly from the form view chatter using template-based approach.
 */
patch(Chatter.prototype, {
    /**
     * @override
     */
    setup() {
        super.setup();

        // Services
        this.llmChatService = useService("llm_chat");
        this.notificationService = useService("notification");
        this.actionService = useService("action");
        this.userService = useService("user");

        // Extend state with LLM chat properties
        Object.assign(this.state, {
            isChattingWithLLM: false,
            llmThread: null,
            isInitializingLLM: false,
        });
    },



    /**
     * Toggle between normal chatter and LLM chat mode
     */
    async toggleLLMChat() {
        console.log("[LLM] Toggle LLM chat called");

        // Get thread information from various sources
        const threadInfo = this.getThreadInfo();

        if (!threadInfo.model || !threadInfo.id) {
            console.warn("[LLM] No valid thread information available");
            this.notificationService.add(
                _t("Unable to start AI chat - no record context found"),
                {
                    title: _t("Error"),
                    type: "warning",
                }
            );
            return;
        }

        if (this.state.isChattingWithLLM) {
            this.exitLLMMode();
        } else {
            await this.enterLLMMode(threadInfo);
        }
    },

    /**
     * Get thread information from various sources
     */
    getThreadInfo() {
        // Try multiple ways to get thread information from Chatter
        const thread = this.thread || this.props.thread || this.state?.thread;
        console.log("[LLM] Thread found:", thread);

        // If no thread from component, try to get it from props
        let threadModel = thread?.model || this.props?.threadModel;
        let threadId = thread?.id || this.props?.threadId;

        // Try to get from action context if still not found
        if (!threadModel || !threadId) {
            const action = this.actionService.currentController?.action;
            console.log("[LLM] Current action:", action);

            if (action?.res_model && action?.res_id) {
                threadModel = action.res_model;
                threadId = action.res_id;
                console.log("[LLM] Got from action - Model:", threadModel, "ID:", threadId);
            }
        }

        // Try to get from URL or environment
        if (!threadModel || !threadId) {
            // Try to get from browser URL
            const urlParams = new URLSearchParams(window.location.search);
            const urlModel = urlParams.get('model');
            const urlId = urlParams.get('id');

            if (urlModel && urlId) {
                threadModel = urlModel;
                threadId = parseInt(urlId);
                console.log("[LLM] Got from URL - Model:", threadModel, "ID:", threadId);
            }
        }

        console.log("[LLM] Final thread model:", threadModel, "Thread ID:", threadId);

        return {
            model: threadModel,
            id: threadId,
            ...thread
        };
    },

    /**
     * Enter LLM chat mode
     */
    async enterLLMMode(thread) {
        console.log("[LLM] Entering LLM mode with thread:", thread);

        if (this.state.isInitializingLLM) return;

        this.state.isInitializingLLM = true;

        try {
            const llmChat = this.llmChatService;

            // Ensure thread for the current record
            const llmThread = await llmChat.ensureThread({
                relatedThreadModel: thread.model,
                relatedThreadId: thread.id,
            });

            if (!llmThread) {
                throw new Error("Failed to create AI chat thread");
            }

            console.log("[LLM] LLM thread created/found:", llmThread);

            // Select the thread
            await llmChat.selectThread(llmThread.id);

            // Update state - this will trigger template re-render
            this.state.llmThread = llmThread;
            this.state.isChattingWithLLM = true;

            console.log("[LLM] Successfully entered LLM mode");

        } catch (error) {
            console.error("[LLM] Failed to initialize LLM chat:", error);
            this.notificationService.add(
                _t("Failed to start AI chat: ") + error.message,
                {
                    title: _t("Error"),
                    type: "danger",
                }
            );
            this.state.isChattingWithLLM = false;
            this.state.llmThread = null;
        } finally {
            this.state.isInitializingLLM = false;
        }
    },

    /**
     * Exit LLM chat mode
     */
    exitLLMMode() {
        console.log("[LLM] Exiting LLM mode...");

        // Reset state - this will trigger template re-render
        this.state.isChattingWithLLM = false;
        this.state.llmThread = null;
        this.state.isInitializingLLM = false;
    },

    /**
     * Send LLM message using the chat service
     * This is called from the LLMChatThread component
     */
    async sendLLMMessage(message) {
        console.log("[LLM] Sending message:", message);

        if (!this.state.llmThread) {
            console.error("[LLM] No LLM thread available");
            this.notificationService.add(
                _t("No AI chat session available"),
                {
                    title: _t("Error"),
                    type: "warning",
                }
            );
            return;
        }

        try {
            const llmChat = this.llmChatService;

            // Send the message using the chat service
            await llmChat.sendMessage(this.state.llmThread.id, message);

            console.log("[LLM] Message sent successfully");

        } catch (error) {
            console.error("[LLM] Failed to send message:", error);
            this.notificationService.add(
                _t("Failed to send message: ") + error.message,
                {
                    title: _t("Error"),
                    type: "danger",
                }
            );
        }
    },

    /**
     * Override click handlers to exit LLM mode when using normal chatter features
     */
    onClickSendMessage(ev) {
        if (this.state.isChattingWithLLM) {
            this.toggleLLMChat();
        }
        super.onClickSendMessage(ev);
    },

    onClickLogNote(ev) {
        if (this.state.isChattingWithLLM) {
            this.toggleLLMChat();
        }
        super.onClickLogNote(ev);
    },

    onClickScheduleActivity(ev) {
        if (this.state.isChattingWithLLM) {
            this.toggleLLMChat();
        }
        super.onClickScheduleActivity(ev);
    },

    onClickAttachFiles(ev) {
        if (this.state.isChattingWithLLM) {
            this.toggleLLMChat();
        }
        super.onClickAttachFiles(ev);
    },
});

// Add LLMChatThread to Chatter's components
patch(Chatter, {
    components: {
        ...Chatter.components,
        LLMChatThread,
    },
});

/**
 * Alternative: Standalone Chatter Button Component
 * 
 * This can be used to add an AI chat button to any view
 */
export class ChatterLLMButton extends Component {
    static template = "llm_thread.ChatterLLMButton";
    static props = {
        record: { type: Object },
        className: { type: String, optional: true },
    };

    setup() {
        this.llmChatService = useService("llm_chat");
        this.actionService = useService("action");

        this.state = useState({
            isOpening: false,
        });
    }

    /**
     * Open LLM chat for the current record
     */
    async openLLMChat() {
        if (this.state.isOpening) return;

        this.state.isOpening = true;

        try {
            const llmChat = this.llmChatService;

            // Ensure thread exists
            const thread = await llmChat.ensureThread({
                relatedThreadModel: this.props.record.resModel,
                relatedThreadId: this.props.record.resId,
            });

            if (thread) {
                // Open the chat in a dialog or as an action
                await llmChat.openThread(thread);
            }
        } catch (error) {
            console.error("Failed to open LLM chat:", error);
        } finally {
            this.state.isOpening = false;
        }
    }
}