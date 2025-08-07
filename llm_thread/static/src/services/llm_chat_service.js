/** @odoo-module **/

import { registry } from "@web/core/registry";
import { reactive, EventBus } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";

/**
 * Global thread search fields for LLM chat service.
 * Can be patched/extended by other modules if needed.
 * By default, does NOT include assistant_id. Assistant modules should extend this array.
 */
export const THREAD_SEARCH_FIELDS = [
    "name",
    "message_ids",
    "create_uid",
    "create_date",
    "write_date",
    "model_id",
    "provider_id",
    "model",
    "res_id",
    "tool_ids",
    "prompt_id",
];

/**
 * LLM Chat Service for Odoo v17
 * 
 * This service replaces the old messaging patch pattern from v16
 * and provides a centralized service for LLM chat functionality.
 */
export const LLMChatService = {
    dependencies: ["rpc", "user", "action", "notification", "orm"],

    start(env, { rpc, user, action, notification, orm }) {
        
        // Create a reactive store for the LLM chat state
        const store = reactive({
            llmChat: {

                isInitThreadHandled: false,
                initActiveId: null,
                activeThread: null,

                threads: [],
                
                llmModels: [],
                tools: [],  

                threadStates: {}, // Store thread states keyed by thread ID
              
                // Methods
                async initializeLLMChat(actionData, initActiveId, postInitializationPromises = []) {
                    this.initActiveId = initActiveId;

                    // Emit initialization start event for extensions
                    env.bus.trigger("llm_chat:initializing", {
                        actionData,
                        initActiveId,
                        service: this,
                        promises: postInitializationPromises
                    });

                    // Load resources
                    await this.loadLLMModels();
                    await this.loadThreads();
                    await this.loadTools();

                    // Execute additional initialization promises from extensions
                    if (postInitializationPromises.length > 0) {
                        await Promise.all(postInitializationPromises);
                    }

                    // Handle initial thread
                    if (!this.isInitThreadHandled) {
                        this.isInitThreadHandled = true;
                        if (!this.activeThread) {
                            this.openInitThread();
                        }
                    }

                    // Emit initialization complete event
                    env.bus.trigger("llm_chat:initialized", {
                        service: this
                    });
                },

                openInitThread() {
                    if (!this.initActiveId) {
                        if (this.threads.length > 0) {
                            this.selectThread(this.threads[0].id);
                        }
                        return;
                    }

                    const [model, id] = typeof this.initActiveId === "number"
                        ? ["discuss.channel", this.initActiveId]
                        : this.initActiveId.split("_");

                    const thread = this.threads.find(t => t.id === Number(id));

                    if (!thread && this.threads.length > 0) {
                        this.selectThread(this.threads[0].id);
                    } else if (thread) {
                        this.selectThread(thread.id);
                    }
                },

                threadToActiveId(thread) {
                    return `llm.thread_${thread.id}`;
                },
                
                /**
                 * Initialize or retrieve a thread state
                 * @param {string} threadId - The ID of the thread
                 * @returns {Object} - The reactive thread state object
                 */
                getThreadState(threadId) {
                    if (!this.threadStates[threadId]) {
                        // Initialize new thread state if it doesn't exist
                        this.threadStates[threadId] = {
                            threadId,
                            textContent: "",
                            isStreaming: false,
                            eventSource: null,
                        };
                    }
                    
                    return this.threadStates[threadId];
                },

                /**
                 * Reset thread state to initial values
                 * @param {string} threadId - The ID of the thread to reset
                 */
                resetThreadState(threadId) {
                    if (this.threadStates[threadId]) {
                        // Close any active EventSource before resetting
                        if (this.threadStates[threadId].eventSource) {
                            this.threadStates[threadId].eventSource.close();
                        }
                        
                        // Reset to initial state
                        Object.assign(this.threadStates[threadId], {
                            textContent: "",
                            isStreaming: false,
                            eventSource: null,
                        });
                    }
                },

                /**
                 * Post a user message to the LLM
                 */
                async postUserMessage(threadId, messageBody) {
                    if (!messageBody?.trim()) {
                        this.notification.add(
                            _t("Please enter a message."),
                            { type: "danger" }
                        );
                        return;
                    }

                    try {
                        // Create EventSource for streaming
                        const eventSource = new EventSource(
                            `/llm/thread/generate?thread_id=${threadId}&message=${encodeURIComponent(messageBody.trim())}`
                        );

                        Object.assign(this.threadStates[threadId], {
                            textContent: messageBody.trim(),
                            eventSource: eventSource,
                            isStreaming: true,
                        });

                        // Handle incoming messages
                        eventSource.onmessage = (event) => {
                            const data = JSON.parse(event.data);
                            this._handleStreamMessage(threadId, data);
                        };

                        // Handle errors
                        eventSource.onerror = (error) => {
                            console.error("EventSource failed:", error);
                            this.notification.add(
                                _t("An error occurred while generating response"),
                                { type: "danger" }
                            );
                            this.stopStreaming(threadId);
                        };

                    } catch (error) {
                        console.error("Error sending LLM message:", error);
                        this.notification.add(
                            _t("Failed to send message."),
                            { type: "danger" }
                        );
                    }
                },

                /**
                 * Stop the streaming response
                 */
                stopStreaming(threadId) {
                    if (!this.threadStates[threadId]) return;

                    if (this.threadStates[threadId].eventSource) {
                        this.threadStates[threadId].eventSource.close();
                        this.threadStates[threadId].eventSource = null;
                    }
                    Object.assign(this.threadStates[threadId], {
                        isStreaming: false,
                        eventSource: null,
                    });

                    // Emit event for UI updates
                    env.bus.trigger("streaming-stopped", { threadId: threadId });
                },

                /**
                 * Handle incoming stream messages
                 * @private
                 */
                _handleStreamMessage(threadId, data) {
                    switch (data.type) {
                        case "message_create":
                            env.bus.trigger("message-created", {
                                threadId: threadId,
                                message: data.message,
                            });
                            break;

                        case "message_chunk":
                        case "message_update":
                            env.bus.trigger("message-updated", {
                                threadId: threadId,
                                message: data.message,
                            });
                            break;

                        case "error":
                            this.stopStreaming(threadId);
                            this.notification.add(data.error, { type: "danger" });
                            break;

                        case "done":
                            this.stopStreaming(threadId);

                            break;
                    }
                },

                async loadThreads(additionalFields = [], forceReload = false) {
                    // Skip if threads already loaded and not forcing reload
                    if (this.threads.length > 0 && !forceReload) {
                        console.warn("🔍 Threads already loaded, skipping reload");
                        return;
                    }

                    // Allow extensions to add additional fields via event
                    const extendedFields = [...additionalFields];
                    env.bus.trigger("llm_chat:extend_load_fields", {
                        fields: extendedFields,
                        method: 'loadThreads'
                    });

                    const result = await orm.searchRead(
                        "discuss.channel",
                        [["create_uid", "=", user.userId]],
                        [...THREAD_SEARCH_FIELDS, ...extendedFields],
                        { order: "write_date desc" }
                    );

                    this.threads = result.map(thread => this._mapThreadDataFromServer(thread));

                    // Emit threads loaded event
                    env.bus.trigger("llm_chat:threads_loaded", {
                        threads: this.threads,
                        service: this
                    });
                },

                _mapThreadDataFromServer(threadData) {

                    const mappedData = {
                        // basic thread data
                        id: threadData.id,
                        name: threadData.name,
                        creator: threadData.create_uid
                            ? { id: threadData.create_uid[0], name: threadData.create_uid[1] }
                            : undefined,
                        isServerPinned: true,

                        // messages data
                        message_needaction_counter: 0,
                        message_ids: threadData.message_ids || [],

                        // dates
                        create_date: threadData.create_date,
                        updatedAt: threadData.write_date,

                        // linked document
                        model: threadData.model,
                        res_id: threadData.res_id,

                        // llm tools data
                        tool_ids: threadData.tool_ids || [],
                    };

                    // llm data
                    if (threadData.model_id && threadData.provider_id) {
                        mappedData.llmModel = {
                            id: threadData.model_id[0],
                            name: threadData.model_id[1],
                            llmProvider: {
                                id: threadData.provider_id[0],
                                name: threadData.provider_id[1],
                            },
                        };
                    }

                    // llm prompt data
                    if (threadData.prompt_id) {
                        if (Array.isArray(threadData.prompt_id)) {
                            mappedData.promptId = threadData.prompt_id[0];
                            mappedData.promptName = threadData.prompt_id[1];
                        } else {
                            mappedData.promptId = threadData.prompt_id;
                        }
                    }

                    // Allow extensions to map additional data via event
                    env.bus.trigger("llm_chat:map_thread_data", {
                        threadData,
                        mappedData,
                        service: this
                    });

                    return mappedData;
                }, 
                
                async refreshThread(threadId, additionalFields = []) {
                    try {
                        // Allow extensions to add additional fields via event
                        const extendedFields = [...additionalFields];
                        env.bus.trigger("llm_chat:extend_load_fields", {
                            fields: extendedFields,
                            method: 'refreshThread',
                            threadId
                        });

                        const result = await orm.searchRead(
                            "discuss.channel",
                            [["id", "=", threadId]],
                            [...THREAD_SEARCH_FIELDS, ...extendedFields]
                        );

                        if (!result || !result.length) {
                            return;
                        }

                        const mappedThreadData = this._mapThreadDataFromServer(result[0]);
                        const threadIndex = this.threads.findIndex(thread => thread.id === threadId);

                        if (threadIndex !== -1) {
                            // Update the thread in place to maintain reactivity
                            Object.assign(this.threads[threadIndex], mappedThreadData);

                            // If this is the active thread, update it too
                            if (this.activeThread && this.activeThread.id === threadId) {
                                Object.assign(this.activeThread, mappedThreadData);
                            }

                            // Emit thread refreshed event for extensions
                            env.bus.trigger("llm_chat:thread_refreshed", {
                                threadId,
                                thread: this.threads[threadIndex],
                                updatedFields: mappedThreadData,
                                service: this
                            });
                        }
                    } catch (error) {
                        console.error("Error refreshing thread:", error);
                    }
                },

                async selectThread(threadId) {
                    const thread = this.threads.find(t => t.id === threadId);
                    if (thread) {
                        this.activeThread = thread;
                    } else {
                        console.error("Thread not found in threads list");
                    }
                },

                async loadLLMModels() {
                    const result = await orm.searchRead(
                        "llm.model",
                        [],
                        ["name", "id", "provider_id", "default"]
                    );

                    this.llmModels = result.map(model => ({
                        id: model.id,
                        name: model.name,
                        llmProvider: model.provider_id
                            ? { id: model.provider_id[0], name: model.provider_id[1] }
                            : undefined,
                        default: model.default,
                    }));

                },

                async createThread({ name, model, res_id }) {
                    // set minimal thread data, let the backend handle defaults
                    const threadData = {
                        name,
                        llm_enabled: true,
                    };

                    if (model && res_id) {
                        threadData.model = model;
                        threadData.res_id = res_id;
                    }

                    const threadId = await orm.create("discuss.channel", [threadData]);

                    // Handle both array return and single ID return
                    const actualThreadId = Array.isArray(threadId) ? threadId[0] : threadId;

                    // Allow extensions to add additional fields via event
                    const extendedFields = [];
                    env.bus.trigger("llm_chat:extend_load_fields", {
                        fields: extendedFields,
                        method: 'createThread'
                    });

                    const threadDetails = await orm.read(
                        "discuss.channel",
                        [actualThreadId],
                        [...THREAD_SEARCH_FIELDS, ...extendedFields]
                    );

                    if (!threadDetails || !threadDetails[0]) {
                        notification.add(
                            _t("Failed to fetch thread data"),
                            {
                                title: _t("Error"),
                                type: "danger",
                            }
                        );
                        return null;
                    }

                    const thread = this._mapThreadDataFromServer(threadDetails)

                    // Add to threads list
                    // Replace entire array to ensure reactivity
                    this.threads = [thread, ...this.threads];

                    return thread;
                },

                async ensureThread({ model, res_id } = {}) {

                    // Force reload threads to ensure we have fresh data from database
                    await this.loadThreads([], true);

                    if (model && res_id) {

                        const existingThread = this.threads.find(
                            thread =>
                                thread.model === model &&
                                thread.res_id === res_id
                        );

                        if (existingThread) {
                            return existingThread;
                        }

                        try {
                            const name = _t("New Chat for %s %s", model, res_id);
                            return await this.createThread({
                                name,
                                model,
                                res_id,
                            });
                        } catch (error) {
                            console.error("Failed to create thread for related model:", error);
                        }
                    }

                    try {
                        const name = _t("New Chat %s", new Date().toLocaleString());
                        return await this.createThread({ name });
                    } catch (error) {
                        console.error("Failed to create default thread:", error);
                        return null;
                    }
                },

                async loadTools() {
                    try {
                        const result = await orm.searchRead(
                            "llm.tool",
                            [["active", "=", true]],
                            ["name", "id", "title", "default"]
                        );

                        this.tools = result.map(tool => ({
                            id: tool.id,
                            name: tool.name,
                            title: tool.title,
                            default: tool.default,
                        }));
                    } catch (error) {
                        console.error("Error loading tools:", error);
                        return [];
                    }
                },

                async sendMessage(threadId, messageContent) {
                    try {
                        // Create a new message using RPC to call a Python method
                        const result = await rpc("/web/dataset/call_kw", {
                            model: "discuss.channel",
                            method: "send_message",
                            args: [threadId, messageContent],
                            kwargs: {},
                        });

                        if (result && result.success) {
                            // Refresh the thread to get updated message_ids
                            await this.refreshThread(threadId);
                            return result;
                        } else {
                            throw new Error("Failed to send message to thread");
                        }

                    } catch (error) {
                        console.error("Error sending message to thread:", threadId, error);
                        throw error;
                    }
                },

                /**
                 * Delete a thread
                 * @param {number} threadId - Thread ID to delete
                 */
                async deleteThread(threadId) {
                    try {
                        // Ensure we have a valid thread ID
                        if (!threadId || (typeof threadId !== 'number' && isNaN(parseInt(threadId)))) {
                            throw new Error("Invalid thread ID provided");
                        }

                        // Convert to number if string
                        const numericThreadId = typeof threadId === 'string' ? parseInt(threadId, 10) : threadId;

                        // Delete the thread from database
                        await orm.unlink("discuss.channel", [numericThreadId]);

                        // Remove from local threads array
                        const threadIndex = this.threads.findIndex(t => t.id === numericThreadId);
                        if (threadIndex !== -1) {
                            // Create new array without the deleted thread to ensure reactivity
                            this.threads = this.threads.filter(t => t.id !== numericThreadId);
                        }

                        // If this was the active thread, clear it and select another
                        if (this.activeThread && this.activeThread.id === numericThreadId) {
                            this.activeThread = null;

                            // Select first available thread if any exist
                            if (this.threads.length > 0) {
                                await this.selectThread(this.threads[0].id);
                            }
                        }

                        return true;
                    } catch (error) {
                        console.error("Error deleting thread:", error);
                        throw error;
                    }
                },

                // Computed properties
                get activeId() {
                    return this.activeThread
                        ? this.threadToActiveId(this.activeThread)
                        : null;
                },

                get orderedThreads() {
                    if (!this.threads) return [];

                    const ordered = [...this.threads].sort((a, b) => {
                        const dateA = a.updatedAt
                            ? new Date(a.updatedAt.replace(" ", "T"))
                            : new Date(0);
                        const dateB = b.updatedAt
                            ? new Date(b.updatedAt.replace(" ", "T"))
                            : new Date(0);
                        return dateB - dateA;
                    });

                    return ordered;
                },

                get llmProviders() {
                    if (!this.llmModels || !Array.isArray(this.llmModels)) {
                        return [];
                    }

                    const providers = this.llmModels
                        .map(m => m && m.llmProvider)
                        .filter(p => p && p.id);

                    return [...new Map(providers.map(p => [p.id, p])).values()];
                },

                get defaultLLMModel() {
                    if (!this.llmModels || !Array.isArray(this.llmModels) || (!this.llmModels.length > 0)) {
                        return null;
                    }

                    // Find the model with default: true
                    const defaultModel = this.llmModels.find(m => m && m.default === true);

                    // Fallback to first model if no default is set
                    const result = defaultModel || this.llmModels[0];
                    return result;

                },

                get threadCache() {
                    return this.activeThread ? { thread: this.activeThread } : null;
                },
            },
        });

        return store.llmChat;
    },
};

// Register the service
registry.category("services").add("llm_chat", LLMChatService);