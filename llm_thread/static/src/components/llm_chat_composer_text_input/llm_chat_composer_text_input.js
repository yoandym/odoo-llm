/** @odoo-module **/

import { Component, useState, useRef, onMounted } from "@odoo/owl";
import { useAutoresize } from "@web/core/utils/autoresize";

/**
 * LLMChatComposerTextInput Component for Odoo v17
 * 
 * This component provides the text input field for the LLM composer.
 * It handles text input, auto-resizing, and keyboard shortcuts.
 */
export class LLMChatComposerTextInput extends Component {
    static template = "llm_thread.LLMChatComposerTextInput";
    static props = {
        value: { type: String, optional: true },
        placeholder: { type: String, optional: true },
        disabled: { type: Boolean, optional: true },
        onValueChange: { type: Function },
        onKeydown: { type: Function },
        className: { type: String, optional: true },
        maxHeight: { type: Number, optional: true },
        onRef: { type: Function, optional: true },
    };
    static defaultProps = {
        value: "",
        placeholder: "",
        disabled: false,
        maxHeight: 200,
    };

    setup() {
        // Refs
        this.textareaRef = useRef("textarea");

        // State
        this.state = useState({
            isFocused: false,
            hasSelection: false,
        });

        // Auto-resize functionality
        if (this.textareaRef.el) {
            useAutoresize(this.textareaRef, {
                maxHeight: this.props.maxHeight
            });
        }

        // Focus on mount
        onMounted(() => {
            this.focus();
            // Expose focus method to parent via callback
            if (this.props.onRef) {
                const self = this;
                this.props.onRef({
                    focus: () => this.focus(),
                    get el() { return self.textareaRef.el; }
                });
            }
        });
    }

    /**
     * Get the textarea element
     */
    get textareaEl() {
        return this.textareaRef.el;
    }

    /**
     * Get container classes
     */
    get containerClass() {
        const classes = ["o_LLMChatComposerTextInput", "form-control"];
        if (this.props.className) {
            classes.push(this.props.className);
        }
        if (this.state.isFocused) {
            classes.push("o-focused");
        }
        if (this.props.disabled) {
            classes.push("o-disabled");
        }
        return classes.join(" ");
    }

    /**
     * Handle input event
     */
    onInput(ev) {
        const newValue = ev.target.value;
        this.props.onValueChange(newValue);
    }

    /**
     * Handle keydown event
     */
    onKeydown(ev) {
        // Check for selection
        this.updateSelectionState();

        // Call parent handler
        if (this.props.onKeydown) {
            this.props.onKeydown(ev);
        }

        // Handle tab for indentation
        if (ev.key === "Tab" && !ev.ctrlKey && !ev.metaKey) {
            ev.preventDefault();
            this.insertTab();
        }
    }

    /**
     * Handle focus event
     */
    onFocus() {
        this.state.isFocused = true;
    }

    /**
     * Handle blur event
     */
    onBlur() {
        this.state.isFocused = false;
        this.state.hasSelection = false;
    }

    /**
     * Focus the textarea
     */
    focus() {
        if (this.textareaEl && !this.props.disabled) {
            this.textareaEl.focus();
        }
    }

    /**
     * Insert a tab character at cursor position
     */
    insertTab() {
        if (!this.textareaEl || this.props.disabled) return;

        const start = this.textareaEl.selectionStart;
        const end = this.textareaEl.selectionEnd;
        const value = this.props.value;

        // Insert tab
        const newValue = value.substring(0, start) + "\t" + value.substring(end);
        this.props.onValueChange(newValue);

        // Restore cursor position after React re-render
        setTimeout(() => {
            this.textareaEl.selectionStart = this.textareaEl.selectionEnd = start + 1;
        }, 0);
    }

    /**
     * Update selection state
     */
    updateSelectionState() {
        if (!this.textareaEl) return;

        const hasSelection = this.textareaEl.selectionStart !== this.textareaEl.selectionEnd;
        if (this.state.hasSelection !== hasSelection) {
            this.state.hasSelection = hasSelection;
        }
    }

    /**
     * Get the current selection
     */
    getSelection() {
        if (!this.textareaEl) return { start: 0, end: 0, text: "" };

        const start = this.textareaEl.selectionStart;
        const end = this.textareaEl.selectionEnd;
        const text = this.props.value.substring(start, end);

        return { start, end, text };
    }

    /**
     * Set cursor position
     */
    setCursorPosition(position) {
        if (!this.textareaEl) return;

        this.textareaEl.selectionStart = this.textareaEl.selectionEnd = position;
        this.textareaEl.focus();
    }

    /**
     * Insert text at cursor position
     */
    insertText(text) {
        if (!this.textareaEl || this.props.disabled) return;

        const start = this.textareaEl.selectionStart;
        const end = this.textareaEl.selectionEnd;
        const value = this.props.value;

        const newValue = value.substring(0, start) + text + value.substring(end);
        this.props.onValueChange(newValue);

        // Set cursor after inserted text
        setTimeout(() => {
            const newPosition = start + text.length;
            this.setCursorPosition(newPosition);
        }, 0);
    }
}