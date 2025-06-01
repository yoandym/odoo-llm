/** @odoo-module **/

import { Component, useState, onWillStart, useExternalListener } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { LLMChatSidebar } from "../llm_chat_sidebar/llm_chat_sidebar";
import { LLMChatThread } from "../llm_chat_thread/llm_chat_thread";

/**
 * LLM Chat Component for Odoo v17
 * Uses the new / migrated llm_chat service
 */
export class LLMChat extends Component {
  static template = "llm_thread.LLMChat";
  static components = { LLMChatSidebar, LLMChatThread };
  static props = {
    initActiveId: { type: [String, Number], optional: true },
  };

  setup() {
    // Use the LLM chat service
    this.llmChatService = useService("llm_chat");
    // Use other necessary services
    this.uiService = useService("ui");
    this.notificationService = useService("notification");

    // Access the reactive llmChat store
    this.llmChat = this.llmChatService;

    // Component state
    this.state = useState({
      isLoading: false,
      isSidebarVisible: !this.uiService.isSmall, // Default open on desktop
      // Track active thread ID locally to force updates
      activeThreadId: this.llmChat.activeThread?.id || null,
    });

    // Listen for thread changes using a custom event
    useExternalListener(window, "llm-thread-changed", (ev) => {
      console.log("LLMChat: Thread changed event received", ev.detail);
      this.state.activeThreadId = ev.detail.threadId;
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

  get activeThread() {
    // First try to get from the service's activeThread
    const serviceActiveThread = this.llmChat.activeThread;

    // If service has an active thread, use it and update local state
    if (serviceActiveThread && serviceActiveThread.id !== this.state.activeThreadId) {
      this.state.activeThreadId = serviceActiveThread.id;
    }

    // Use service active thread as primary source
    if (serviceActiveThread) {
      console.log("LLMChat: Active thread from service", serviceActiveThread.id, serviceActiveThread.name);
      return serviceActiveThread;
    }

    // Fallback: use state.activeThreadId to find thread
    if (this.state.activeThreadId) {
      const thread = this.llmChat.threads.find(t => t.id === this.state.activeThreadId);
      console.log("LLMChat: Active thread from state", thread?.id, thread?.name);
      return thread || null;
    }

    return null;
  }

  get threads() {
    return this.llmChat.orderedThreads;
  }

  get llmModels() {
    return this.llmChat.llmModels;
  }

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

    // Set initial active thread ID
    if (this.llmChat.activeThread) {
      this.state.activeThreadId = this.llmChat.activeThread.id;
    }
  }

  /**
   * Handle thread selection from sidebar
   * Since the thread list already calls selectThread on the service,
   * this is just for UI actions like closing the sidebar
   */
  onThreadSelected(thread) {
    console.log("LLMChat: Thread selected callback", thread.id);

    // Update local state to ensure reactivity
    this.state.activeThreadId = thread.id;

    // Close sidebar on mobile
    if (this.isMobile) {
      this.closeSidebar();
    }
  }

  async onCreateNewThread() {
    await this.llmChat.createNewThread();
  }

  async onRefreshThread(threadId) {
    await this.llmChat.refreshThread(threadId);
  }

  async onOpenThread(thread) {
    await this.llmChat.openThread(thread);
  }
}