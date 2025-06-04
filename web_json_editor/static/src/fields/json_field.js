/** @odoo-module */

import { Component, onMounted, onWillUnmount, useRef } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

/**
 * Simple JSON formatter for display mode
 */
export function formatJSON(value) {
  if (!value) return "";
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    console.error("Error formatting JSON:", e);
    return String(value);
  }
}

/**
 * JSON Editor Field Component
 */
export class JsonEditorField extends Component {
  setup() {
    this.editorRef = useRef("editor");
    this.editor = null;

    onMounted(() => this.initEditor());
    onWillUnmount(() => this.destroyEditor());
  }

  initEditor() {
    if (!this.editorRef.el) return;

    // Initialize JSONEditor with options
    const options = {
      mode: this.props.readonly ? "view" : "code",
      modes: ["code", "view"],
      search: true,
      history: true,
      navigationBar: true,
      statusBar: true,
      mainMenuBar: true,
      onChange: () => {
        if (!this.props.readonly) {
          this.onEditorChange();
        }
      },
    };

    // Apply any additional options from nodeOptions
    if (this.props.nodeOptions) {
      const editorOptions = this.props.nodeOptions.editor_options || {};
      Object.assign(options, editorOptions);
    }

    // Add schema for autocomplete if available
    if (this.props.nodeOptions?.schema) {
      try {
        options.schema =
          typeof this.props.nodeOptions.schema === "string"
            ? JSON.parse(this.props.nodeOptions.schema)
            : this.props.nodeOptions.schema;
      } catch (e) {
        console.warn("Invalid JSON schema:", e);
      }
    }

    // Create editor instance
    this.editor = new JSONEditor(this.editorRef.el, options);

    // Set initial value
    let value = this.props.value;

    if (!value) {
      value = {};
    } else if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch (e) {
        console.warn("Failed to parse JSON string:", e);
        value = {};
      }
    }

    this.editor.set(value);
  }

  /**
   * Format the value for display mode
   */
  formatValue() {
    const value = this.props.value;
    if (!value) return "{}";

    if (typeof value === "string") {
      try {
        // Try to parse if it's a JSON string
        return formatJSON(JSON.parse(value));
      } catch (e) {
        return value;
      }
    }

    return formatJSON(value);
  }

  /**
   * Handle changes from the JSON editor
   */
  onEditorChange() {
    // Get value from JSONEditor as a JavaScript object
    const jsonValue = this.editor.get();

    // Handle different field types
    if (this.props.record.fields[this.props.name].type === "json") {
      // For JSON fields, pass the object directly
      this.props.update(jsonValue);
    } else {
      // For text and char fields, convert to a JSON string
      const stringValue = JSON.stringify(jsonValue);
      this.props.update(stringValue);
    }
  }

  /**
   * Clean up the editor when component is unmounted
   */
  destroyEditor() {
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
  }
}

JsonEditorField.template = "web_json_editor.JsonEditorField";
JsonEditorField.props = {
  ...standardFieldProps,
  readonly: { type: Boolean, optional: true },
};

// Define supported field types
JsonEditorField.supportedFieldTypes = ["text", "char", "json"];

// Register the field widget
registry.category("fields").add("json_editor", JsonEditorField);
