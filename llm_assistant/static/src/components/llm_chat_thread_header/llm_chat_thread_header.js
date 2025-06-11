/** @odoo-module **/

import { LLMChatThreadHeader } from "@llm_thread/components/llm_chat_thread_header/llm_chat_thread_header";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { onMounted, onWillUpdateProps } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";

patch(LLMChatThreadHeader.prototype, {
    setup() {
        super.setup();
        this._setupAssistantFeatures();
    },

    _setupAssistantFeatures() {
        // Add assistant service
        this.llmAssistantService = useService("llm_assistant");

        // Add notification service
        this.notificationService = useService("notification");

        // Add chat service to refresh threads
        this.llmChatService = useService("llm_chat");

        // Initialize assistant-specific state if not already done
        if (!this.state._assistantInitialized) {
            Object.assign(this.state, {
                _assistantInitialized: true,
                selectedAssistantId: this.props.thread?.assistantId || null,
                assistants: [],
                isLoadingAssistants: false,
            });
        } else {
            // If already initialized, ensure state is synced with current props
            this.state.selectedAssistantId = this.props.thread?.assistantId || null;
        }

        // Load assistants on component mount
        onMounted(async () => {
            console.log("Assistant patch: onMounted - Initial thread data:", {
                threadId: this.props.thread?.id,
                assistantId: this.props.thread?.assistantId,
                selectedAssistantId: this.state.selectedAssistantId
            });

            try {
                await this.loadAssistants();

                // After loading assistants, initialize tools if assistant is already selected
                await this._syncToolsFromThread();

            } catch (error) {
                console.error("Error loading assistants:", error);
                // Don't block the component from loading even if assistants fail to load
            }

            // Set up event listeners for thread changes
            this._setupEventListeners();
        });

        // Watch for thread changes to update dropdowns
        onWillUpdateProps(async (nextProps) => {
            const threadChanged = nextProps.thread?.id !== this.props.thread?.id;
            const assistantChanged = nextProps.thread?.assistantId !== this.props.thread?.assistantId;

            console.log("onWillUpdateProps debug:", {
                threadChanged,
                assistantChanged,
                currentThreadId: this.props.thread?.id,
                nextThreadId: nextProps.thread?.id,
                currentAssistantId: this.props.thread?.assistantId,
                nextAssistantId: nextProps.thread?.assistantId,
                currentStateAssistantId: this.state.selectedAssistantId
            });

            if (threadChanged || assistantChanged) {
                console.log("Updating component state due to props change");
                // Thread or assistant has changed, update our state
                this.state.selectedAssistantId = nextProps.thread?.assistantId || null;

                // Always sync tools when thread or assistant changes
                // This covers: initial load, assistant selection, thread refresh, thread switching, assistant clearing
                if (nextProps.thread) {
                    this._syncToolsFromThread(nextProps.thread);
                }
            }

        });
    },

    /**
     * Set up event listeners for the new bus-based architecture
     */
    _setupEventListeners() {
        // Listen for bus events directly
        this.env.bus.addEventListener("llm_chat:thread_refreshed", this._onThreadRefreshed.bind(this));
        this.env.bus.addEventListener("llm_chat:thread_updated", this._onThreadUpdated.bind(this));
        this.env.bus.addEventListener("llm_chat:active_thread_updated", this._onActiveThreadUpdated.bind(this));
    },

    /**
     * Handle thread refresh events from the new event system
     */
    _onThreadRefreshed(event) {
        const { threadId, thread, updatedFields } = event.detail;

        // Only process if this is our current thread
        if (this.props.thread?.id === threadId) {
            console.log("Thread refreshed event received:", {
                threadId,
                assistantId: updatedFields.assistantId,
                toolIds: updatedFields.tool_ids
            });

            // Update assistant state if changed
            if (updatedFields.assistantId !== undefined) {
                this.state.selectedAssistantId = updatedFields.assistantId;
            }

            // Sync tools from the updated thread data
            this._syncToolsFromThread(thread);
        }
    },

    /**
     * Handle thread update events from legacy bus system
     */
    _onThreadUpdated(event) {
        const { threadId, thread, updatedFields } = event.detail;

        // Only process if this is our current thread
        if (this.props.thread?.id === threadId) {
            console.log("Thread updated event received:", {
                threadId,
                assistantId: updatedFields.assistantId,
                toolIds: updatedFields.tool_ids
            });

            // Update assistant state if changed
            if (updatedFields.assistantId !== undefined) {
                this.state.selectedAssistantId = updatedFields.assistantId;
            }

            // Sync tools from the updated thread data
            this._syncToolsFromThread(thread);
        }
    },

    /**
     * Handle active thread update events from legacy bus system
     */
    _onActiveThreadUpdated(event) {
        const { threadId, thread, updatedFields } = event.detail;

        // Only process if this is our current thread
        if (this.props.thread?.id === threadId) {
            console.log("Active thread updated event received:", {
                threadId,
                assistantId: updatedFields.assistantId,
                toolIds: updatedFields.tool_ids
            });

            // Update assistant state if changed
            if (updatedFields.assistantId !== undefined) {
                this.state.selectedAssistantId = updatedFields.assistantId;
            }

            // Sync tools from the updated thread data
            this._syncToolsFromThread(thread);
        }
    },

    // --------------------------------------------------------------------------
    // Assistant Getters
    // --------------------------------------------------------------------------

    /**
     * Get all available assistants
     */
    get llmAssistants() {
        return this.state.assistants || [];
    },

    /**
     * Get currently selected assistant
     */
    get selectedAssistant() {
        if (!this.state.selectedAssistantId) {
            return null;
        }
        return this.state.assistants.find(a => a.id === this.state.selectedAssistantId) || null;
    },

    // --------------------------------------------------------------------------
    // Assistant Management
    // --------------------------------------------------------------------------

    /**
     * Load available assistants
     */
    async loadAssistants() {
        this.state.isLoadingAssistants = true;
        try {
            const assistants = await this.llmAssistantService.loadAssistants();
            this.state.assistants = assistants;

            // Update selected assistant if thread has one
            if (this.props.thread?.assistantId) {
                this.state.selectedAssistantId = this.props.thread.assistantId;
            }
        } catch (error) {
            console.error("Failed to load assistants:", error);
            this.notificationService.add(
                _t("Failed to load assistants"),
                { type: "danger" }
            );
        } finally {
            this.state.isLoadingAssistants = false;
        }
    },

    /**
     * Handle assistant selection
     * @param {Object} assistant - The selected assistant
     */
    async onSelectAssistant(assistant) {
        console.log("onSelectAssistant called:", {
            assistantId: assistant.id,
            currentState: this.state.selectedAssistantId,
            threadId: this.props.thread.id
        });

        if (assistant.id === this.state.selectedAssistantId) return;

        // save state to restore it in case of error
        const previousAssistantId = this.state.selectedAssistantId;
        const previousSelectedToolIds = [...this.state.selectedToolIds];
        const previousModel = this.state.selectedModel;

        this.state.selectedAssistantId = assistant.id;

        try {
            // Update thread with selected assistant
            await this.llmAssistantService.setThreadAssistant(
                this.props.thread.id,
                assistant.id
            );

            // Refresh thread to get updated dropdowns data from backend
            if (this.llmChatService?.refreshThread) {
                await this.llmChatService.refreshThread(this.props.thread.id);
            }


        } catch (error) {
            // Revert on error
            this.state.selectedAssistantId = previousAssistantId;
            this.state.selectedToolIds = previousSelectedToolIds;
            this.state.selectedModelId = previousModel?.id || null;

            console.error("Failed to select assistant:", error);
            this.notificationService.add(
                _t("Failed to select assistant. Please try again."),
                { type: "danger" }
            );
        }
    },

    /**
     * Clear the selected assistant
     */
    async onClearAssistant() {
        console.log("onClearAssistant called:", {
            currentState: this.state.selectedAssistantId,
            threadId: this.props.thread.id
        });

        const previousAssistantId = this.state.selectedAssistantId;
        const previousSelectedToolIds = [...this.state.selectedToolIds];
        this.state.selectedAssistantId = null;

        try {
            console.log("Calling setThreadAssistant with false...");
            // Clear assistant from thread
            const result = await this.llmAssistantService.setThreadAssistant(
                this.props.thread.id,
                false
            );
            console.log("setThreadAssistant result:", result);

            // Refresh thread to get updated dropdowns data from backend
            if (this.llmChatService?.refreshThread) {
                console.log("Refreshing thread...");
                // Explicitly request assistant_id field to ensure it's fetched
                const refreshResult = await this.llmChatService.refreshThread(this.props.thread.id, ["assistant_id"]);
                console.log("Thread refresh result:", refreshResult);
                console.log("Thread after refresh:", {
                    threadId: this.props.thread.id,
                    assistantId: this.props.thread.assistantId,
                    toolIds: this.props.thread.tool_ids
                });
            } else {
                console.warn("llmChatService.refreshThread not available");
            }

            // Double-check by logging the thread data again after a short delay
            setTimeout(() => {
                console.log("Thread data after timeout:", {
                    threadId: this.props.thread.id,
                    assistantId: this.props.thread.assistantId,
                    toolIds: this.props.thread.tool_ids,
                    componentState: this.state.selectedAssistantId
                });
            }, 100);

        } catch (error) {
            // Revert on error
            this.state.selectedAssistantId = previousAssistantId;

            console.error("Failed to clear assistant:", error);
            this.notificationService.add(
                _t("Failed to clear assistant. Please try again."),
                { type: "danger" }
            );
        }
    },

    /**
     * Sync selected tools from thread's tool_ids
     * This is the ONLY method needed for tool synchronization
     */
    _syncToolsFromThread(thread = null) {
        const currentThread = thread || this.props.thread;

        if (currentThread?.tool_ids) {
            // Extract tool IDs from thread's tool_ids field
            let toolIds = [];
            if (Array.isArray(currentThread.tool_ids)) {
                toolIds = currentThread.tool_ids.map(tool =>
                    Array.isArray(tool) ? tool[0] : tool
                );
            }

            this.state.selectedToolIds = [...toolIds];

            console.log("Synced tools from thread:", {
                threadId: currentThread.id,
                assistantId: currentThread.assistantId,
                toolIds: toolIds
            });
        } else {
            this.state.selectedToolIds = [];
        }
    },
});