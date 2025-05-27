/** @odoo-module **/

const { Component } = owl;
export class LLMChat extends Component {
  static template = "llm_thread.LLMChat";
  static props = {
    record: { type: Object, optional: true },
  };

  /**
   * @returns {LLMChatView}
   */
  get llmChatView() {
    return this.props.record;
  }
}

