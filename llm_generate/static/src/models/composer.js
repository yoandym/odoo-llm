/** @odoo-module **/

import { registerPatch } from "@mail/model/model_core";

registerPatch({
  name: "Composer",
  recordMethods: {
    postUserMediaGenMessageForLLM(inputs) {
      const thread = this.thread;

      const messageBody = inputs.prompt || "Media Generation Request";
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
          `/llm/thread/generate-media?thread_id=${thread.id}` +
            `&message=${encodeURIComponent(messageBody)}` +
            `&generation_inputs=${encodeURIComponent(JSON.stringify(inputs))}`
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
              this.messaging.notify({
                message: data.error,
                type: "danger",
                sticky: true,
              });
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
            message: this.env._t(
              "An unknown error occurred! Disconnected from the server. Please try again later."
            ),
            type: "danger",
            sticky: true,
          });
          this._closeEventSource();
        };
      } catch (error) {
        console.error("Error sending LLM message:", error);
        this.messaging.notify({
          message: this.env._t("Failed to send message, error: ") + error,
          type: "danger",
          sticky: true,
        });
      } finally {
        for (const composerView of this.composerViews) {
          composerView.update({ doFocus: true });
        }
      }
    },
  },
});
