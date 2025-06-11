/** @odoo-module **/

import { registry } from "@web/core/registry";
import { reactive } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";


/**
 * LLM Assistant Service for Odoo v17
 * Manages assistant data and thread-assistant relationships
 */
export const llmAssistantService = {
    dependencies: ["orm", "rpc", "notification"],

    start(env, { orm, rpc, notification }) {
        console.log("LLM Assistant Service: Starting...");

        // Service state
        const state = reactive({
            assistants: [],
            assistantsByThreadId: {},
            isLoaded: false,
        });

        // Assistant cache by ID
        const assistantCache = new Map();

        /**
         * Load all active assistants
         * @returns {Promise<Array>} Array of assistant objects
         */
        async function loadAssistants() {
            console.log("LLM Assistant Service: Loading assistants...");
            try {
                // Fetch assistants with their basic data
                const assistantResult = await orm.searchRead(
                    "llm.assistant",
                    [["active", "=", true]],
                    ["name", "default_values", "prompt_id"],
                    { order: "name" }
                );

                console.log("LLM Assistant Service: Loaded", assistantResult.length, "assistants");

                // Extract prompt IDs
                const promptIds = assistantResult
                    .map(assistant => assistant.prompt_id && assistant.prompt_id[0])
                    .filter(Boolean);

                // Fetch prompt details if needed
                let promptsById = {};
                if (promptIds.length > 0) {
                    const promptResult = await orm.searchRead(
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

                // Map assistant data
                const assistants = assistantResult.map(assistant => {
                    const data = {
                        id: assistant.id,
                        name: assistant.name,
                        defaultValues: assistant.default_values,
                    };

                    // Add prompt data if available
                    if (assistant.prompt_id && assistant.prompt_id[0]) {
                        const promptId = assistant.prompt_id[0];
                        data.promptId = promptId;
                        data.llmPrompt = promptsById[promptId] || null;
                    }

                    return data;
                });

                // Update state and cache
                state.assistants = assistants;
                state.isLoaded = true;

                // Update cache
                assistants.forEach(assistant => {
                    assistantCache.set(assistant.id, assistant);
                });

                return assistants;

            } catch (error) {
                console.error("LLM Assistant Service: Failed to load assistants:", error);
                notification.add(
                    _t("Failed to load assistants"),
                    { type: "danger" }
                );
                throw error;
            }
        }

        /**
         * Get assistant by ID
         * @param {number} assistantId - Assistant ID
         * @returns {Object|null} Assistant object or null
         */
        function getAssistant(assistantId) {
            return assistantCache.get(assistantId) || null;
        }

        /**
         * Set assistant for a thread
         * @param {number} threadId - Thread ID
         * @param {number|false} assistantId - Assistant ID or false to clear
         * @returns {Promise<Object>} Result object
         */
        async function setThreadAssistant(threadId, assistantId) {
            console.log("LLM Assistant Service: Setting assistant", assistantId, "for thread", threadId);
            try {
                const result = await rpc("/llm/thread/set_assistant", {
                    thread_id: threadId,
                    assistant_id: assistantId,
                });

                if (result.success) {
                    // Update cache
                    if (assistantId) {
                        state.assistantsByThreadId[threadId] = assistantId;

                        // Update assistant with evaluated values if provided
                        const assistant = assistantCache.get(assistantId);
                        if (assistant && result.default_values) {
                            Object.assign(assistant, {
                                defaultValues: result.default_values,
                            });
                        }
                    } else {
                        delete state.assistantsByThreadId[threadId];
                    }
                }

                return result;

            } catch (error) {
                console.error("LLM Assistant Service: Failed to set thread assistant:", error);
                throw error;
            }
        }

        /**
         * Get assistant values for a specific thread
         * @param {number} threadId - Thread ID
         * @param {number} assistantId - Assistant ID
         * @returns {Promise<Object|null>} Assistant values or null
         */
        async function getAssistantValuesForThread(threadId, assistantId) {
            try {
                const result = await rpc("/llm/thread/get_assistant_values", {
                    thread_id: threadId,
                    assistant_id: assistantId,
                });

                if (result.success && result.default_values) {
                    return {
                        defaultValues: result.default_values,
                    };
                }

                return null;

            } catch (error) {
                console.error("LLM Assistant Service: Failed to get assistant values:", error);
                return null;
            }
        }

        /**
         * Get assistant for a thread
         * @param {number} threadId - Thread ID
         * @returns {Object|null} Assistant object or null
         */
        function getThreadAssistant(threadId) {
            const assistantId = state.assistantsByThreadId[threadId];
            return assistantId ? getAssistant(assistantId) : null;
        }

        /**
         * Clear all cached data
         */
        function clearCache() {
            state.assistants = [];
            state.assistantsByThreadId = {};
            state.isLoaded = false;
            assistantCache.clear();
        }

        console.log("LLM Assistant Service: Started successfully");

        // Set up event listeners for bus-based integration
        env.bus.addEventListener("llm_chat:initializing", (event) => {
            console.log("LLM Assistant Service: Chat initializing, adding assistant loading promise");
            const assistantLoadPromise = loadAssistants();
            event.detail.promises.push(assistantLoadPromise);
        });

        env.bus.addEventListener("llm_chat:map_thread_data", (event) => {
            const { threadData, mappedData } = event.detail;

            // Add assistant information to mapped data
            if (threadData.assistant_id) {
                if (Array.isArray(threadData.assistant_id)) {
                    mappedData.assistantId = threadData.assistant_id[0];
                    mappedData.assistantName = threadData.assistant_id[1];
                } else {
                    mappedData.assistantId = threadData.assistant_id;
                }
                mappedData.assistant = getAssistant(mappedData.assistantId);
            } else {
                // Clear assistant data when assistant_id is false/null
                mappedData.assistantId = null;
                mappedData.assistantName = null;
                mappedData.assistant = null;
            }
        });

        // Return service interface
        return {
            // State access
            get state() { return state; },

            // Methods
            loadAssistants,
            getAssistant,
            setThreadAssistant,
            getAssistantValuesForThread,
            getThreadAssistant,
            clearCache,

            // Convenience getters
            get assistants() { return state.assistants; },
            get isLoaded() { return state.isLoaded; },
        };
    },
};

// Register the service
registry.category("services").add("llm_assistant", llmAssistantService);
