/** @odoo-module **/

const { Component } = owl;
export class LLMChat extends Component {
  // --------------------------------------------------------------------------
  // Public
  // --------------------------------------------------------------------------

  /**
   * @returns {LLMChatView}
   */
  get llmChatView() {
    return this.props.record;
  }
}

LLMChat.template = "llm_thread.LLMChat";
LLMChat.props = {
  record: { type: Object, optional: true },
};

