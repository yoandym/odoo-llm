/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { LLMChatThreadList } from "../llm_chat_thread_list/llm_chat_thread_list";

/**
 * LLMChatSidebar Component for Odoo v17
 * 
 * Displays the sidebar with thread list and new chat button.
 * Migrated to use the new llm_chat service instead of messaging models.
 */
export class LLMChatSidebar extends Component {
  static template = "llm_thread.LLMChatSidebar";
  static components = { LLMChatThreadList };
  static props = {
    isVisible: { type: Boolean, optional: true },
    onClose: { type: Function, optional: true },
    onThreadSelect: { type: Function, optional: true }, // Add this prop
  };

  setup() {
    console.log("Sidebar: Component setup called");
    // Use services
    this.llmChatService = useService("llm_chat");
    this.uiService = useService("ui"); // For device detection
    this.notificationService = useService("notification");

    // Direct access to the llmChat store
    this.llmChat = this.llmChatService;
    console.log("Sidebar: Service accessed:", this.llmChat);

    // Component state
    this.state = useState({
      isCreatingThread: false,
    });
    console.log("Sidebar: Setup complete");
  }

  /**
   * Check if device is small (mobile)
   */
  get isMobile() {
    return this.uiService.isSmall;
  }

  /**
   * Get visibility state
   */
  get isVisible() {
    // Use prop if provided, otherwise always visible on desktop
    return this.props.isVisible !== undefined
      ? this.props.isVisible
      : !this.isMobile;
  }

  /**
   * Handle backdrop click to close sidebar on mobile
   */
  onBackdropClick() {
    if (this.isMobile && this.props.onClose) {
      this.props.onClose();
    }
  }

  /**
   * Handle click on New Chat button
   */
  async onClickNewChat() {
    if (this.state.isCreatingThread) return;

    this.state.isCreatingThread = true;
    try {
      console.log("Sidebar: Creating new thread...");
      await this.llmChat.createNewThread();

      // Notify parent component about thread selection
      if (this.props.onThreadSelect && this.llmChat.activeThread) {
        console.log("Sidebar: Calling onThreadSelect callback with:", this.llmChat.activeThread);
        this.props.onThreadSelect(this.llmChat.activeThread);
      }

      // Close sidebar on mobile after creating thread
      if (this.isMobile && this.props.onClose) {
        this.props.onClose();
      }
    } catch (error) {
      console.error("Failed to create new chat:", error);
      this.notificationService.add(
        _t("Failed to create new chat"),
        {
          title: _t("Error"),
          type: "danger"
        }
      );
    } finally {
      this.state.isCreatingThread = false;
    }
  }
}