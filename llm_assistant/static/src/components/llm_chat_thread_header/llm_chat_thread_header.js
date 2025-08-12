/** @odoo-module **/

import { LLMChatThreadHeader } from "@llm_thread/components/llm_chat_thread_header/llm_chat_thread_header";
import { patch } from "@web/core/utils/patch";
import { onMounted, onWillUpdateProps } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";

patch(LLMChatThreadHeader.prototype, {
    setup() {
        super.setup();
        this._setupAssistantFeatures();
    },

    _setupAssistantFeatures() {
        // Add the selectedAssistant to state
        this.state.selectedAssistant = this.props.thread?.assistant || null;

        onMounted(() => {
            this._setupEventListeners();
            
            // Ensure the assistant dropdown reflects the thread's assistant
            this._updateAssistantFromThread(this.props.thread);
        });
        
        // Watch for thread changes to update dropdowns
        onWillUpdateProps((nextProps) => {
            if (nextProps.thread !== this.props.thread) {
                // Update the assistant dropdown when thread changes
                this._updateAssistantFromThread(nextProps.thread);
            }
        });
    },
    
    /**
     * Updates the selected assistant ID from thread data
     * @private
     * @param {Object} thread - Thread object
     */
    _updateAssistantFromThread(thread) {
        if (thread?.assistant?.id) {
            // Update the state with the thread's assistant ID
            this.state.selectedAssistant = thread.assistant;
        }
    },

    /**
     * Set up event listeners for the new bus-based architecture
     */
    _setupEventListeners() {
        this.env.bus.addEventListener("llm_chat:thread_refreshed", this._onThreadRefreshed.bind(this));
    },

    /**
     * Handle thread refresh events from the new event system
     */
    _onThreadRefreshed(event) {
        const { threadId, thread, updatedFields } = event.detail;
        
        if (this.props.thread?.id === threadId) {
            // If the thread was refreshed, update our assistant info
            if (thread) {
                this._updateAssistantFromThread(thread);
            } 
        }
    },

    // --------------------------------------------------------------------------
    // Assistant Getters
    // --------------------------------------------------------------------------

    get llmAssistants() {
        return this.llmChat.assistants || [];
    },

    get selectedAssistant() {
        // Try to get assistant ID from state or thread props
        return this.state.selectedAssistant;
    },

    get shouldShowProviderModelTools() {
        return false;
    },

    // --------------------------------------------------------------------------
    // Assistant Management
    // --------------------------------------------------------------------------

    async onSelectAssistant(assistant) {
        // Check if the assistant is already selected
        const currentAssistant = this.state.selectedAssistant;
        if (assistant?.id === currentAssistant?.id) {
            return;
        }
        
        // Store previous values in case we need to restore them
        const previousAssistant = currentAssistant;
        
        // Update local state immediately for UI responsiveness
        this.state.selectedAssistant = assistant;
        
        try {
            // Update the assistant in the backend
            await this.llmChat.setThreadAssistant(
                this.props.thread.id,
                assistant.id
            );
            
            // Refresh the thread
            if (this.llmChat?.refreshThread) {
                await this.llmChat.refreshThread(this.props.thread.id);
            }
        } catch (error) {
            // Restore previous state if there was an error
            this.state.selectedAssistant = previousAssistant;
            
            this.notificationService.add(
                _t("Failed to select assistant. Please try again."),
                { type: "danger" }
            );
        }
    },

    async onClearAssistant() {
        this.notificationService.add(
            _t("An assistant is required for all chat threads."),
            { type: "warning" }
        );
        return false;
    },

});