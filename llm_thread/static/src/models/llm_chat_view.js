/** @odoo-module **/

import { Record } from "@mail/core/common/record";
import { useEffect } from "@odoo/owl";

export class LLMChatView extends Record {

  setup() {
    super.setup();

    this.update({
      isThreadListVisible: !this.messaging.device.isSmall,
    });

    useEffect(
      () => {
        this._onLLMChatActiveThreadChanged();
      },
      () => [this.llmChat?.activeThread?.id]
    );

  }

  /**
   * @private
   */
  _onLLMChatActiveThreadChanged() {
    this.env.services.router.pushState({
      action: this.llmChat.llmChatView.actionId,
      active_id: this.llmChat.activeId,
    });
  }

  actionId = Record.attr();
  isThreadListVisible = Record.attr({
    default: true,
  });
  llmChat = Record.one("LLMChat", {
    inverse: "llmChatView",
    required: true,
  });
  isActive = Record.attr({
    compute() {
      return Boolean(this.llmChat);
    },
  });
  thread = Record.one("Thread", {
    compute() {
      return this.llmChat.activeThread;
    },
  });
  threadViewer = Record.one("ThreadViewer", {
    compute() {
      if (!this.llmChat.activeThread) {
        return null;
      }
      return {
        hasThreadView: true,
        thread: this.llmChat.activeThread,
        threadCache: this.llmChat.threadCache,
      };
    },
  });
  threadView = Record.one("ThreadView", {
    compute() {
      if (!this.threadViewer) {
        return null;
      }
      return {
        threadViewer: this.threadViewer,
        messageListView: {},
        llmChatThreadHeaderView: {},
      };
    },
  });
  composer = Record.one("Composer", {
    compute() {
      if (!this.threadViewer) {
        return null;
      }
      return { thread: this.threadViewer.thread };
    },
  });


}

LLMChatView.register();