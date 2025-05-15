/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { Composer } from "@mail/core/common/composer_model";

patch(Composer, {
  setup () {
    super.setup();
    this.placeholderLLMChat = this.env._t("Ask anything...");
    this.isSendDisabled = !this.canPostMessage;
    this.eventSource = null;
    this.isStreaming = this.eventSource !== null;
    },

  stopLLMThreadLoop() {
    // This should close event source
    this._closeEventSource();
  },

  async postUserMessageForLLM() {
    const thread = this.thread;

    const messageBody = this.textInputContent.trim();
    if (!messageBody || !thread) {
      this.messaging.notify({
        message: this.env._t("Please enter a message."),
        type: "danger",
      });
      return;
    }

    this._reset();

    try {
      const eventSource = new EventSource(
        `/llm/thread/generate?thread_id=${thread.id}&message=${messageBody}`
      );
      this.update({ eventSource });

      eventSource.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case "message_create":
            this._handleMessageCreate(data.message);
            break;
          case "message_chunk":
            this._handleMessageUpdate(data.message);
            break;
          case "message_update":
            this._handleMessageUpdate(data.message);
            break;
          case "error":
            this._closeEventSource();
            this.messaging.notify({ message: data.error, type: "danger" });
            break;
          case "done": {
            const sameThread =
              this.thread.id === this.thread.llmChat.activeThread.id;
            if (!sameThread) {
              this.messaging.notify({
                message:
                  this.env._t("Generation completed for ") +
                  this.thread.displayName,
                type: "success",
              });
            }
            this._closeEventSource();
            break;
          }
        }
      };
      eventSource.onerror = (error) => {
        console.error("EventSource failed:", error);
        this.messaging.notify({
          message: this.env._t("An unknown error occurred"),
          type: "danger",
        });
        this._closeEventSource();
      };
    } catch (error) {
      console.error("Error sending LLM message:", error);
      this.messaging.notify({
        message: this.env._t("Failed to send message."),
        type: "danger",
      });
    } finally {
      for (const composerView of this.composerViews) {
        composerView.update({ doFocus: true });
      }
    }
  },

  _closeEventSource() {
    if (this.eventSource) {
      this.eventSource.close();
      this.update({ eventSource: null });
    }
  },

  _handleMessageCreate(message) {
    const result = this.messaging.models.Message.insert(
      this.messaging.models.Message.convertData(message)
    );
    return result;
  },

  _handleMessageUpdate(message) {
    const result = this.messaging.models.Message.findFromIdentifyingData({
      id: message.id,
    });
    if (result) {
      result.update(this.messaging.models.Message.convertData(message));
    }
    return result;
  },
});
