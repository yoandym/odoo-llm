/** @odoo-module */

import { Component, onMounted, onWillUnmount, useRef, useEffect } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { debounce } from "@web/core/utils/timing";

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
 * Clean JavaScript object literal to valid JSON
 */
function cleanJavaScriptToJSON(str) {
  if (!str || typeof str !== 'string') return str;

  // Remove leading/trailing whitespace
  str = str.trim();

  // Check if wrapped in parentheses like ({"key": "value"})
  if (str.startsWith('(') && str.endsWith(')')) {
    str = str.slice(1, -1).trim();
  }

  // Try to convert JavaScript object literal to JSON
  try {
    // First, try to parse as-is
    JSON.parse(str);
    return str;
  } catch (e) {
    // If that fails, try some common fixes
    try {
      // Replace single quotes with double quotes
      let cleaned = str.replace(/'/g, '"');

      // Handle unquoted keys (basic regex, won't handle all cases)
      cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

      // Test if it's valid now
      JSON.parse(cleaned);
      return cleaned;
    } catch (e2) {
      // Return original if cleaning fails
      return str;
    }
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
    this.lastValidValue = "{}";
    this.isDirty = false;
    this.pendingValue = null;

    // Create debounced save function (wait 1 second after user stops typing)
    this.debouncedSave = debounce(this.saveChanges.bind(this), 1000);

    // Also save on blur/focus loss
    this.saveOnBlur = this.saveChanges.bind(this);

    onMounted(() => this.initEditor());
    onWillUnmount(() => {
      // Save any pending changes before destroying
      if (this.isDirty) {
        this.saveChanges();
      }
      this.destroyEditor();
    });

    // Watch for external value changes
    useEffect(() => {
      if (this.editor && !this.isInternalChange && !this.isDirty) {
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
        if (!this.props.readonly && !this.isInternalChange) {
          this.onEditorChange();
        }
      },
      onError: (err) => {
        console.warn("JSONEditor validation error:", err);
      },
      onModeChange: (newMode, oldMode) => {
        // Save when switching modes
        if (this.isDirty) {
          this.saveChanges();
        }
      },
      onBlur: () => {
        // Save when editor loses focus
        if (this.isDirty) {
          this.saveOnBlur();
        }
      }
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

    // Add blur event listener to the container
    this.editorRef.el.addEventListener('blur', () => {
      if (this.isDirty) {
        setTimeout(() => {
          // Check if focus is still within the editor
          if (!this.editorRef.el.contains(document.activeElement)) {
            this.saveOnBlur();
          }
        }, 100);
      }
    }, true);

    // Set initial value
    this.updateEditorValue();
  }

  updateEditorValue() {
    if (!this.editor) return;

    this.isInternalChange = true;

    // Get value from record data
    let value = this.props.record.data[this.props.name];

    // Handle empty or default values
    if (!value || value === '') {
      value = '{}';
    }

    // Clean the value if it's a string
    if (typeof value === "string") {
      value = cleanJavaScriptToJSON(value);

      try {
        const parsed = JSON.parse(value);
        this.editor.set(parsed);
        this.lastValidValue = value;
      } catch (e) {
        console.warn("Failed to parse JSON, trying as text:", e);
        // Try to set as text in code mode
        try {
          if (this.editor.getMode() !== 'code') {
            this.editor.setMode('code');
          }
          this.editor.setText(value);
        } catch (textError) {
          console.error("Failed to set text, using last valid value");
          try {
            const lastValid = JSON.parse(this.lastValidValue);
            this.editor.set(lastValid);
          } catch (e) {
            this.editor.set({});
          }
        }
      }
    } else {
      // Value is already an object
      this.editor.set(value);
      this.lastValidValue = JSON.stringify(value, null, 2);
    }

    setTimeout(() => {
      this.isInternalChange = false;
    }, 100);
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
    // Mark as dirty
    this.isDirty = true;

    // Store the pending value
    try {
      const mode = this.editor.getMode();

      if (mode === 'code' || mode === 'text') {
        // In code mode, just get the text
        this.pendingValue = this.editor.getText();
      } else {
        // In tree/form mode, get the JSON object
        const jsonValue = this.editor.get();
        this.pendingValue = JSON.stringify(jsonValue, null, 2);
      }
    } catch (e) {
      console.warn("Error getting editor value:", e);
      return;
    }

    // Debounce the save
    this.debouncedSave();
  }

  /**
   * Save changes to the model
   */
  saveChanges() {
    if (!this.isDirty || this.pendingValue === null) return;

    this.isInternalChange = true;

    try {
      let valueToUpdate = this.pendingValue;

      // Validate JSON if possible
      try {
        const parsed = JSON.parse(valueToUpdate);
        // If successful, store the properly formatted JSON
        valueToUpdate = JSON.stringify(parsed, null, 2);
        this.lastValidValue = valueToUpdate;
      } catch (e) {
        // If not valid JSON, still save it but log warning
        console.warn("Saving invalid JSON:", e);
      }

      // Get field type
      const field = this.props.record.fields[this.props.name];
      const fieldType = field ? field.type : 'text';

      // For JSON fields, parse the value
      if (fieldType === "json") {
        try {
          valueToUpdate = JSON.parse(valueToUpdate);
        } catch (e) {
          console.warn("Could not parse JSON for json field:", e);
        }
      }

      // Update the field value
      this.updateValue(valueToUpdate);

      // Reset dirty flag
      this.isDirty = false;
      this.pendingValue = null;

    } catch (e) {
      console.error("Error saving changes:", e);
    } finally {
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