/** @odoo-module **/

import { useState, onWillStart, onWillUnmount, onMounted, useRef } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { Composer } from "@mail/core/common/composer";

/**
 * LLMChatComposer Component for Odoo v17
 * 
 * This component extends Odoo's mail composer for LLM chat threads.
 * It handles message input, sending, and streaming response states.
 */
export class LLMChatComposer extends Composer {
  static template = "llm_thread.LLMChatComposer";
  static props = [
    ...Composer.props,
    "thread",
    "className?",
    "placeholder?",
    "exposeAPI?",
    "onCustomSendMessage?", // Custom send handler for chatter integration
  ];

  setup() {
    // Ensure composer prop has all required properties before calling super.setup()
    if (!this.props.composer) {
      throw new Error("LLMChatComposer requires a composer prop");
    }

    // Ensure required properties exist
    if (!this.props.composer.selection) {
      this.props.composer.selection = {
        start: 0,
        end: 0,
        direction: "none"
      };
    }

    // Ensure attachments exist
    if (!this.props.composer.attachments) {
      this.props.composer.attachments = [];
    }

    // Ensure other required properties
    if (!this.props.composer.mentionedChannels) {
      this.props.composer.mentionedChannels = [];
    }
    if (!this.props.composer.mentionedPartners) {
      this.props.composer.mentionedPartners = [];
    }

    super.setup();

    // Create ref for textarea
    this.textareaRef = useRef("textarea");

    // LLM-specific services
    this.llmComposerService = useService("llm_composer");
    this.llmChatService = useService("llm_chat");

    // LLM-specific state
    this.llmState = useState({
      isStreaming: false,
      isDisabled: false,
    });

    // Create composer state in LLM service
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

    // Subscribe to LLM events
    this.setupLLMEventListeners();

    // Cleanup
    onWillUnmount(() => {
      this.cleanupLLMEventListeners();
      if (this.llmState.isStreaming) {
        this.llmComposerService.stopStreaming(this.composerState);
      }
    });

    onMounted(() => {
      // Focus on mount if needed
      if (this.props.autofocus) {
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => this.focusTextInput(), 0);
      }
    });
  }

  // Override placeholder
  get placeholder() {
    return this.props.placeholder || _t("Ask anything... (Shift+Enter for new line)");
  }

  // Override thread getter
  get thread() {
    return this.props.thread;
  }

  // Check if send button should be disabled
  get isSendButtonDisabled() {
    return super.isSendButtonDisabled ||
      this.llmState.isDisabled ||
      this.llmState.isStreaming ||
      !this.props.composer.textInputContent.trim();
  }

  // Get container classes
  get containerClass() {
    const classes = ["o_LLMChatComposer"];
    if (this.props.className) {
      classes.push(this.props.className);
    }
    if (this.llmState.isStreaming) {
      classes.push("o-streaming");
    }
    return classes.join(" ");
  }

  /**
   * Setup LLM-specific event listeners
   */
  setupLLMEventListeners() {
    const eventBus = this.llmComposerService.eventBus;

    this.streamingStoppedHandler = (ev) => {
      if (ev.detail.threadId === this.props.thread.id) {
        this.llmState.isStreaming = false;
        this.llmState.isDisabled = false;

        // Focus after streaming stops, but only if component is mounted
        setTimeout(() => {
          if (this.textareaRef.el || this.root?.el) {
            this.focusTextInput();
          }
        }, 100);
      }
    };

    eventBus.addEventListener("streaming-stopped", this.streamingStoppedHandler);
  }

  /**
   * Cleanup LLM event listeners
   */
  cleanupLLMEventListeners() {
    const eventBus = this.llmComposerService.eventBus;
    eventBus.removeEventListener("streaming-stopped", this.streamingStoppedHandler);
  }

  /**
   * Override sendMessage to use custom handler or LLM service
   */
  async sendMessage() {
    const messageBody = this.props.composer.textInputContent.trim();
    if (!messageBody || this.llmState.isStreaming) {
      return;
    }

    // Check if we have a custom send handler (e.g., from chatter)
    if (this.props.onCustomSendMessage) {
      try {
        // Update UI state
        this.llmState.isDisabled = true;
        this.llmState.isStreaming = true;

        // Clear input immediately for better UX
        this.clearTextInput();

        // Use custom handler
        await this.props.onCustomSendMessage();

      } catch (error) {
        // Restore content on error
        this.props.composer.textInputContent = messageBody;
        this.updateTextInputValue(messageBody);
        this.llmState.isDisabled = false;
        this.llmState.isStreaming = false;
        throw error;
      } finally {
        // Reset states after custom handler completes
        this.llmState.isDisabled = false;
        this.llmState.isStreaming = false;
      }
      return;
    }

    // Default LLM service behavior
    // Update UI state
    this.llmState.isDisabled = true;
    this.llmState.isStreaming = true;

    // Store previous content for error recovery
    const previousContent = this.props.composer.textInputContent;

    // Clear input immediately for better UX
    this.clearTextInput();

    try {
      await this.llmComposerService.postUserMessage(
        this.composerState,
        messageBody
      );
    } catch (error) {
      // Restore content on error
      this.props.composer.textInputContent = previousContent;
      this.updateTextInputValue(previousContent);
      this.llmState.isDisabled = false;
      this.llmState.isStreaming = false;

      // Let parent class handle error display if needed
      throw error;
    }
  }

  /**
   * Override onKeydown to handle LLM-specific shortcuts
   */
  onKeydown(ev) {
    // Allow Shift+Enter for new lines, Enter to send
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      if (!this.isSendButtonDisabled) {
        this.sendMessage();
      }
      return;
    }

    // Call parent for other key handling (like suggestions)
    return super.onKeydown(ev);
  }

  /**
   * Handle focus events
   */
  onFocusin(ev) {
    this.props.composer.isFocused = true;
    if (super.onFocusin) {
      return super.onFocusin(ev);
    }
  }

  /**
   * Handle paste events
   */
  onPaste(ev) {
    if (super.onPaste) {
      return super.onPaste(ev);
    }
  }

  /**
   * Handle emoji addition
   */
  onClickAddEmoji(ev) {
    if (super.onClickAddEmoji) {
      return super.onClickAddEmoji(ev);
    }
  }

  /**
   * Handle stop button click for streaming
   */
  onClickStop() {
    this.llmComposerService.stopStreaming(this.composerState);
  }

  /**
   * Focus the text input
   */
  focusTextInput() {
    const textarea = this.getTextareaElement();
    if (textarea && !this.llmState.isDisabled) {
      textarea.focus();
    }
  }

  /**
   * Get the textarea DOM element
   */
  getTextareaElement() {
    // Use the ref first (preferred approach)
    if (this.textareaRef.el) {
      return this.textareaRef.el;
    }

    // Fallback to querySelector if ref is not available
    if (this.root?.el) {
      return this.root.el.querySelector('textarea[t-ref="textarea"]');
    }

    return null;
  }

  /**
   * Clear the text input properly
   */
  clearTextInput() {
    // Clear the reactive property
    this.props.composer.textInputContent = "";

    // Also clear the DOM element directly to ensure it's cleared
    const textarea = this.getTextareaElement();
    if (textarea) {
      textarea.value = "";
      // Trigger input event to ensure any event listeners are notified
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /**
   * Update text input value
   */
  updateTextInputValue(value) {
    // Update the reactive property
    this.props.composer.textInputContent = value;

    // Also update the DOM element directly
    const textarea = this.getTextareaElement();
    if (textarea) {
      textarea.value = value;
      // Trigger input event to ensure any event listeners are notified
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /**
   * Expose translation function to template
   */
  get _t() {
    return _t;
  }
}