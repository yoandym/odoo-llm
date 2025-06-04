/** @odoo-module **/

const { Component } = owl;

export class LLMFormFieldsView extends Component {
  static template = "llm_thread.LLMFormFieldsView";
  static props = {
    state: { type: Object, optional: false }, // Pass relevant parts of LLMMediaForm's state
    inputSchema: { type: Object, optional: true },
    formFields: { type: Array, optional: false },
    requiredFields: { type: Array, optional: false },
    optionalFields: { type: Array, optional: false },
    onInputChange: { type: Function, optional: false },
    toggleAdvancedSettings: { type: Function, optional: false },
  };
}
