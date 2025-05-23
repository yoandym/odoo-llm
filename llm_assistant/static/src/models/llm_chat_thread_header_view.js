/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { Record } from "@mail/core/common/record";
import { LLMChatThreadHeaderView } from "@llm_thread/models/llm_chat_thread_header_view";
import { useState } from "@odoo/owl";


patch(LLMChatThreadHeaderView.prototype, {
  setup() {
    super.setup();
    Object.assign(this.state, {
      selectedAssistantId: null,
    });
  },

  /**
   * Selected assistant record
   */
  selectedAssistant: Record.one("LLMAssistant", {
    compute() {
      if (!this.state.selectedAssistantId) {
        return null;
      }
      // This now searches within a collection of LLMAssistant records
      // and returns a record instance, which is correct.
      const assistants = this.thread?.llmChat?.llmAssistants;
      if (!assistants || !Array.isArray(assistants)) {
        return null;
      }
      return (
        assistants.find(
          (assistantRecord) =>
            assistantRecord && assistantRecord.id === this.state.selectedAssistantId
        ) || null
      );
    },
  }),

  /**
   * Initialize or reset state based on current thread
   * @override
   * @private
   */
  _initializeState() {
    this._super();
    const currentThread = this.thread;
    if (!currentThread) {
      this.state.selectedAssistantId = null;
      return;
    }

    this.state.selectedAssistantId =
      currentThread.llmAssistant?.id || null;
  },

  /**
   * Save selected assistant to the thread using the dedicated endpoint
   * @param {Number|false} assistantId - ID of the selected assistant or false to clear
   */
  async saveSelectedAssistant(assistantId) {
    if (assistantId === this.state.selectedAssistantId) {
      return;
    }

    // Update the local state immediately for responsive UI
    this.state.selectedAssistantId = assistantId || null;

    // Call the dedicated endpoint to set the assistant
    const result = await this.messaging.rpc({
      route: "/llm/thread/set_assistant",
      params: {
        thread_id: this.thread.id,
        assistant_id: assistantId,
      },
    });

    if (result.success) {
      // Refresh the thread to get updated data
      await this.thread.llmChat.refreshThread(
        this.thread.id
      );
      if (assistantId === false) {
        this.state.selectedAssistantId = null;
      } else {
        this.state.selectedModelId = this.thread.llmModel?.id;
        this.state.selectedProviderId =
          this.thread.llmModel?.llmProvider?.id;
      }
    } else {
      // Revert the local state if the server call failed
      this.state.selectedAssistantId = this.thread.llmAssistant?.id || null;

      // Show error message
      this.messaging.notify({
        type: "warning",
        message: "Failed to update assistant",
      });
    }
  },
});
