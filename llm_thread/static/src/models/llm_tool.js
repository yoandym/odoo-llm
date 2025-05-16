/** @odoo-module **/

import { Record } from "@mail/core/common/record";

export class LLMTool extends Record {
  static id = "id";
  /** @type {Object.<number, import("models").LLMTool>} */
  static name = Record.attr({
    required: true,
  });
  /** @type {Object.<number, import("models").LLMTool>} */
  static records = {};
  /** @returns {import("models").LLMTool} */
  static get(data) {
    return super.get(data);
  }
  /** @returns {import("models").LLMTool|import("models").LLMTool[]} */
  static insert(data) {
    return super.insert(...arguments);
  }
  static new(data) {
    /** @type {import("models").LLMTool} */
    const llmTool = super.new(data);
    Record.onChange(llmTool, ["name"], () => {
      if (!llmTool.name) {
        llmTool.name = llmTool.llmProvider?.name || "";
      }
    });
    return llmTool;
  }
}

LLMTool.register();