/** @odoo-module **/

import { Component } from "@odoo/owl";

export class LLMChatThread extends Component {

  static template = "llm_thread.LLMChatThread";
  static props = {
    record: { type: Object, optional: true },
  };

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
