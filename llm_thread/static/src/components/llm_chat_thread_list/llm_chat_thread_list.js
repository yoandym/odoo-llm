/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

console.log("*** LLMChatThreadList module loading ***");


export class LLMChatThreadList extends Component {
    static template = "llm_thread.LLMChatThreadList";
    static props = {
        onThreadSelect: { type: Function, optional: true },
    };

    setup() {
        console.log("ThreadList: Component setup called");
        // Services
        this.llmChatService = useService("llm_chat");
        this.notification = useService("notification");

        // Direct access to the llmChat store
        this.llmChat = this.llmChatService;
        console.log("ThreadList: Service accessed:", this.llmChat);

        // Component state
        this.state = useState({
            isLoading: false,
            loadingThreadId: null,
            serviceRevision: this.llmChat._revision, // Track service revision reactively
        });

        // Watch for service changes and update our reactive state
        this.env.bus.addEventListener("llm_chat:threads_changed", () => {
            console.log("ThreadList: Received threads_changed event, updating revision");
            this.state.serviceRevision = this.llmChat._revision;
        });

        this.env.bus.addEventListener("llm_chat:thread_selected", () => {
            console.log("ThreadList: Received thread_selected event, updating revision");
            this.state.serviceRevision = this.llmChat._revision;
        });

        console.log("ThreadList: Setup complete");
    }

    /**
     * Get ordered threads from the service
     */
    get threads() {
        // Access our reactive service revision to ensure reactivity
        const revision = this.state.serviceRevision;
        const threads = this.llmChat.orderedThreads;
        console.log("ThreadList: threads getter called, revision:", revision, "returning:", threads.length, "threads");
        console.log("ThreadList: thread IDs:", threads.map(t => t.id));
        return threads;
    }

    /**
     * Get the active thread
     */
    get activeThread() {
        // Access our reactive service revision to ensure reactivity
        const revision = this.state.serviceRevision;
        const active = this.llmChat.activeThread;
        console.log("ThreadList: activeThread getter called, revision:", revision, "returning:", active?.id, active?.name);
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
     * Check if a thread is active
     */
    isThreadActive(threadId) {
        const isActive = this.activeThread?.id === threadId;
        console.log(`ThreadList: isThreadActive(${threadId}) = ${isActive}, activeThread:`, this.activeThread?.id);
        return isActive;
    }
}