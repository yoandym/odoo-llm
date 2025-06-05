/** @odoo-module **/

import { LLMChatThreadHeader } from "@llm_thread/components/llm_chat_thread_header/llm_chat_thread_header";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { onMounted } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";

// Re-enabling patch to test if it causes the issue
console.log("[LLM_PROMPT] Patch file loaded, re-enabling patch for testing");

patch(LLMChatThreadHeader.prototype, {
  setup() {
    console.log("[LLM_PROMPT] Starting setup patch");
    super.setup();
    console.log("[LLM_PROMPT] Super setup completed, calling _setupPromptFeatures");
    this._setupPromptFeatures();
    console.log("[LLM_PROMPT] Setup patch completed");
  },

  _setupPromptFeatures() {
    console.log("[LLM_PROMPT] _setupPromptFeatures starting");
    try {
      // Add prompt service
      console.log("[LLM_PROMPT] Getting llm_prompt service");
      this.llmPromptService = useService("llm_prompt");
      console.log("[LLM_PROMPT] Got llm_prompt service:", this.llmPromptService);

      // Initialize prompt-specific state if not already done
      if (!this.state._promptInitialized) {
        console.log("[LLM_PROMPT] Initializing prompt state");
        Object.assign(this.state, {
          _promptInitialized: true,
          isLoadingPrompts: false,
        });
        console.log("[LLM_PROMPT] Prompt state initialized");
      } else {
        console.log("[LLM_PROMPT] Prompt state already initialized");
      }

      // Ensure prompts are loaded when component mounts
      console.log("[LLM_PROMPT] Setting up onMounted hook");
      onMounted(async () => {
        console.log("[LLM_PROMPT] onMounted hook executing");
        try {
          if (!this.llmPromptService.isLoaded) {
            console.log("[LLM_PROMPT] Service not loaded, calling loadPrompts");
            this.state.isLoadingPrompts = true;
            await this.llmPromptService.loadPrompts();
            console.log("[LLM_PROMPT] loadPrompts completed");
          } else {
            console.log("[LLM_PROMPT] Service already loaded");
          }
        } catch (error) {
          console.error("[LLM_PROMPT] Error in onMounted:", error);
        } finally {
          this.state.isLoadingPrompts = false;
        }
        console.log("[LLM_PROMPT] onMounted hook completed");
      });
      console.log("[LLM_PROMPT] onMounted hook setup completed");
    } catch (error) {
      console.error("[LLM_PROMPT] Error in _setupPromptFeatures:", error);
    }
    console.log("[LLM_PROMPT] _setupPromptFeatures completed");
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
