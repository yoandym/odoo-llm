/** @odoo-module **/

import { Component, useState, useRef, onMounted, onWillUnmount } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";

/**
 * LLMChatThreadHeader Component for Odoo v17
 * 
 * Displays the header for an LLM chat thread with:
 * - Editable thread name
 * - LLM Provider selection
 * - LLM Model selection with search
 * - Tool selection
 * - Mobile responsive design
 */
export class LLMChatThreadHeader extends Component {
    static template = "llm_thread.LLMChatThreadHeader";
    static components = { Dropdown, DropdownItem };
    static props = {
        thread: Object,
        onOpenSidebar: { type: Function, optional: true },

    };

    setup() {
        // Services
        this.llmChatService = useService("llm_chat");
        this.notificationService = useService("notification");
        this.uiService = useService("ui");
        this.orm = useService("orm");

        // Direct access to llmChat store
        this.llmChat = this.llmChatService;

        // Refs
        this.threadNameInputRef = useRef("threadNameInput");
        this.modelSearchInputRef = useRef("modelSearchInput");
        this.modelDropdownRef = useRef("modelDropdown");

        // State
        this.state = useState({
            // Thread name editing
            isEditingName: false,
            pendingName: "",

            // Model selection
            selectedProviderId: this.props.thread?.llmModel?.llmProvider?.id || null,
            selectedModelId: this.props.thread?.llmModel?.id || null,
            modelSearchQuery: "",
            isModelDropdownOpen: false,

            // Tool selection
            selectedToolIds: [...(this.props.thread?.selectedToolIds || [])],

            // UI state
            isSaving: false,
        });

        // Bootstrap dropdown event handling
        onMounted(() => {
            this.setupDropdownListeners();
        });

        onWillUnmount(() => {
            this.cleanupDropdownListeners();
        });
    }

    // --------------------------------------------------------------------------
    // Getters
    // --------------------------------------------------------------------------

    /**
     * Check if on mobile device
     */
    get isMobile() {
        return this.uiService.isSmall;
    }

    /**
     * Get all LLM providers
     */
    get llmProviders() {
        return this.llmChat.llmProviders || [];
    }

    /**
     * Get selected provider
     */
    get selectedProvider() {
        return this.llmProviders.find(p => p.id === this.state.selectedProviderId) || null;
    }

    /**
     * Get all LLM models for selected provider
     */
    get availableModels() {
        if (!this.state.selectedProviderId) {
            return [];
        }
        return (this.llmChat.llmModels || []).filter(
            model => model.llmProvider?.id === this.state.selectedProviderId
        );
    }

    /**
     * Get filtered models based on search
     */
    get filteredModels() {
        const query = this.state.modelSearchQuery.trim().toLowerCase();
        if (!query) {
            return this.availableModels;
        }
        return this.availableModels.filter(model =>
            model.name.toLowerCase().includes(query)
        );
    }

    /**
     * Get selected model
     */
    get selectedModel() {
        return this.availableModels.find(m => m.id === this.state.selectedModelId) || null;
    }

    /**
     * Get available tools
     */
    get availableTools() {
        return this.llmChat.tools || [];
    }

    /**
     * Get selected tools count
     */
    get selectedToolsCount() {
        return this.state.selectedToolIds.length;
    }

    // --------------------------------------------------------------------------
    // Thread Name Management
    // --------------------------------------------------------------------------

    /**
     * Start editing thread name
     */
    startEditingName() {
        if (this.isMobile) return; // Don't edit on mobile

        this.state.isEditingName = true;
        this.state.pendingName = this.props.thread.name;

        // Focus input after render
        requestAnimationFrame(() => {
            this.threadNameInputRef.el?.focus();
            this.threadNameInputRef.el?.select();
        });
    }

    /**
     * Save thread name
     */
    async saveThreadName() {
        const newName = this.state.pendingName.trim();

        if (!newName || newName === this.props.thread.name) {
            this.cancelEditingName();
            return;
        }

        this.state.isSaving = true;

        try {
            await this.updateThreadSettings({ name: newName });
            this.state.isEditingName = false;
        } catch (error) {
            console.error("Failed to save thread name:", error);
            this.notificationService.add(
                this.env._t("Failed to save thread name"),
                { type: "danger" }
            );
        } finally {
            this.state.isSaving = false;
        }
    }

    /**
     * Cancel editing thread name
     */
    cancelEditingName() {
        this.state.isEditingName = false;
        this.state.pendingName = "";
    }

    /**
     * Handle thread name input
     */
    onThreadNameInput(ev) {
        this.state.pendingName = ev.target.value;
    }

    /**
     * Handle thread name keydown
     */
    onThreadNameKeydown(ev) {
        if (ev.key === "Enter") {
            ev.preventDefault();
            this.saveThreadName();
        } else if (ev.key === "Escape") {
            ev.preventDefault();
            this.cancelEditingName();
        }
    }

    // --------------------------------------------------------------------------
    // Model Selection
    // --------------------------------------------------------------------------

    /**
     * Select a provider
     */
    async onSelectProvider(provider) {
        if (provider.id === this.state.selectedProviderId) return;

        this.state.selectedProviderId = provider.id;

        // Auto-select default model for provider
        const defaultModel = this.getDefaultModelForProvider(provider.id);
        if (defaultModel) {
            await this.onSelectModel(defaultModel);
        } else {
            // Clear model selection if no models available
            this.state.selectedModelId = null;
        }

        // Clear search
        this.state.modelSearchQuery = "";
    }

    /**
     * Get default model for a provider
     */
    getDefaultModelForProvider(providerId) {
        const models = this.availableModels.filter(
            m => m.llmProvider?.id === providerId
        );

        // Find default model
        const defaultModel = models.find(m => m.default);

        return defaultModel || models[0] || null;
    }

    /**
     * Select a model
     */
    async onSelectModel(model) {
        if (model.id === this.state.selectedModelId) return;

        this.state.selectedModelId = model.id;

        // Save to thread
        await this.updateThreadSettings({
            model_id: model.id,
            provider_id: model.llmProvider?.id,
        });

        // Clear search
        this.state.modelSearchQuery = "";
    }

    /**
     * Handle model search input
     */
    onModelSearchInput(ev) {
        this.state.modelSearchQuery = ev.target.value;
    }

    // --------------------------------------------------------------------------
    // Tool Selection
    // --------------------------------------------------------------------------

    /**
     * Toggle tool selection
     */
    async onToggleTool(tool, isChecked) {
        const toolId = tool.id;

        if (isChecked) {
            if (!this.state.selectedToolIds.includes(toolId)) {
                this.state.selectedToolIds.push(toolId);
            }
        } else {
            const index = this.state.selectedToolIds.indexOf(toolId);
            if (index > -1) {
                this.state.selectedToolIds.splice(index, 1);
            }
        }

        // Save to thread
        await this.updateThreadSettings({
            tool_ids: [[6, 0, this.state.selectedToolIds]],
        });
    }

    /**
     * Check if tool is selected
     */
    isToolSelected(toolId) {
        return this.state.selectedToolIds.includes(toolId);
    }

    // --------------------------------------------------------------------------
    // Thread Settings Update
    // --------------------------------------------------------------------------

    /**
     * Update thread settings
     */
    async updateThreadSettings(values) {
        try {
            await this.orm.write("llm.thread", [this.props.thread.id], values);

            // Refresh thread in llmChat
            await this.llmChat.refreshThread(this.props.thread.id);
        } catch (error) {
            console.error("Failed to update thread settings:", error);
            throw error;
        }
    }

    // --------------------------------------------------------------------------
    // Mobile Actions
    // --------------------------------------------------------------------------

    /**
     * Toggle thread list visibility (mobile)
     */
    toggleThreadList() {
        // Call the provided callback to open sidebar
        if (this.props.onOpenSidebar) {
            this.props.onOpenSidebar();
        }
    }


    /**
     * Open thread settings (mobile)
     */
    openThreadSettings() {
        // This would open a modal or drawer with settings
        this.env.bus.trigger("open-thread-settings", {
            thread: this.props.thread,
        });
    }

    // --------------------------------------------------------------------------
    // Dropdown Management
    // --------------------------------------------------------------------------

    /**
     * Setup Bootstrap dropdown listeners
     */
    setupDropdownListeners() {
        if (this.modelDropdownRef.el) {
            this.modelDropdownRef.el.addEventListener(
                "shown.bs.dropdown",
                this.onModelDropdownShown.bind(this)
            );
            this.modelDropdownRef.el.addEventListener(
                "hidden.bs.dropdown",
                this.onModelDropdownHidden.bind(this)
            );
        }
    }

    /**
     * Cleanup dropdown listeners
     */
    cleanupDropdownListeners() {
        if (this.modelDropdownRef.el) {
            this.modelDropdownRef.el.removeEventListener(
                "shown.bs.dropdown",
                this.onModelDropdownShown.bind(this)
            );
            this.modelDropdownRef.el.removeEventListener(
                "hidden.bs.dropdown",
                this.onModelDropdownHidden.bind(this)
            );
        }
    }

    /**
     * Handle model dropdown shown
     */
    onModelDropdownShown() {
        // Focus search input
        setTimeout(() => {
            this.modelSearchInputRef.el?.focus();
        }, 100);
    }

    /**
     * Handle model dropdown hidden
     */
    onModelDropdownHidden() {
        // Clear search
        this.state.modelSearchQuery = "";
    }

    /**
     * Prevent dropdown from closing
     */
    preventDropdownClose(ev) {
        ev.stopPropagation();
    }
}