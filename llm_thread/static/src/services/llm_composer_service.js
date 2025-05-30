/** @odoo-module **/

import { registry } from "@web/core/registry";
import { EventBus } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";

/**
 * LLM Composer Service for Odoo v17
 * 
 * This service manages the composer functionality for LLM chat,
 * including message sending, streaming responses, and state management.
 */
export const llmComposerService = {
    dependencies: ["llm_chat", "notification", "rpc"],

    start(env, { llm_chat, notification, rpc }) {
        const eventBus = new EventBus();

        return {
            // Event bus for composer events
            eventBus,

            /**
             * Create a composer state for a thread
             */
            createComposerState(threadId) {
                return {
                    threadId,
                    textContent: "",
                    isDisabled: false,
                    isStreaming: false,
                    eventSource: null,
                    placeholder: _t("Ask anything..."),
                };
            },

            /**
             * Post a user message to the LLM
             */
            async postUserMessage(composerState, messageBody) {
                if (!messageBody?.trim() || !composerState.threadId) {
                    notification.add(
                        _t("Please enter a message."),
                        { type: "danger" }
                    );
                    return;
                }

                // Reset composer
                composerState.textContent = "";
                composerState.isDisabled = true;

                try {
                    // Create EventSource for streaming
                    const eventSource = new EventSource(
                        `/llm/thread/generate?thread_id=${composerState.threadId}&message=${encodeURIComponent(messageBody.trim())}`
                    );

                    composerState.eventSource = eventSource;
                    composerState.isStreaming = true;

                    // Handle incoming messages
                    eventSource.onmessage = (event) => {
                        const data = JSON.parse(event.data);
                        this._handleStreamMessage(composerState, data);
                    };

                    // Handle errors
                    eventSource.onerror = (error) => {
                        console.error("EventSource failed:", error);
                        notification.add(
                            _t("An error occurred while generating response"),
                            { type: "danger" }
                        );
                        this.stopStreaming(composerState);
                    };

                } catch (error) {
                    console.error("Error sending LLM message:", error);
                    notification.add(
                        _t("Failed to send message."),
                        { type: "danger" }
                    );
                    composerState.isDisabled = false;
                }
            },

            /**
             * Stop the streaming response
             */
            stopStreaming(composerState) {
                if (composerState.eventSource) {
                    composerState.eventSource.close();
                    composerState.eventSource = null;
                }
                composerState.isStreaming = false;
                composerState.isDisabled = false;

                // Emit event for UI updates
                eventBus.trigger("streaming-stopped", { threadId: composerState.threadId });
            },

            /**
             * Handle incoming stream messages
             * @private
             */
            _handleStreamMessage(composerState, data) {
                switch (data.type) {
                    case "message_create":
                        eventBus.trigger("message-created", {
                            threadId: composerState.threadId,
                            message: data.message,
                        });
                        break;

                    case "message_chunk":
                    case "message_update":
                        eventBus.trigger("message-updated", {
                            threadId: composerState.threadId,
                            message: data.message,
                        });
                        break;

                    case "error":
                        this.stopStreaming(composerState);
                        notification.add(data.error, { type: "danger" });
                        break;

                    case "done":
                        this.stopStreaming(composerState);
                        const activeThread = llm_chat.llmChat.activeThread;
                        if (activeThread?.id !== composerState.threadId) {
                            notification.add(
                                _t("Generation completed"),
                                { type: "success" }
                            );
                        }
                        break;
                }
            },

            /**
             * Check if send shortcut is pressed
             */
            matchesSendShortcut(ev, shortcuts = ["ctrl-enter", "enter"]) {
                for (const shortcut of shortcuts) {
                    if (this._matchesShortcut(ev, shortcut)) {
                        return true;
                    }
                }
                return false;
            },

            /**
             * Check if a keyboard event matches a specific shortcut
             * @private
             */
            _matchesShortcut(ev, shortcutType) {
                switch (shortcutType) {
                    case "ctrl-enter":
                        return !ev.altKey && ev.ctrlKey && !ev.metaKey && !ev.shiftKey;
                    case "enter":
                        return !ev.altKey && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey;
                    case "meta-enter":
                        return !ev.altKey && !ev.ctrlKey && ev.metaKey && !ev.shiftKey;
                    default:
                        return false;
                }
            },
        };
    },
};

// Register the service
registry.category("services").add("llm_composer", llmComposerService);