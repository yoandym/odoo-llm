/** @odoo-module */

import { Component, onMounted, onWillUnmount, useRef, useEffect } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

/**
 * Simple JSON formatter for display mode
 */
export function formatJSON(value) {
  if (!value) return "{}";
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    console.error("Error formatting JSON:", e);
    return String(value || "{}");
  }
}

/**
 * JSON Editor Field Component
 */
export class JsonEditorField extends Component {
  setup() {
    this.editorRef = useRef("editor");
    this.editor = null;
    this.isInternalChange = false;

    onMounted(() => this.initEditor());
    onWillUnmount(() => this.destroyEditor());
    
    // Watch for external value changes
    useEffect(() => {
      if (this.editor && !this.isInternalChange) {
        this.updateEditorValue();
      }
    }, () => [this.props.record.data[this.props.name]]);
  }

  initEditor() {
    if (!this.editorRef.el) return;

    // Check if JSONEditor is available
    if (typeof JSONEditor === 'undefined') {
      console.error('JSONEditor library is not loaded');
      return;
    }

    // Initialize JSONEditor with options
    const options = {
      mode: this.props.readonly ? "view" : "code",
      modes: this.props.readonly ? ["view", "preview"] : ["code", "tree", "form", "view", "preview"],
      search: true,
      history: !this.props.readonly,
      navigationBar: true,
      statusBar: true,
      mainMenuBar: true,
      readOnly: this.props.readonly,
      onChange: () => {
        if (!this.props.readonly) {
          this.onEditorChange();
        }
      },
    };

    // Apply any additional options from nodeOptions
    const nodeOptions = this.props.nodeOptions || this.props.options || {};
    if (nodeOptions.editor_options) {
      Object.assign(options, nodeOptions.editor_options);
    }

    // Add schema for autocomplete if available
    if (nodeOptions.schema) {
      try {
        options.schema = typeof nodeOptions.schema === "string"
          ? JSON.parse(nodeOptions.schema)
          : nodeOptions.schema;
      } catch (e) {
        console.warn("Invalid JSON schema:", e);
      }
    }

    // Create editor instance
    this.editor = new JSONEditor(this.editorRef.el, options);

    // Set initial value
    this.updateEditorValue();
  }

  updateEditorValue() {
    if (!this.editor) return;
    
    // Get value from record data
    let value = this.props.record.data[this.props.name];
    
    // Handle empty or default values
    if (!value || value === '') {
      value = '{}';
    }
    
    // Parse the value if it's a string
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        this.editor.set(parsed);
      } catch (e) {
        // If parsing fails, try to set as text
        console.warn("Failed to parse JSON, setting as text:", e);
        try {
          this.editor.setText(value);
        } catch (textError) {
          // If that also fails, set empty object
          console.error("Failed to set text, using empty object");
          this.editor.set({});
        }
      }
    } else {
      // Value is already an object
      this.editor.set(value);
    }
  }

  /**
   * Format the value for display mode
   */
  get formattedValue() {
    const value = this.props.record.data[this.props.name];
    return formatJSON(value);
  }

  /**
   * Handle changes from the JSON editor
   */
  onEditorChange() {
    // Prevent recursive updates
    if (this.isInternalChange) return;
    
    this.isInternalChange = true;
    
    try {
      // Try to get JSON value
      const jsonValue = this.editor.get();
      
      // Get field type
      const field = this.props.record.fields[this.props.name];
      const fieldType = field ? field.type : 'text';
      
      let valueToUpdate;
      if (fieldType === "json") {
        // For JSON fields, pass the object directly
        valueToUpdate = jsonValue;
      } else {
        // For text and char fields, convert to a JSON string
        valueToUpdate = JSON.stringify(jsonValue, null, 2);
      }
      
      // Update the field value using the correct method
      this.updateValue(valueToUpdate);
      
    } catch (e) {
      console.error("Error in onEditorChange:", e);
      // If JSON is invalid, try to get text value
      try {
        const textValue = this.editor.getText();
        this.updateValue(textValue);
      } catch (textError) {
        console.error("Error getting editor text value:", textError);
      }
    } finally {
      // Reset the flag after a short delay
      setTimeout(() => {
        this.isInternalChange = false;
      }, 100);
    }
  }

  /**
   * Update the field value in the record
   */
  updateValue(value) {
    // Use the record's update method
    this.props.record.update({ [this.props.name]: value });
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
  nodeOptions: { type: Object, optional: true },
  options: { type: Object, optional: true },
};
JsonEditorField.supportedTypes = ["text", "char", "json"];

// Register the field widget
registry.category("fields").add("json_editor", {
  component: JsonEditorField,
  supportedTypes: ["text", "char", "json"],
  extractProps: ({ attrs, options }) => {
    return {
      nodeOptions: options || {},
      options: options || {},
    };
  },
  displayName: "JsonEditor",
});