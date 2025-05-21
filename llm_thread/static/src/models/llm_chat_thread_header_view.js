/** @odoo-module **/

import { Record } from "@mail/core/common/record";
import { useEffect } from "@odoo/owl";

export class LLMChatThreadHeaderView extends Record {
  setup() {
    super.setup();
    this._initializeState();

    useEffect(
      () => {
        this._onThreadViewChange();
      },
      () => [this.thread?.llmChat?.activeThread?.id]
    );
  }

  thread = Record.one("Thread", {
    inverse: "llmChatThreadHeaderView",
  });
  isEditingName = Record.attr({
    default: false,
  });
  pendingName = Record.attr({
    default: "",
  });
  llmChatThreadNameInputRef = Record.attr();
  selectedProviderId = Record.attr();
  selectedModelId = Record.attr();
  _isInitializing = Record.attr({
    default: false,
  });
  selectedProvider = Record.one("LLMProvider", {
    compute() {
      if (!this.selectedProviderId) {
        return null;
      }
      const providers = this.thread?.llmChat?.llmProviders;
      if (!providers || !Array.isArray(providers)) {
        return null;
      }
      return (
        providers.find((p) => p && p.id === this.selectedProviderId) || null
      );
    },
  });
  selectedModel = Record.one("LLMModel", {
    compute() {
      if (!this.selectedModelId) {
        return null;
      }
      const models = this.thread?.llmChat?.llmModels;
      if (!models || !Array.isArray(models)) {
        return null;
      }
      const matchedModel = models.find(
        (m) => m && m.id === this.selectedModelId
      );
      return matchedModel || null;
    },
  });
  modelsAvailableToSelect = Record.many("LLMModel", {
    compute() {
      if (!this.selectedProviderId) {
        return [];
      }
      return (
        this.thread?.llmChat?.llmModels?.filter(
          (model) => model?.llmProvider?.id === this.selectedProviderId
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
      this.update({
        selectedProviderId: null,
        selectedModelId: null,
      });
      return;
    }

    this.update({
      selectedProviderId: currentThread.llmModel?.llmProvider?.id,
      selectedModelId: currentThread.llmModel?.id,
    });
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
    if (!selectedModelId || selectedModelId === this.selectedModelId) {
      return;
    }

    this.update({
      selectedModelId,
    });
    const provider = this.selectedModel.llmProvider;
    this.update({
      selectedProviderId: provider.id,
    });

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
    if (this.isEditingName || this.messaging.device.isSmall) {
      return;
    }
    this.update({
      isEditingName: true,
      pendingName: this.thread.name,
    });
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
      this.update({
        isEditingName: false,
        pendingName: "",
      });
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
    this.update({
      isEditingName: false,
      pendingName: "",
    });
  }
}

LLMChatThreadHeaderView.register();