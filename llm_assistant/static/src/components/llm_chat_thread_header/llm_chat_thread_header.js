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

        // Only keep transient UI state
        if (!this.state._assistantInitialized) {
            Object.assign(this.state, {
                _assistantInitialized: true,
                isLoadingAssistants: false,
            });
        }

        // Load assistants on component mount
        onMounted(async () => {
            try {
                await this.loadAssistants();
                await this._syncToolsFromThread();
                await this._ensureAssistantSelected();
            } catch (error) {
                console.error("Error loading assistants:", error);
            }
            this._setupEventListeners();
        });

        // Watch for thread changes to update dropdowns
        onWillUpdateProps(async (nextProps) => {
            const threadChanged = nextProps.thread?.id !== this.props.thread?.id;
            const assistantChanged = nextProps.thread?.assistantId !== this.props.thread?.assistantId;
            if (threadChanged || assistantChanged) {
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
        return this._assistants || [];
    },

    /**
     * Get currently selected assistant
     */
    get selectedAssistant() {
        if (!this.props.thread?.assistantId) {
            return null;
        }
        return (this._assistants || []).find(a => a.id === this.props.thread.assistantId) || null;
    },

    /**
     * Check if we should show the provider/model/tools dropdowns
     * Always return false to enforce assistant usage
     */
    get shouldShowProviderModelTools() {
        return false; // Always hide direct model selection to enforce assistant usage
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
            this._assistants = await this.llmAssistantService.loadAssistants();
        } catch (error) {
            console.error("Failed to load assistants:", error);
            this.notificationService.add(
                _t("Failed to load assistants"),
                { type: "danger" }
            );
            this._assistants = [];
        } finally {
            this.state.isLoadingAssistants = false;
        }
    },

    /**
     * Handle assistant selection
     * @param {Object} assistant - The selected assistant
     */
    async onSelectAssistant(assistant) {
        if (assistant.id === this.props.thread?.assistantId) return;
        const previousAssistantId = this.props.thread?.assistantId;
        const previousSelectedToolIds = [...this.state.selectedToolIds];
        const previousModel = this.state.selectedModel;
        try {
            await this.llmAssistantService.setThreadAssistant(
                this.props.thread.id,
                assistant.id
            );
            if (this.llmChatService?.refreshThread) {
                await this.llmChatService.refreshThread(this.props.thread.id);
            }
        } catch (error) {
            this.notificationService.add(
                _t("Failed to select assistant. Please try again."),
                { type: "danger" }
            );
        }
    },

    /**
     * Clear the selected assistant - disabled as assistants are now required
     * This method is kept for compatibility but won't be called from the UI
     */
    async onClearAssistant() {
        // Function retained for compatibility but assistant is now required
        this.notificationService.add(
            _t("An assistant is required for all chat threads."),
            { type: "warning" }
        );
        return false;
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

        } else {
            this.state.selectedToolIds = [];
        }
    },

    /**
     * Ensure that an assistant is selected for the current thread
     * This is called on initialization to enforce assistant-only mode
     */
    async _ensureAssistantSelected() {
        if (this.props.thread?.assistantId) {
            return;
        }
        if (!this._assistants || this._assistants.length === 0) {
            this.notificationService.add(
                _t("No assistants found. Please create at least one assistant."),
                { type: "warning" }
            );
            return;
        }
        try {
            const defaultAssistant = this.llmAssistantService.getDefaultAssistant();
            await this.llmAssistantService.setThreadAssistant(
                this.props.thread.id,
                defaultAssistant.id
            );
            if (this.llmChatService?.refreshThread) {
                await this.llmChatService.refreshThread(this.props.thread.id);
            }
        } catch (error) {
            console.error("Failed to auto-select assistant:", error);
            this.notificationService.add(
                _t("Failed to automatically select an assistant. Please select one manually."),
                { type: "danger" }
            );
        }
    },
});