/** @odoo-module **/

import { LLMChatService } from "@llm_thread/services/llm_chat_service";
import { patch } from "@web/core/utils/patch";

console.log("LLM Assistant: Loading chat service extension");

patch(LLMChatService, {
    dependencies: [...LLMChatService.dependencies, "llm_assistant"],

    start(env, services) {
        const originalService = super.start(env, services);
        const llmAssistantService = services.llm_assistant;

        console.log("LLM Assistant: Extended service started");

        return {
            ...originalService,

            /**
             * Override initialization to load assistants
             */
            async initializeLLMChat(action, initActiveId, postInitializationPromises = []) {
                console.log("LLM Assistant: Extended initializeLLMChat called");

                // Add assistant loading to initialization promises
                const assistantLoadPromise = llmAssistantService.loadAssistants();

                return originalService.initializeLLMChat(
                    action,
                    initActiveId,
                    [...postInitializationPromises, assistantLoadPromise]
                );
            },

            /**
             * Override thread mapping to include assistant data
             */
            _mapThreadDataFromServer(threadData) {
                console.log("LLM Assistant: Extended _mapThreadDataFromServer called");
                const mappedData = originalService._mapThreadDataFromServer(threadData);

                // Add assistant information
                if (threadData.assistant_id) {
                    if (Array.isArray(threadData.assistant_id)) {
                        mappedData.assistantId = threadData.assistant_id[0];
                        mappedData.assistantName = threadData.assistant_id[1];
                    } else {
                        mappedData.assistantId = threadData.assistant_id;
                    }
                    mappedData.assistant = llmAssistantService.getAssistant(mappedData.assistantId);
                } else {
                    // Clear assistant data when assistant_id is false/null
                    mappedData.assistantId = null;
                    mappedData.assistantName = null;
                    mappedData.assistant = null;
                }

                return mappedData;
            },

            /**
             * Override loadThreads to include assistant_id field
             */
            async loadThreads(additionalFields = []) {
                console.log("LLM Assistant: Extended loadThreads called");
                const extendedFields = [...additionalFields, "assistant_id"];
                return originalService.loadThreads(extendedFields);
            },

            /**
             * Override refreshThread to include assistant_id field
             */
            async refreshThread(threadId, additionalFields = []) {
                console.log("LLM Assistant: Extended refreshThread called for thread:", threadId);
                const extendedFields = [...additionalFields, "assistant_id"];
                return originalService.refreshThread(threadId, extendedFields);
            },

            /**
             * Get all available assistants
             */
            getAssistants() {
                return llmAssistantService.assistants;
            },

            /**
             * Update thread assistant
             */
            async updateThreadAssistant(threadId, assistantId) {
                const result = await llmAssistantService.setThreadAssistant(threadId, assistantId);

                if (result.success) {
                    // Refresh the thread to get updated data
                    await this.refreshThread(threadId);
                }

                return result;
            },
        };
    },
});

console.log("LLM Assistant: Chat service extension loaded");
