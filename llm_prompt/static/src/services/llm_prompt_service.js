/** @odoo-module **/

import { registry } from "@web/core/registry";
import { reactive } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";

/**
 * LLM Prompt Service for Odoo v17
 * 
 * This service manages prompt templates and their integration with LLM threads.
 * It replaces the old messaging model patch pattern from v16.
 */
export const LLMPromptService = {
    dependencies: ["rpc", "orm", "notification"],

    start(env, { rpc, orm, notification }) {
        // Create a reactive store for prompts
        const store = reactive({
            prompts: [],
            isLoaded: false,
        });

        // Set up event listeners for bus-based integration
        env.bus.addEventListener("llm_chat:initializing", (event) => {
            const promptLoadPromise = service.initialize();
            event.detail.promises.push(promptLoadPromise);
        });

        env.bus.addEventListener("llm_chat:map_thread_data", (event) => {
            const { threadData, mappedData } = event.detail;

            // Add prompt information to mapped data
            if (threadData.prompt_id) {
                if (Array.isArray(threadData.prompt_id)) {
                    mappedData.promptId = threadData.prompt_id[0];
                    mappedData.promptName = threadData.prompt_id[1];
                } else {
                    mappedData.promptId = threadData.prompt_id;
                }
            }
        });

        const service = {
            // Store access
            get prompts() {
                return store.prompts;
            },

            get isLoaded() {
                return store.isLoaded;
            },

            /**
             * Load prompts from the server
             */
            async loadPrompts() {
                if (store.isLoaded) {
                    return store.prompts;
                }

                try {
                    const result = await orm.searchRead(
                        "llm.prompt",
                        [],
                        ["name", "input_schema_json", "description"]
                    );

                    store.prompts = result.map(prompt => ({
                        id: prompt.id,
                        name: prompt.name,
                        description: prompt.description || "",
                        inputSchemaJson: prompt.input_schema_json || "{}",
                    }));

                    store.isLoaded = true;
                    return store.prompts;
                } catch (error) {
                    notification.add(
                        _t("Failed to load prompts"),
                        { type: "danger" }
                    );
                    return [];
                }
            },

            /**
             * Set the prompt for a specific thread
             * @param {number} threadId - The thread ID
             * @param {number|false} promptId - The prompt ID to set, or false to clear
             */
            async setThreadPrompt(threadId, promptId) {
                try {
                    const result = await rpc("/llm/thread/set_prompt", {
                        thread_id: threadId,
                        prompt_id: promptId || false,
                    });

                    if (!result) {
                        throw new Error("Server returned unsuccessful result");
                    }

                    return result;
                } catch (error) {
                    console.error("Failed to set thread prompt:", error);
                    throw error;
                }
            },

            /**
             * Refresh prompts from server
             */
            async refreshPrompts() {
                store.isLoaded = false;
                return this.loadPrompts();
            },

            /**
             * Get a specific prompt by ID
             * @param {number} promptId - The prompt ID
             */
            getPrompt(promptId) {
                return store.prompts.find(p => p.id === promptId) || null;
            },

            /**
             * Initialize the service (called by dependent services)
             */
            async initialize() {
                return this.loadPrompts();
            },
        };

        return service;
    },
};

registry.category("services").add("llm_prompt", LLMPromptService);
