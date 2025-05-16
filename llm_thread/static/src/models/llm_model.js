/** @odoo-module **/

import { Record } from "@mail/core/common/record";

export class LLMModel extends Record {
  id = Record.attr({ identifying: true });
  name = Record.attr({required: true});

  llmProvider = Record.one("LLMProvider", {
    inverse: "llmModels",
  });
  threads = Record.many("Thread", {
    inverse: "llmModel",
  });
  default = Record.attr({
    default: false,
  });
}

LLMModel.register();