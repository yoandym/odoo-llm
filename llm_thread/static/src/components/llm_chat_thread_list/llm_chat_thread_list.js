/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";


export class LLMChatThreadList extends Component {
    static template = "llm_thread.LLMChatThreadList";
    static props = {
        onThreadSelect: { type: Function, optional: true },
    };

    setup() {
        // Services
        this.llmChatService = useService("llm_chat");
        this.notification = useService("notification");
        this.busService = useService("bus");

        // Direct access to the llmChat store
        this.llmChat = this.llmChatService;

        // Component state
        this.state = useState({
            isLoading: false,
            loadingThreadId: null,
            threads: this.llmChat.orderedThreads,
        });

        // Watch for service changes to trigger re-renders
        this.busService.addEventListener("llm_chat:threads_changed", this._onThreadsChanged.bind(this));


        this.busService.addEventListener("llm_chat:thread_selected", () => {
            // The reactive service will automatically trigger re-renders
        });

    }

    /**
     * Get the ordered threads directly from the service
     */
    get threads() {
        return this.state.threads;
    }

    /**
     * react to changes in threads - force component update
     */
    _onThreadsChanged(event) {
        // Force a re-render by updating a state property
        this.state.isLoading = this.state.isLoading;
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
        return this.threads.length === 0;
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
     * Check if a thread is the active/selected thread
     */
    isThreadActive(threadId) {
        return this.activeThread && this.activeThread.id === threadId;
    }


}