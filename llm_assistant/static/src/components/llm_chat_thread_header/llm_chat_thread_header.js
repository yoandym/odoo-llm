/** @odoo-module **/

import { LLMChatThreadHeader } from "@llm_thread/components/llm_chat_thread_header/llm_chat_thread_header";
import { useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";


/**
 * Extended LLMChatThreadHeader for Assistant functionality
 * Migrated to Odoo v17 patterns
 */
export class LLMChatThreadHeaderWithAssistant extends LLMChatThreadHeader {
    
    setup() {
        super.setup();
        
        // Additional services
        this.llmAssistantService = useService("llm_assistant");
        
        // Extended state for assistant functionality
        this.state = Object.assign(this.state || {}, useState({
            selectedAssistantId: this.props.thread?.assistantId || null,
            assistants: [],
            isLoadingAssistants: false,
        }));
        
        // Load assistants on component mount
        this.loadAssistants();
    }
    
    // --------------------------------------------------------------------------
    // Getters
    // --------------------------------------------------------------------------
    
    /**
     * Get all available assistants
     */
    get llmAssistants() {
        return this.state.assistants;
    }
    
    /**
     * Get currently selected assistant
     */
    get selectedAssistant() {
        if (!this.state.selectedAssistantId) {
            return null;
        }
        return this.state.assistants.find(a => a.id === this.state.selectedAssistantId) || null;
    }
    
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
    }
    
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
            
            // Update thread settings
            await this.updateThreadSettings({
                assistant_id: assistant.id,
            });
            
            // Notify of successful update
            this.notificationService.add(
                _t("Assistant updated successfully"),
                { type: "success" }
            );
            
        } catch (error) {
            // Revert on error
            this.state.selectedAssistantId = previousAssistantId;
            
            console.error("Failed to update assistant:", error);
            this.notificationService.add(
                _t("Failed to update assistant"),
                { type: "danger" }
            );
        }
    }
    
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
            
            // Update thread settings
            await this.updateThreadSettings({
                assistant_id: false,
            });
            
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
                _t("Failed to clear assistant"),
                { type: "danger" }
            );
        }
    }
    
    /**
     * Override updateThreadSettings to handle assistant updates
     * @override
     */
    async updateThreadSettings(values) {
        // If assistant_id is being updated, ensure we have the latest assistant data
        if ('assistant_id' in values && values.assistant_id) {
            const assistant = this.state.assistants.find(a => a.id === values.assistant_id);
            if (assistant && assistant.promptId) {
                // Fetch evaluated values for this thread-assistant combination
                try {
                    const evaluatedValues = await this.llmAssistantService.getAssistantValuesForThread(
                        this.props.thread.id,
                        assistant.id
                    );
                    
                    // Update assistant data with evaluated values
                    if (evaluatedValues) {
                        Object.assign(assistant, evaluatedValues);
                    }
                } catch (error) {
                    console.error("Failed to fetch assistant values:", error);
                }
            }
        }
        
        // Call parent implementation
        return super.updateThreadSettings(values);
    }
}

// Register the component
LLMChatThreadHeaderWithAssistant.components = {
    ...LLMChatThreadHeader.components,
};
