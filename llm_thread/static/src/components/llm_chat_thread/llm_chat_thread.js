/** @odoo-module **/

const { Component } = owl;

export class LLMChatThread extends Component {
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
};
