/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { Composer } from "@mail/core/common/composer";
import { useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";


patch(Composer.prototype, {

  setup() {
    super.setup();

    this.messaging = useState(useService("mail.messaging")); 
    this.notification = useService("notification");

    Object.assign(this.state, {
      placeholderLLMChat: this.env._t("Ask anything..."),
      eventSource: null,
      is_streaming: this.eventSource !== null,
    });
  },


  stopLLMThreadLoop() {
    // This should close event source
    this._closeEventSource();
  },

  async postUserMessageForLLM() {
    const thread = this.thread;

    const messageBody = this.textInputContent.trim();
    if (!messageBody || !thread) {
      this.notification.add(
        this.env._t("Please enter a message."), {
        title: this.env._t("Error"),
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
            this.notification.add(data.error, {
              title: this.env._t("Error"),
              type: "danger",
            });
            break;
          case "done": {
            const sameThread =
              this.thread.id === this.thread.llmChat.activeThread.id;
            if (!sameThread) {
              this.notification.add(
                this.env._t("Generation completed for ") +
                this.thread.displayName,
                {
                  title: this.env._t("Success"),
                  type: "success",
                }
              );
            }
            this._closeEventSource();
            break;
          }
        }
      };
      eventSource.onerror = (error) => {
        console.error("EventSource failed:", error);
        this.notification.add(
          this.env._t("An unknown error occurred."),
          {
            title: this.env._t("Error"),
            type: "danger",
          }
        );
        this._closeEventSource();
      };
    } catch (error) {
      console.error("Error sending LLM message:", error);
      this.notification.add(
        this.env._t("Failed to send message: "),
        {
          title: this.env._t("Error"),
          type: "danger",
        }
      );
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
  }
});

