/** @odoo-module **/

import { Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { useState } from "@odoo/owl";

export class LLMChatSidebar extends Component {

  static template = "llm_thread.LLMChatSidebar";
  static props = {
    record: { type: Object, optional: true },
  };

  setup() {
    super.setup();

    this.messaging = useState(useService("mail.messaging"));
  }

  /**
   * @returns {LLMChatView}
   */
  get llmChatView() {
    return this.props.record;
  }

  /**
   * Handle backdrop click to close sidebar on mobile
   */
  _onBackdropClick() {
    if (this.messaging.device.isSmall) {
      this.llmChatView.update({ isThreadListVisible: false });
    }
  }

  /**
   * Handle click on New Chat button
   */
  async _onClickNewChat() {
    const llmChat = this.llmChatView.llmChat;
    await llmChat.createNewThread();
    this.llmChatView.update({ isThreadListVisible: false });
  }
}
