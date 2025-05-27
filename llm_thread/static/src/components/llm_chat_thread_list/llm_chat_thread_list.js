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

    this.notification = useService("notification");

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
      this.notification.add(
        this.env._t("Failed to load thread"),
        {
          title: this.env._t("Error"),
          type: "danger",
          sticky: true,
        }
      );
    } finally {
      this.state.isLoading = false;
    }
  }
}
