/** @odoo-module **/

const { Component } = owl;

export class LLMChatThread extends Component {
  get threadView() {
    return this.props.threadView;
  }

  /**
   * @returns {Thread}
   */
  get thread() {
    return this.props.record;
  }

  /**
   * @returns {Message[]}
   */
  get messages() {
    // Use ThreadCache's orderedMessages
    return this.thread.cache?.orderedMessages || [];
  }
}

LLMChatThread.template = "llm_thread.LLMChatThread";
LLMChatThread.props = {
  record: { type: Object, optional: true },
  threadView: { type: Object, optional: true },
};
