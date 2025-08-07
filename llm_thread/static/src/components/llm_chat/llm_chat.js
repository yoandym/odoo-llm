/** @odoo-module **/

import { Component, useState, onWillStart } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { LLMChatSidebar } from "../llm_chat_sidebar/llm_chat_sidebar";
import { LLMChatThread } from "../llm_chat_thread/llm_chat_thread";

/**
 * LLM Chat Component for Odoo v17
 */
export class LLMChat extends Component {
  static template = "llm_thread.LLMChat";
  static components = { LLMChatSidebar, LLMChatThread };
  static props = {
    initActiveId: { type: [String, Number], optional: true },
  };

  setup() {
    // Use useState to make the service reactive in this component
    this.llmChat = useState(useService("llm_chat"));

    this.actionService = useService("action");

    // Use other necessary services
    this.uiService = useService("ui");
    this.notificationService = useService("notification");

    // Component state - only store component-specific state, not data from service
    this.state = useState({
      isLoading: false,
      isSidebarVisible: !this.uiService.isSmall, // Default open on desktop
    });

    // Initialize on mount
    onWillStart(async () => {
      await this.onWillStart();
    });
  }

  async initialize() {
    this.state.isLoading = true;
    try {
      // Initialize LLM chat if needed
      if (this.props.initActiveId && !this.llmChat.isInitThreadHandled) {
        await this.llmChat.initializeLLMChat(
          { id: null },
          this.props.initActiveId || null
        );
      }
    } catch (error) {
      console.error("Failed to initialize LLM Chat:", error);
      this.notificationService.add(
        _t("Failed to initialize chat"),
        { type: "danger" }
      );
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   * Get active thread directly from reactive service
   */
  get activeThread() {
    const active = this.llmChat.activeThread;
    return active;
  }

  /**
   * Get threads directly from reactive service
   */
  get threads() {
    const threads = this.llmChat.orderedThreads;
    return threads;
  }

  /**
   * Get LLM models directly from reactive service
   */
  get llmModels() {
    return this.llmChat.llmModels;
  }

  /**
   * Get default model directly from reactive service
   */
  get defaultModel() {
    return this.llmChat.defaultLLMModel;
  }

  /**
   * Check if device is mobile
   */
  get isMobile() {
    return this.uiService.isSmall;
  }

  /**
   * Toggle sidebar visibility (mainly for mobile)
   */
  toggleSidebar() {
    this.state.isSidebarVisible = !this.state.isSidebarVisible;
  }

  /**
   * Close sidebar (mobile)
   */
  closeSidebar() {
    this.state.isSidebarVisible = false;
  }

  /**
   * Open sidebar (mobile)
   */
  openSidebar() {
    this.state.isSidebarVisible = true;
  }

  async onWillStart() {
    // Ensure the LLM chat is initialized before rendering
    if (!this.llmChat.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Handle thread selection from sidebar
   * Since the thread list already calls selectThread on the service,
   * this is just for UI actions like closing the sidebar
   */
  onThreadSelected(thread) {

    // Close sidebar on mobile
    if (this.isMobile) {
      this.closeSidebar();
    }
  }

  async onCreateNewThread() {
    const name = _t("New Chat %s", new Date().toLocaleString());
    const thread = await this.llmChat.createThread({ name });
    await this.llmChat.selectThread(thread.id);
  }

  async onRefreshThread(threadId) {
    await this.llmChat.refreshThread(threadId);
  }

  async onOpenThread(thread) {
    await this.actionService.doAction("llm_thread.action_llm_chat", {
      name: _t("Chat"),
      active_id: this.llmChat.threadToActiveId(thread), 
      clearBreadcrumbs: false,
    });
  }
}