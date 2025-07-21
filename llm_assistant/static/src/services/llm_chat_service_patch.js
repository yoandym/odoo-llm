/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { LLMChatService, THREAD_SEARCH_FIELDS as BASE_THREAD_SEARCH_FIELDS } from "../../../../llm_thread/static/src/services/llm_chat_service.js";

/**
 * Patch for LLMChatService to add assistant functionality
 * Moves all assistant logic into the main chat service following Odoo v17 extension patterns
 */

// Extend THREAD_SEARCH_FIELDS to include assistant_id
export const THREAD_SEARCH_FIELDS = [...BASE_THREAD_SEARCH_FIELDS, "assistant_id"];

const assistantCache = new Map();

function patchLLMChatService() {
    // Patch the start method to add assistant state and methods
    const originalStart = LLMChatService.start;
    LLMChatService.start = function(env, deps) {
        const llmChat = originalStart.call(this, env, deps);

        // Add assistant state
        llmChat.assistants = [];
        llmChat.isLoaded = false;

        // Add assistant methods
        llmChat.loadAssistants = async function() {
            try {
                const assistantResult = await deps.orm.searchRead(
                    "llm.assistant",
                    [["active", "=", true]],
                    ["name", "default_values", "prompt_id"],
                    { order: "name" }
                );
                const promptIds = assistantResult
                    .map(assistant => assistant.prompt_id && assistant.prompt_id[0])
                    .filter(Boolean);
                let promptsById = {};
                if (promptIds.length > 0) {
                    const promptResult = await deps.orm.searchRead(
                        "llm.prompt",
                        [["id", "in", promptIds]],
                        ["name"]
                    );
                    promptsById = promptResult.reduce((acc, prompt) => {
                        acc[prompt.id] = {
                            id: prompt.id,
                            name: prompt.name,
                        };
                        return acc;
                    }, {});
                }
                const assistants = assistantResult.map(assistant => {
                    const data = {
                        id: assistant.id,
                        name: assistant.name,
                        defaultValues: assistant.default_values,
                    };
                    if (assistant.prompt_id && assistant.prompt_id[0]) {
                        const promptId = assistant.prompt_id[0];
                        data.promptId = promptId;
                        data.llmPrompt = promptsById[promptId] || null;
                    }
                    return data;
                });
                llmChat.assistants = assistants;
                llmChat.isLoaded = true;
                assistants.forEach(assistant => {
                    assistantCache.set(assistant.id, assistant);
                });
                return assistants;
            } catch (error) {
                console.error("LLM Assistant Patch: Failed to load assistants:", error);
                deps.notification.add(
                    _t("Failed to load assistants"),
                    { type: "danger" }
                );
                throw error;
            }
        };

        llmChat.getAssistant = function(assistantId) {
            return assistantCache.get(assistantId) || null;
        };

        llmChat.setThreadAssistant = async function(threadId, assistantId) {
            try {
                const result = await deps.rpc("/llm/thread/set_assistant", {
                    thread_id: threadId,
                    assistant_id: assistantId,
                });

                return result;
            } catch (error) {
                console.error("LLM Assistant Patch: Failed to set thread assistant:", error);
                throw error;
            }
        };

        llmChat.clearAssistantCache = function() {
            llmChat.assistants = [];
            llmChat.isLoaded = false;
            assistantCache.clear();
        };

        // Bus event listeners for assistant integration
        env.bus.addEventListener("llm_chat:initializing", (event) => {
            // Only push loadAssistants to postInitializationPromises
            event.detail.promises.push(llmChat.loadAssistants());
        });

        // Add event listener to extend the fields for loadThreads
        env.bus.addEventListener("llm_chat:extend_load_fields", (event) => {
            if (event.detail && event.detail.fields && Array.isArray(event.detail.fields)) {
                // Add assistant_id to the fields if it's not already there
                if (!event.detail.fields.includes("assistant_id")) {
                    event.detail.fields.push("assistant_id");
                }
            }
        });

        env.bus.addEventListener("llm_chat:map_thread_data", (event) => {
            const { threadData, mappedData } = event.detail;
            if (threadData.assistant_id) {
                if (Array.isArray(threadData.assistant_id)) {
                    mappedData.assistantId = threadData.assistant_id[0];
                    mappedData.assistantName = threadData.assistant_id[1];
                } else {
                    mappedData.assistantId = threadData.assistant_id;
                }
                mappedData.assistant = llmChat.getAssistant(mappedData.assistantId);
            } else {
                mappedData.assistantId = null;
                mappedData.assistantName = null;
                mappedData.assistant = null;
            }
        });

        return llmChat;
    };
}

patchLLMChatService();

// No registry call needed, patch is applied automatically
