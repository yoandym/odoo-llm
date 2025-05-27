/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class LLMChatThreadList extends Component {

  static template = "llm_thread.LLMChatThreadList";
  static props = {
    record: { type: Object, optional: true },
  };

  setup() {
    super.setup();

    this.messaging = useService("messaging");
    
    this.state = useState({
      isLoading: false,
    });
  }

  /**
   * @returns {LLMChatView}
   */
  get llmChatView() {
    return this.props.record;
  }

  /**
   * @returns {Thread}
   */
  get activeThread() {
    return this.llmChatView.llmChat.activeThread;
  }

  /**
   * Handle thread click
   * @param {Thread} thread
   */
  async _onThreadClick(thread) {
    if (this.state.isLoading) return;

    this.state.isLoading = true;
    try {
      await this.llmChatView.llmChat.selectThread(thread.id);
      this.llmChatView.update({
        isThreadListVisible: false,
      });
    } catch (error) {
      console.error("Error selecting thread:", error);
      this.messaging.notify({
        title: "Error",
        message: "Failed to load thread",
        type: "danger",
      });
    } finally {
      this.state.isLoading = false;
    }
  }
}
