/** @odoo-module **/

import { LLMChatService } from "@llm_thread/services/llm_chat_service";
import { patch } from "@web/core/utils/patch";

patch(LLMChatService, {
    dependencies: [...LLMChatService.dependencies, "llm_prompt"],

    start(env, services) {
        const originalService = super.start(env, services);
        const llmPromptService = services.llm_prompt;

        return {
            ...originalService,

            /**
             * Override initialization to load prompts
             */
            async initializeLLMChat(action, initActiveId, postInitializationPromises = []) {
                // Add prompt loading to initialization promises
                const promptLoadPromise = llmPromptService.initialize();

                return originalService.initializeLLMChat(
                    action,
                    initActiveId,
                    [...postInitializationPromises, promptLoadPromise]
                );
            },

            /**
             * Override thread mapping to include prompt data
             */
            _mapThreadDataFromServer(threadData) {
                const mappedData = originalService._mapThreadDataFromServer(threadData);

                // Add prompt_id if present
                if (threadData.prompt_id) {
                    if (Array.isArray(threadData.prompt_id)) {
                        mappedData.promptId = threadData.prompt_id[0];
                        mappedData.promptName = threadData.prompt_id[1];
                    } else {
                        mappedData.promptId = threadData.prompt_id;
                    }
                }

                return mappedData;
            },

            /**
             * Override loadThreads to include prompt_id field
             */
            async loadThreads(additionalFields = []) {
                const extendedFields = [...additionalFields, "prompt_id"];
                return originalService.loadThreads(extendedFields);
            },

            /**
             * Override refreshThread to include prompt_id field
             */
            async refreshThread(threadId, additionalFields = []) {
                const extendedFields = [...additionalFields, "prompt_id"];
                return originalService.refreshThread(threadId, extendedFields);
            },
        };
    },
});
