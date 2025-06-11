/** @odoo-module */

import { Component } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { MarkdownRenderer } from "../components/markdown_renderer/markdown_renderer";

/**
 * Markdown Field Component - Read-only field that renders markdown content
 */
export class MarkdownField extends Component {
    static components = { MarkdownRenderer };

    get value() {
        return this.props.record.data[this.props.name] || "";
    }

    get showCopyButton() {
        const nodeOptions = this.props.nodeOptions || {};
        return nodeOptions.show_copy_button !== false;
    }
}

MarkdownField.template = "web_json_editor.MarkdownField";
MarkdownField.props = {
    ...standardFieldProps,
    nodeOptions: { type: Object, optional: true },
};
MarkdownField.supportedTypes = ["text", "char"];

// Register the field widget
registry.category("fields").add("markdown", {
  component: MarkdownField,
  supportedTypes: ["text", "char"],
  extractProps: ({ attrs, options }) => {
    return {
      nodeOptions: options || {},
    };
  },
  displayName: "MarkdownField",
});
