/** @odoo-module **/

import { AND, Record } from "@mail/core/common/record";

/**
 * Model for LLM Assistant
 */
registerModel({
  name: "LLMAssistant",
  fields: {
    id: attr({
      identifying: true,
    }),
    name: attr(),
    /**
     * Threads associated with this assistant
     */
    threads: many("Thread", {
      inverse: "llmAssistant",
    }),
  },
});
