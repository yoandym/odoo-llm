/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { useState, onWillUnmount } from "@odoo/owl";
import { Chatter } from "@mail/core/web/chatter";

patch(Chatter.prototype, {

  setup() {
    super.setup();

    this.messagingService = useService("messaging");
    this.notificationService = useService("notification");

    // add extra is_chatting_with_llm to state
    Object.assign(this.state, {
      is_chatting_with_llm: false,
    });

    onWillStart(async () => {
      await this.messagingService.isReady;
    });

  },

  /**
   * @override
   */
  onClickSendMessage(ev) {
    if (this.state.is_chatting_with_llm) {
      this.toggleLLMChat();
    }
    this._super(ev);
  },

  /**
   * @override
   */
  onClickLogNote(ev) {
    if (this.state.is_chatting_with_llm) {
      this.toggleLLMChat();
    }
    this._super(ev);
  },

  /**
   * @override
   */
  onClickScheduleActivity(ev) {
    if (this.state.is_chatting_with_llm) {
      this.toggleLLMChat();
    }
    this._super(ev);
  },

  /**
   * @override
   */
  onClickButtonAddAttachments(ev) {
    if (this.state.is_chatting_with_llm) {
      this.toggleLLMChat();
    }
    this._super(ev);
  },

  /**
   * @override
   */
  onClickButtonToggleAttachments(ev) {
    if (this.state.is_chatting_with_llm) {
      this.toggleLLMChat();
    }
    this._super(ev);
  },

  /**
   * Toggles LLM chat mode, initializing LLMChat and selecting/creating a thread.
   */
  async toggleLLMChat() {
    if (!this.state.thread) return;

    const messaging = this.messagingService;
    if (this.state.is_chatting_with_llm === true) {
      // Already chatting with LLM
      this.state.is_chatting_with_llm = false;
    } else {
      let llmChat = messaging.llmChat;
      if (!llmChat) {
        messaging.update({ llmChat: { isInitThreadHandled: false } });
        llmChat = messaging.llmChat;
      }
      if (!llmChat.llmChatView) {
        llmChat.open();
      }

      try {
        const thread = await llmChat.ensureThread({
          relatedThreadModel: this.thread.model,
          relatedThreadId: this.thread.id,
        });
        if (!thread) {
          throw new Error("Failed to ensure thread");
        }

        await llmChat.selectThread(thread.id);
        this.state.is_chatting_with_llm = true;
      } catch (error) {
        messaging.notify({
          title: "Failed to Start AI Chat",
          message: error.message || "An error occurred",
          type: "danger",
        });
      }
    }
  },

});
