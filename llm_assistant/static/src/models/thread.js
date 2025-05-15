/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { Record } from "@mail/core/common/record";
import { Thread } from "@llm_thread/models/thread";
/**
 * Patch the Thread model to add llmAssistant field
 */
patch(Thread, {
  /**
   * The LLM assistant associated with this thread
   */
  llmAssistant: Record.one("LLMAssistant", { inverse: "threads", }),
  /**
   * Override updateLLMChatThreadSettings to handle assistant
   * @override
   * @param {Object} settings - Settings object
   * @param {Number|false} [settings.assistantId] - Assistant ID to set, or false to clear
   */
  async updateLLMChatThreadSettings(settings = {}) {
    const { assistantId, ...otherSettings } = settings;

    // Prepare additional values for the assistant_id field
    const additionalValues = {};

    // Handle assistant_id if provided
    if (assistantId !== undefined) {
      additionalValues.assistant_id = assistantId || false;
    }

    // Call super with our additional values
    return this._super({
      ...otherSettings,
      additionalValues,
    });
  },
});
