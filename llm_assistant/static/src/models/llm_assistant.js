/** @odoo-module **/

import { Record } from "@mail/core/common/record";

export class LLMAssistant extends FileModelMixin(Record) {

  static id = "id";
  /** @type {Object.<number, import("models").LLMAssistant>} */

  static records = {};
  /** @returns {import("models").LLMAssistant} */

  static get(data) {
    return super.get(data);
  }
  /** @returns {import("models").LLMAssistant|import("models").LLMAssistant[]} */

  static insert(data) {
    return super.insert(...arguments);
  }
  static new(data) {
    /** @type {import("models").LLMAssistant} */
    const llmAssistant = super.new(data);
    return llmAssistant;
  }

  threads = Record.many("Thread", { inverse: "llmAssistant" });
}

LLMAssistant.register();