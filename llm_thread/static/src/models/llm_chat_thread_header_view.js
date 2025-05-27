/** @odoo-module **/

import { Record } from "@mail/core/common/record";
import { useEffect, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";


export class LLMChatThreadHeaderView extends Record {
  setup() {
    super.setup();

    this.messaging = useService("messaging");

    this.state = useState({
      selectedProviderId: null,
      selectedModelId: null,
      isEditingName: false,
      pendingName: "",
    });

    useEffect(
      () => {
        this._onThreadViewChange();
      },
      () => [this.thread?.llmChat?.activeThread?.id]
    );

  }

  thread = Record.one("Thread", { inverse: "llmChatThreadHeaderView", });
  llmChatThreadNameInputRef = Record.attr();
  _isInitializing = Record.attr({ default: false, });
  selectedProvider = Record.one("LLMProvider", {
    compute() {
      if (!this.state.selectedProviderId) {
        return null;
      }
      const providers = this.thread?.llmChat?.llmProviders;
      if (!providers || !Array.isArray(providers)) {
        return null;
      }
      return (
        providers.find((p) => p && p.id === this.state.selectedProviderId) || null
      );
    },
  });
  selectedModel = Record.one("LLMModel", {
    compute() {
      if (!this.state.selectedModelId) {
        return null;
      }
      const models = this.thread?.llmChat?.llmModels;
      if (!models || !Array.isArray(models)) {
        return null;
      }
      const matchedModel = models.find(
        (m) => m && m.id === this.state.selectedModelId
      );
      return matchedModel || null;
    },
  });
  modelsAvailableToSelect = Record.many("LLMModel", {
    compute() {
      if (!this.state.selectedProviderId) {
        return [];
      }
      return (
        this.thread?.llmChat?.llmModels?.filter(
          (model) => model?.llmProvider?.id === this.state.selectedProviderId
        ) || []
      );
    },
  });
  /**
   * Initialize or reset state based on current thread
   * @private
   */
  _initializeState() {
    const currentThread = this.thread;
    if (!currentThread) {
      this.state.selectedProviderId = null;
      this.state.selectedModelId = null;
      return;
    }

    this.state.selectedProviderId = currentThread.llmModel?.llmProvider?.id;
    this.state.selectedModelId = currentThread.llmModel?.id;
  }

  /**
   * Handle thread changes
   * @private
   */
  _onThreadViewChange() {
    this._initializeState();
  }

  /**
   * Handle model changes
   * @param {String} selectedModelId - ID of the selected model
   * @private
   */
  async saveSelectedModel(selectedModelId) {
    // Skip backend update during initialization
    if (!selectedModelId || selectedModelId === this.state.selectedModelId) {
      return;
    }

    this.state.selectedModelId = selectedModelId;
    const provider = this.selectedModel.llmProvider;
    this.state.selectedProviderId = provider.id;

    await this.thread.updateLLMChatThreadSettings({
      llmModelId: this.selectedModel.id,
      llmProviderId: provider.id,
    });
  }

  /**
   * Opens the thread form view for editing
   */
  async openThreadSettings() {
    await this.env.services.action.doAction(
      {
        type: "ir.actions.act_window",
        res_model: "llm.thread",
        res_id: this.thread.id,
        views: [[false, "form"]],
        target: "new",
        flags: {
          mode: "edit",
        },
      },
      {
        onClose: () => {
          // Reload thread data when form is closed
          this.thread.llmChat.loadThreads();
        },
      }
    );
  }

  /**
   * Start editing thread name
   */
  onClickTopbarThreadName() {
    if (this.state.isEditingName || this.messaging.device.isSmall) {
      return;
    }
    this.state.isEditingName = true;
    this.state.pendingName = this.thread.name;
  }

  /**
   * Save thread name changes to server
   */
  async saveThreadName() {
    const thread = this.thread;
    if (!this.pendingName.trim()) {
      this.discardThreadNameEdition();
      return;
    }

    const newName = this.pendingName.trim();
    if (newName === thread.name) {
      this.discardThreadNameEdition();
      return;
    }

    try {
      await thread.updateLLMChatThreadSettings({ name: newName });
      this.state.isEditingName = false;
      this.state.pendingName = "";
    } catch (error) {
      console.error("Error updating thread name:", error);
      this.messaging.notify({
        message: this.env._t("Failed to update thread name"),
        type: "danger",
      });
      this.discardThreadNameEdition();
    }
  }

  /**
   * Discard thread name changes
   */
  discardThreadNameEdition() {
    this.state.isEditingName = false;
    this.state.pendingName = "";
  }
}

LLMChatThreadHeaderView.register();