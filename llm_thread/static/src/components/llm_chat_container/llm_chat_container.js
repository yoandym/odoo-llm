/** @odoo-module **/

import { Component, onWillDestroy, onWillStart, useState, xml } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { LLMChat } from "../llm_chat/llm_chat";

/**
 * LLMChatContainer Component for Odoo v17
 * 
 * This is the main container component that initializes the LLM chat
 * when opened as a client action. It handles the initialization of
 * the chat service and renders the main LLMChat component.
 */
export class LLMChatContainer extends Component {
  static template = "llm_thread.LLMChatContainer";
  static components = { LLMChat };
  static props = {
    action: { type: Object },
    actionId: { type: Number, optional: true },
    className: { type: String, optional: true },
  };

  setup() {
    // Services
    this.llmChatService = useService("llm_chat");
    this.userService = useService("user");

    // Direct access to the llmChat store
    this.llmChat = this.llmChatService.llmChat;

    // Component state
    this.state = useState({
      isInitialized: false,
      isInitializing: false,
      error: null,
    });

    // Initialize on mount
    onWillStart(async () => {
      await this.initialize();
    });

    // Cleanup on destroy
    onWillDestroy(() => {
      this.cleanup();
    });

    // Keep track of current instance for cleanup
    LLMChatContainer.currentInstance = this;
  }

  /**
   * Initialize the LLM chat
   */
  async initialize() {
    if (this.state.isInitializing || this.state.isInitialized) {
      return;
    }

    this.state.isInitializing = true;
    this.state.error = null;

    try {
      const { action } = this.props;
      const initActiveId = this.getInitActiveId(action);

      // Initialize the LLM chat with the action context
      await this.llmChat.initializeLLMChat(
        action,
        initActiveId
      );

      this.state.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize LLM chat:", error);
      this.state.error = error.message || "Failed to initialize chat";
    } finally {
      this.state.isInitializing = false;
    }
  }

  /**
   * Extract the initial active ID from the action
   */
  getInitActiveId(action) {
    return (action.context && action.context.active_id) ||
      (action.params && action.params.default_active_id) ||
      undefined;
  }

  /**
   * Get the container class names
   */
  get containerClass() {
    const classes = ["o_LLMChatContainer", "h-100", "d-flex", "flex-column", "o_action"];
    return classes.join(" ");
  }

  /**
   * Check if the chat is ready to display
   */
  get isChatReady() {
    return this.state.isInitialized &&
      !this.state.error &&
      this.llmChat.llmChatView;
  }

  /**
   * Get the initial active ID if it's a valid string or number
   */
  get initActiveId() {
    const value = this.getInitActiveId(this.props.action);
    // Only return if it's a valid string or number
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    return undefined;
  }

  /**
   * Check if we have a valid initial active ID
   */
  get hasInitActiveId() {
    return this.initActiveId !== undefined;
  }

  /**
   * Cleanup when component is destroyed
   */
  cleanup() {
    if (LLMChatContainer.currentInstance === this) {
      this.llmChat.close();
      LLMChatContainer.currentInstance = null;
    }
  }

  /**
   * Retry initialization after error
   */
  async onRetry() {
    await this.initialize();
  }
}