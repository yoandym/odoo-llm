/** @odoo-module **/

import { LLMChatThreadHeader } from "@llm_thread/components/llm_chat_thread_header/llm_chat_thread_header";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { onMounted } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";

patch(LLMChatThreadHeader.prototype, {
    setup() {
        console.log("Assistant patch: Calling super.setup()");
        super.setup();
        this._setupAssistantFeatures();
    },

    _setupAssistantFeatures() {
        console.log("Assistant patch: Setting up assistant features");
        // Add assistant service
        this.llmAssistantService = useService("llm_assistant");

        // Initialize assistant-specific state if not already done
        if (!this.state._assistantInitialized) {
            Object.assign(this.state, {
                _assistantInitialized: true,
                selectedAssistantId: this.props.thread?.assistantId || null,
                assistants: [],
                isLoadingAssistants: false,
            });
        }

        // Load assistants on component mount
        onMounted(async () => {
            try {
                await this.loadAssistants();
            } catch (error) {
                console.error("Error loading assistants:", error);
                // Don't block the component from loading even if assistants fail to load
            }
        });
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
        if (assistant.id === this.state.selectedAssistantId) return;

        const previousAssistantId = this.state.selectedAssistantId;
        this.state.selectedAssistantId = assistant.id;

        try {
            // Update thread with selected assistant
            await this.llmAssistantService.setThreadAssistant(
                this.props.thread.id,
                assistant.id
            );

            // Notify of successful update
            this.notificationService.add(
                _t("Assistant selected successfully"),
                { type: "success" }
            );

        } catch (error) {
            // Revert on error
            this.state.selectedAssistantId = previousAssistantId;

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
        const previousAssistantId = this.state.selectedAssistantId;
        this.state.selectedAssistantId = null;

        try {
            // Clear assistant from thread
            await this.llmAssistantService.setThreadAssistant(
                this.props.thread.id,
                false
            );

            // Notify of successful update
            this.notificationService.add(
                _t("Assistant cleared successfully"),
                { type: "success" }
            );

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
});