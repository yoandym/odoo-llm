/** @odoo-module **/

import { Component, useState, useRef, onWillStart, onWillUnmount } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { LLMChatComposerTextInput } from "../llm_chat_composer_text_input/llm_chat_composer_text_input";

/**
 * LLMChatComposer Component for Odoo v17
 * 
 * This component provides the message composer interface for LLM chat threads.
 * It handles message input, sending, and streaming response states.
 */
export class LLMChatComposer extends Component {
  static template = "llm_thread.LLMChatComposer";
  static components = { LLMChatComposerTextInput };
  static props = {
    thread: { type: Object },
    className: { type: String, optional: true },
    placeholder: { type: String, optional: true },
    exposeAPI: { type: Function, optional: true }, // Callback to expose API to parent
  };

  setup() {
    // Services
    this.llmComposerService = useService("llm_composer");
    this.llmChatService = useService("llm_chat");

    // Refs
    this.textInputAPI = null;
    
    // State
    this.state = useState({
      textContent: "",
      isDisabled: false,
      isStreaming: false,
      isFocused: false,
    });

    // Create composer state in service
    onWillStart(() => {
      this.composerState = this.llmComposerService.createComposerState(
        this.props.thread.id
      );

      // Expose API to parent
      if (this.props.exposeAPI) {
        this.props.exposeAPI({
          focus: () => this.focusTextInput(),
        });
      }
    });

    // Subscribe to events
    this.setupEventListeners();

    // Cleanup
    onWillUnmount(() => {
      this.cleanupEventListeners();
      if (this.state.isStreaming) {
        this.llmComposerService.stopStreaming(this.composerState);
      }
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const eventBus = this.llmComposerService.eventBus;

    this.streamingStoppedHandler = (ev) => {
      if (ev.detail.threadId === this.props.thread.id) {
        this.state.isStreaming = false;
        this.state.isDisabled = false;

        // Focus after streaming stops
        setTimeout(() => this.focusTextInput(), 100);
      }
    };

    eventBus.addEventListener("streaming-stopped", this.streamingStoppedHandler);
  }

  /**
   * Cleanup event listeners
   */
  cleanupEventListeners() {
    const eventBus = this.llmComposerService.eventBus;
    eventBus.removeEventListener("streaming-stopped", this.streamingStoppedHandler);
  }

  /**
   * Get the placeholder text
   */
  get placeholder() {
    return this.props.placeholder || _t("Ask anything...");
  }

  /**
   * Check if the send button should be disabled
   */
  get isSendDisabled() {
    return !this.state.textContent.trim() ||
      this.state.isDisabled ||
      this.state.isStreaming;
  }

  /**
   * Get container classes
   */
  get containerClass() {
    const classes = ["o_LLMChatComposer"];
    if (this.props.className) {
      classes.push(this.props.className);
    }
    if (this.state.isStreaming) {
      classes.push("o-streaming");
    }
    return classes.join(" ");
  }

  /**
   * Handle text content change
   */
  onTextContentChange(newContent) {
    this.state.textContent = newContent;
    this.composerState.textContent = newContent;
  }

  /**
   * Handle send button click
   */
  async onClickSend() {
    if (this.isSendDisabled) {
      return;
    }

    await this.sendMessage();
  }

  /**
   * Handle stop button click
   */
  onClickStop() {
    this.llmComposerService.stopStreaming(this.composerState);
  }

  /**
   * Send the message
   */
  async sendMessage() {
    const messageBody = this.state.textContent.trim();
    if (!messageBody) {
      return;
    }

    // Update UI state
    this.state.isDisabled = true;
    this.state.isStreaming = true;

    // Clear input
    const previousContent = this.state.textContent;
    this.state.textContent = "";

    try {
      await this.llmComposerService.postUserMessage(
        this.composerState,
        messageBody
      );
    } catch (error) {
      // Restore content on error
      this.state.textContent = previousContent;
      this.state.isDisabled = false;
      this.state.isStreaming = false;
    }
  }

  /**
   * Handle text input API exposure
   */
  onTextInputAPIExposed(api) {
    this.textInputAPI = api;
  }

  /**
   * Focus the text input
   */
  focusTextInput() {
    if (this.textInputAPI && this.textInputAPI.focus) {
      this.textInputAPI.focus();
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  onKeydown(ev) {
    if (ev.key === "Enter" && !ev.shiftKey) {
      if (this.llmComposerService.matchesSendShortcut(ev)) {
        ev.preventDefault();
        if (!this.isSendDisabled) {
          this.sendMessage();
        }
      }
    }
  }

  /**
   * Expose translation function to template
   */
  get _t() {
    return _t;
  }
}