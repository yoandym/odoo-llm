/** @odoo-module **/

import { Record } from "@mail/core/common/record";

export class LLMProvider extends Record {

  id = Record.attr({
    identifying: true,
  });
  name = Record.attr({
    required: true,
  });

  llmModels = Record.many("LLMModel", {
    inverse: "llmProvider",
  });
}

LLMProvider.register();