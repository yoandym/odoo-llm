/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { LLMChatThreadHeader as OriginalLLMChatThreadHeader } from "@llm_thread/components/llm_chat_thread_header/llm_chat_thread_header";

patch(OriginalLLMChatThreadHeader.prototype, {
    setup() {
        super.setup();
        
        // Add assistant service
        this.llmAssistantService = useService("llm_assistant");
        
        // Add assistant state
        this.assistantState = useState({
            isUpdatingAssistant: false,
            selectedAssistantId: this.props.thread?.llmAssistant?.id || null,
        });
    },
    
    /**
     * Get all available assistants
     */
    get llmAssistants() {
        return this.llmChat.llmAssistants || [];
    },
    
    /**
     * Get the currently selected assistant
     */
    get selectedAssistant() {
        if (!this.assistantState.selectedAssistantId) {
            return null;
        }
        return this.llmAssistants.find(a => a.id === this.assistantState.selectedAssistantId) || null;
    },
    
    /**
     * Handle assistant selection
     */
    async onSelectAssistant(assistant) {
        if (this.assistantState.isUpdatingAssistant || 
            this.assistantState.selectedAssistantId === assistant.id) {
            return;
        }

        this.assistantState.isUpdatingAssistant = true;
        const previousAssistantId = this.assistantState.selectedAssistantId;
        
        // Update local state immediately
        this.assistantState.selectedAssistantId = assistant.id;

        try {
            const success = await this.llmChat.updateThreadAssistant(
                this.props.thread.id,
                assistant.id
            );
            
            if (!success) {
                // Revert on failure
                this.assistantState.selectedAssistantId = previousAssistantId;
            }
        } finally {
            this.assistantState.isUpdatingAssistant = false;
        }
    },
    
    /**
     * Clear the selected assistant
     */
    async onClearAssistant() {
        if (this.assistantState.isUpdatingAssistant || 
            !this.assistantState.selectedAssistantId) {
            return;
        }

        this.assistantState.isUpdatingAssistant = true;
        const previousAssistantId = this.assistantState.selectedAssistantId;
        
        // Update local state immediately
        this.assistantState.selectedAssistantId = null;

        try {
            const success = await this.llmChat.updateThreadAssistant(
                this.props.thread.id,
                false
            );
            
            if (!success) {
                // Revert on failure
                this.assistantState.selectedAssistantId = previousAssistantId;
            }
        } finally {
            this.assistantState.isUpdatingAssistant = false;
        }
    },
});