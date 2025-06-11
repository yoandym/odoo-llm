/** @odoo-module **/

import { LLMChatThreadHeader } from "@llm_thread/components/llm_chat_thread_header/llm_chat_thread_header";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { onMounted } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";


patch(LLMChatThreadHeader.prototype, {
  setup() {
    super.setup();
    this._setupPromptFeatures();
  },

  _setupPromptFeatures() {
    try {
      // Add prompt service
      this.llmPromptService = useService("llm_prompt");

      // Initialize prompt-specific state if not already done
      if (!this.state._promptInitialized) {
        Object.assign(this.state, {
          _promptInitialized: true,
          isLoadingPrompts: false,
        });
      } 

      // Ensure prompts are loaded when component mounts
      onMounted(async () => {
        try {
          if (!this.llmPromptService.isLoaded) {
            this.state.isLoadingPrompts = true;
            await this.llmPromptService.loadPrompts();
          } 
        } catch (error) {
          console.error("[LLM_PROMPT] Error in onMounted:", error);
        } finally {
          this.state.isLoadingPrompts = false;
        }
      });
    } catch (error) {
      console.error("[LLM_PROMPT] Error in _setupPromptFeatures:", error);
    }
  },

  // --------------------------------------------------------------------------
  // Prompt Methods
  // --------------------------------------------------------------------------

  get llmPrompts() {
    return this.llmPromptService.prompts || [];
  },

  get selectedPrompt() {
    if (!this.props.thread?.promptId) {
      return null;
    }
    return this.llmPrompts.find(p => p.id === this.props.thread.promptId) || null;
  },

  async onSelectPrompt(prompt) {
    if (!this.props.thread) return;

    try {
      await this.llmPromptService.setThreadPrompt(this.props.thread.id, prompt.id);
      this.notificationService.add(
        _t("Prompt selected successfully"),
        { type: "success" }
      );
    } catch (error) {
      console.error("Failed to set prompt:", error);
      this.notificationService.add(
        _t("Failed to set prompt. Please try again."),
        { type: "danger" }
      );
    }
  },

  async onClearPrompt() {
    if (!this.props.thread) return;

    try {
      await this.llmPromptService.setThreadPrompt(this.props.thread.id, false);
      this.notificationService.add(
        _t("Prompt cleared successfully"),
        { type: "success" }
      );
    } catch (error) {
      console.error("Failed to clear prompt:", error);
      this.notificationService.add(
        _t("Failed to clear prompt. Please try again."),
        { type: "danger" }
      );
    }
  },
});
