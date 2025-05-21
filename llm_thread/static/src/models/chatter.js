/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { Record } from "@mail/core/common/record";
import { Chatter } from "@mail/core/web/chatter";

patch(Chatter.prototype, {
  setup() {
    super.setup();
    this.is_chatting_with_llm = false;
    this.llmChatThread = Record.one("Thread", {
      compute() {
        if (!this.is_chatting_with_llm || !this.llmChatThread) {
          return null;
        }
        return this.llmChatThread.thread;
      },
    });

  },

  /**
   * @override
   */
  onClickSendMessage(ev) {
    if (this.is_chatting_with_llm) {
      this.toggleLLMChat();
    }
    this._super(ev);
  },
  
  /**
   * @override
   */
  onClickLogNote(ev) {
    if (this.is_chatting_with_llm) {
      this.toggleLLMChat();
    }
    this._super(ev);
  },

  /**
   * @override
   */
  onClickScheduleActivity(ev) {
    if (this.is_chatting_with_llm) {
      this.toggleLLMChat();
    }
    this._super(ev);
  },

  /**
   * @override
   */
  onClickButtonAddAttachments(ev) {
    if (this.is_chatting_with_llm) {
      this.toggleLLMChat();
    }
    this._super(ev);
  },
  
  /**
   * @override
   */
  onClickButtonToggleAttachments(ev) {
    if (this.is_chatting_with_llm) {
      this.toggleLLMChat();
    }
    this._super(ev);
  },

  /**
   * Toggles LLM chat mode, initializing LLMChat and selecting/creating a thread.
   */
  async toggleLLMChat() {
    if (!this.thread) return;

    const messaging = this.messaging;
    if (this.is_chatting_with_llm === true) {
      // Already chatting with LLM
      this.update({ is_chatting_with_llm: false });
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
        this.update({ is_chatting_with_llm: true });
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
