/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";


export class LLMChatThreadList extends Component {
    static template = "llm_thread.LLMChatThreadList";
    static props = {
        onThreadSelect: { type: Function, optional: true },
    };

    setup() {
        // Services
        this.llmChatService = useService("llm_chat");
        this.notification = useService("notification");

        // Direct access to the llmChat store
        this.llmChat = this.llmChatService;

        // Component state
        this.state = useState({
            isLoading: false,
            loadingThreadId: null,
            threads: this.llmChat.orderedThreads,
        });

        // Watch for service changes to trigger re-renders
        this.env.bus.addEventListener("llm_chat:threads_changed", this._onThreadsChanged.bind(this));


        this.env.bus.addEventListener("llm_chat:thread_selected", () => {
            // The reactive service will automatically trigger re-renders
        });

    }

    /**
     * react to changes in threads
     */
    _onThreadsChanged(event) {
        this.state.threads = this.llmChat.orderedThreads;
    }

    /**
     * Get the active thread
     */
    get activeThread() {
        const active = this.llmChat.activeThread;
        console.log("ThreadList: activeThread getter called, returning:", active?.id, active?.name);
        return active;
    }

    /**
     * Check if there are no threads
     */
    get hasNoThreads() {
        return this.state.threads.length === 0;
    }

    /**
     * Handle thread click
     * @param {Object} thread
     */
    async onThreadClick(thread) {
        // Prevent multiple clicks
        if (this.state.isLoading || this.state.loadingThreadId === thread.id) {
            return;
        }

        this.state.isLoading = true;
        this.state.loadingThreadId = thread.id;

        try {
            await this.llmChat.selectThread(thread.id);

            // Call the callback if provided
            if (this.props.onThreadSelect) {
                this.props.onThreadSelect(thread);
            }
        } catch (error) {
            console.error("Error selecting thread:", error);
            this.notification.add(
                this.env._t("Failed to load thread"),
                {
                    title: this.env._t("Error"),
                    type: "danger",
                }
            );
        } finally {
            this.state.isLoading = false;
            this.state.loadingThreadId = null;
        }
    }

    /**
     * Check if a thread is currently being loaded
     */
    isThreadLoading(threadId) {
        return this.state.loadingThreadId === threadId;
    }

    /**
     * Check if a thread is active
     */
    isThreadActive(threadId) {
        const isActive = this.activeThread?.id === threadId;
        console.log(`ThreadList: isThreadActive(${threadId}) = ${isActive}, activeThread:`, this.activeThread?.id);
        return isActive;
    }
}