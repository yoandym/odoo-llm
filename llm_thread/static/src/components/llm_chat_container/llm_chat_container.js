/** @odoo-module **/


import { LLMChat } from "../llm_chat/llm_chat";

import { useService } from "@web/core/utils/hooks";
import { Component, onWillDestroy, useState } from "@odoo/owl";

export class LLMChatContainer extends Component {

  static template = "llm_thread.LLMChatContainer";
  static components = { LLMChat };
  static props = {
    action: Object,
    actionId: { type: Number, optional: true },
    className: String,
    globalState: { type: Object, optional: true },
  };

  setup() {
    super.setup();

    this.messaging = useState(useService("mail.messaging"));

    onWillDestroy(() => this._willDestroy());

    this.env.services.messaging.modelManager.messagingCreatedPromise.then(
      async () => {
        const { action } = this.props;
        const initActiveId =
          (action.context && action.context.active_id) ||
          (action.params && action.params.default_active_id) ||
          null;

        if (!this.messaging.llmChat) {
          this.messaging.update({
            llmChat: {
              isInitThreadHandled: false,
            },
          });
        }
        this.llmChat = this.messaging.llmChat;
        this.llmChat.initializeLLMChat(action, initActiveId);
      }
    );

    // Keep track of current instance to handle cleanup
    LLMChatContainer.currentInstance = this;
  }

  get messaging() {
    return this.env.services.messaging.modelManager.messaging;
  }

  _willDestroy() {
    if (this.llmChat && LLMChatContainer.currentInstance === this) {
      this.llmChat.close();
    }
  }
}
