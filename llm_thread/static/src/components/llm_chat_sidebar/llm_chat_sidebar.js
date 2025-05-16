/** @odoo-module **/

const { Component } = owl;

export class LLMChatSidebar extends Component {
  setup() {
    super.setup();
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

LLMChatSidebar.template = "llm_thread.LLMChatSidebar";
LLMChatSidebar.props = {
  record: { type: Object, optional: true },
};
