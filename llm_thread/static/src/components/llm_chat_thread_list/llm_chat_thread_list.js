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

        // Use useState to make the service reactive in this component
        this.llmChat = useState(this.llmChatService);

        // Component state - only for component-specific state, not data from service
        this.state = useState({
            isLoading: false,
            loadingThreadId: null,
        });
    }

    /**
     * Get the ordered threads directly from the reactive service
     * This ensures automatic reactivity when threads change
     */
    get threads() {
        const threads = this.llmChat.orderedThreads;
        return threads;
    }

    /**
     * Get the active thread
     */
    get activeThread() {
        const active = this.llmChat.activeThread;
        return active;
    }

    /**
     * Check if there are no threads
     */
    get hasNoThreads() {
        const threads = this.threads;
        const hasNone = !threads || threads.length === 0;
        return hasNone;
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