/** @odoo-module **/

import { registry } from "@web/core/registry";
import { reactive } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";

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
        /**
         * LLM Chat Service Store - A reactive store for managing LLM chat threads, models, and tools
         * 
         * @namespace llmChat
         * @description Manages the state and operations for LLM chat functionality including threads, models, and tools.
         * 
         * @property {Object|null} llmChatView - Current chat view configuration with action ID
         * @property {boolean} isInitThreadHandled - Flag to track if initial thread handling is complete
         * @property {string|number|null} initActiveId - Initial active thread identifier
         * @property {Object|null} activeThread - Currently selected thread object
         * @property {Array<Object>} threads - Array of available chat threads
         * @property {Array<Object>} llmModels - Array of available LLM models with provider information
         * @property {Array<Object>} tools - Array of available LLM tools
         * 
         * @method initializeLLMChat - Initializes the LLM chat system with action data and optional promises
         * @method close - Closes the current chat view
         * @method openInitThread - Opens the initial thread based on initActiveId
         * @method openThread - Opens a specific thread and triggers action if needed
         * @method threadToActiveId - Converts thread object to active ID string format
         * @method loadThreads - Loads threads from server with optional additional fields
         * @method _mapThreadDataFromServer - Maps server thread data to client format
         * @method refreshThread - Refreshes a specific thread's data from server
         * @method selectThread - Selects and activates a thread by ID
         * @method open - Opens the chat view with empty configuration
         * @method loadLLMModels - Loads available LLM models from server
         * @method createThread - Creates a new thread with specified parameters
         * @method ensureThread - Ensures a thread exists, creating one if needed
         * @method loadTools - Loads available LLM tools from server
         * @method getMessages - Retrieves messages for a specific thread
         * @method sendMessage - Sends a message to a thread via RPC call
         * 
         * @computed activeId - Returns active thread ID in string format
         * @computed orderedThreads - Returns threads sorted by update date (newest first)
         * @computed llmProviders - Returns unique providers from available models
         * @computed defaultLLMModel - Returns the default LLM model or first available
         * @computed threadCache - Returns cached thread data for active thread
         */
        const store = reactive({
            llmChat: {
                llmChatView: null,
                isInitThreadHandled: false,
                initActiveId: null,
                activeThread: null,
                threads: [],
                llmModels: [],
                tools: [],                // Methods
                async initializeLLMChat(actionData, initActiveId, postInitializationPromises = []) {
                    this.llmChatView = {
                        actionId: actionData.id,
                    };
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

                close() {
                    this.llmChatView = null;
                },

                openInitThread() {
                    if (!this.initActiveId) {
                        if (this.threads.length > 0) {
                            this.selectThread(this.threads[0].id);
                        }
                        return;
                    }

                    const [model, id] = typeof this.initActiveId === "number"
                        ? ["llm.thread", this.initActiveId]
                        : this.initActiveId.split("_");

                    const thread = this.threads.find(t => t.id === Number(id) && t.model === model);

                    if (!thread && this.threads.length > 0) {
                        this.selectThread(this.threads[0].id);
                    } else if (thread) {
                        this.selectThread(thread.id);
                    }
                },

                async openThread(thread) {
                    this.activeThread = thread;

                    if (!this.llmChatView) {
                        await action.doAction("llm_thread.action_llm_chat", {
                            name: _t("Chat"),
                            active_id: this.threadToActiveId(thread),
                            clearBreadcrumbs: false,
                        });
                    }
                },

                threadToActiveId(thread) {
                    return `${thread.model}_${thread.id}`;
                },

                async loadThreads(additionalFields = []) {
                    const THREAD_SEARCH_FIELDS = [
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
                        "assistant_id",
                        "prompt_id",
                    ];

                    // Allow extensions to add additional fields via event
                    const extendedFields = [...additionalFields];
                    env.bus.trigger("llm_chat:extend_load_fields", {
                        fields: extendedFields,
                        method: 'loadThreads'
                    });

                    const result = await orm.searchRead(
                        "llm.thread",
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
                        id: threadData.id,
                        model: "llm.thread",
                        name: threadData.name,
                        message_needaction_counter: 0,
                        creator: threadData.create_uid
                            ? { id: threadData.create_uid[0], name: threadData.create_uid[1] }
                            : undefined,
                        isServerPinned: true,
                        updatedAt: threadData.write_date,
                        relatedThreadModel: threadData.model,
                        relatedThreadId: threadData.res_id,
                        tool_ids: threadData.tool_ids || [],
                    };

                    if (threadData.model_id && threadData.provider_id) {
                        mappedData.llmModel = {
                            id: threadData.model_id[0],
                            name: threadData.model_id[1],
                            llmProvider: {
                                id: threadData.provider_id[0],
                                name: threadData.provider_id[1],
                            },
                        };
                        console.log("Thread mapped with model:", mappedData.llmModel);
                    }

                    // Handle assistant data if present
                    if (threadData.assistant_id) {
                        mappedData.assistant_id = threadData.assistant_id[0];
                        mappedData.assistant_name = threadData.assistant_id[1];
                    } else {
                        // Explicitly clear assistant data when not present
                        mappedData.assistant_id = null;
                        mappedData.assistant_name = null;
                    }

                    // Handle prompt data if present
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
                }, async refreshThread(threadId, additionalFields = []) {
                    try {
                        const THREAD_SEARCH_FIELDS = [
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
                            "assistant_id",
                            "prompt_id",
                        ];

                        // Allow extensions to add additional fields via event
                        const extendedFields = [...additionalFields];
                        env.bus.trigger("llm_chat:extend_load_fields", {
                            fields: extendedFields,
                            method: 'refreshThread',
                            threadId
                        });

                        const result = await orm.searchRead(
                            "llm.thread",
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

                                // Emit event for active thread changes
                                env.bus.trigger("llm_chat:active_thread_updated", {
                                    threadId: threadId,
                                    thread: this.activeThread,
                                    updatedFields: mappedThreadData
                                });
                                console.log("Emitted llm_chat:active_thread_updated event for thread:", threadId);
                            }

                            // Emit general thread update event
                            env.bus.trigger("llm_chat:thread_updated", {
                                threadId: threadId,
                                thread: this.threads[threadIndex],
                                updatedFields: mappedThreadData
                            });
                            console.log("Emitted llm_chat:thread_updated event for thread:", threadId);

                            // Emit thread refreshed event
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
                    console.log("SelectThread called with ID:", threadId);
                    console.log("Available threads:", this.threads.map(t => ({ id: t.id, name: t.name })));
                    const thread = this.threads.find(t => t.id === threadId && t.model === "llm.thread");
                    console.log("Found thread:", thread);
                    if (thread) {
                        this.activeThread = thread;
                        console.log("Set active thread:", this.activeThread);

                        // Dispatch event for component reactivity
                        env.bus.trigger("llm_chat:thread_selected", {
                            threadId: thread.id,
                            thread: thread,
                            activeThread: this.activeThread
                        });
                        console.log("Dispatched llm_chat:thread_selected event");
                    } else {
                        console.log("Thread not found in threads list");
                    }
                },

                open() {
                    this.llmChatView = {};
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

                    console.log("Loaded LLM models:", this.llmModels.map(m => ({ id: m.id, name: m.name, default: m.default })));
                },

                async createThread({ name, relatedThreadModel, relatedThreadId }) {
                    let defaultModel = this.defaultLLMModel;

                    if (!defaultModel) {
                        notification.add(
                            _t("No default LLMModel. Using the first available model"),
                            {
                                title: _t("Warning"),
                                type: "warning",
                            }
                        );
                        // no default, so select the first available model
                        if (this.llmModels.length > 0) {
                            defaultModel = this.llmModels[0];
                        } else {
                            throw new Error("No LLM model available");
                        }
                    }

                    const threadData = {
                        name,
                        model_id: defaultModel.id,
                        provider_id: defaultModel.llmProvider.id,
                    };

                    if (relatedThreadModel && relatedThreadId) {
                        threadData.model = relatedThreadModel;
                        threadData.res_id = relatedThreadId;
                    }

                    console.log("Creating thread with data:", threadData);
                    console.log("Using default model:", defaultModel);

                    const threadId = await orm.create("llm.thread", [threadData]);
                    console.log("Created thread ID:", threadId);

                    // Handle both array return and single ID return
                    const actualThreadId = Array.isArray(threadId) ? threadId[0] : threadId;

                    const threadDetails = await orm.read(
                        "llm.thread",
                        [actualThreadId],
                        ["name", "model_id", "provider_id", "write_date"]
                    );

                    if (!threadDetails || !threadDetails[0]) {
                        notification.add(
                            _t("Failed to create thread"),
                            {
                                title: _t("Error"),
                                type: "danger",
                            }
                        );
                        return null;
                    }

                    const thread = {
                        id: actualThreadId,
                        model: "llm.thread",
                        name: threadDetails[0].name,
                        message_needaction_counter: 0,
                        isServerPinned: true,
                        llmModel: defaultModel,
                        updatedAt: threadDetails[0].write_date,
                        ...(relatedThreadModel && { relatedThreadModel }),
                        ...(relatedThreadId && { relatedThreadId }),
                    };

                    console.log("Created thread object:", thread);

                    // Add to threads list
                    console.log("Threads before adding:", this.threads.length);
                    // Replace entire array to ensure reactivity
                    this.threads = [thread, ...this.threads];
                    console.log("Threads after adding:", this.threads.length);
                    console.log("New thread added at index 0:", this.threads[0]);

                    // Dispatch event for component reactivity
                    env.bus.trigger("llm_chat:threads_changed", { threads: this.threads });
                    console.log("Dispatched llm_chat:threads_changed event");

                    return thread;
                },

                async ensureThread({ relatedThreadModel, relatedThreadId } = {}) {
                    if (this.llmModels.length === 0) {
                        await this.loadLLMModels();
                    }

                    if (this.threads.length === 0) {
                        await this.loadThreads();
                    }

                    if (!this.tools || this.tools.length === 0) {
                        await this.loadTools();
                    }

                    if (relatedThreadModel && relatedThreadId) {
                        const existingThread = this.threads.find(
                            thread =>
                                thread.relatedThreadModel === relatedThreadModel &&
                                thread.relatedThreadId === relatedThreadId
                        );

                        if (existingThread) {
                            return existingThread;
                        }

                        try {
                            const name = _t("New Chat for %s %s", relatedThreadModel, relatedThreadId);
                            return await this.createThread({
                                name,
                                relatedThreadModel,
                                relatedThreadId,
                            });
                        } catch (error) {
                            console.error("Failed to create thread for related model:", error);
                        }
                    }

                    if (this.threads.length > 0) {
                        return this.threads[0];
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
                            ["name", "id"]
                        );

                        this.tools = result.map(tool => ({
                            id: tool.id,
                            name: tool.name,
                        }));
                    } catch (error) {
                        console.error("Error loading tools:", error);
                        return [];
                    }
                },

                async getMessages(threadId) {
                    try {
                        // First get the thread to get message IDs
                        const threadResult = await orm.searchRead(
                            "llm.thread",
                            [["id", "=", threadId]],
                            ["message_ids"]
                        );

                        if (!threadResult || threadResult.length === 0) {
                            console.warn("Thread not found:", threadId);
                            return [];
                        }

                        const messageIds = threadResult[0].message_ids;
                        if (!messageIds || messageIds.length === 0) {
                            return [];
                        }

                        // Get messages from mail.message model
                        const messages = await orm.searchRead(
                            "mail.message",
                            [["id", "in", messageIds]],
                            ["id", "author_id", "body", "date", "message_type", "subtype_id"],
                            { order: "date asc" }
                        );

                        return messages.map(message => ({
                            id: message.id,
                            author: message.author_id ? {
                                id: message.author_id[0],
                                name: message.author_id[1]
                            } : { name: "AI Assistant" },
                            content: message.body || "",
                            body: message.body || "",
                            date: message.date,
                            timestamp: message.date,
                            messageType: message.message_type,
                            subtype_id: message.subtype_id,
                            isFromUser: message.author_id && message.author_id[0] === user.userId,
                            role: message.author_id && message.author_id[0] === user.userId ? 'user' : 'assistant',
                        }));

                    } catch (error) {
                        console.error("Error loading messages for thread:", threadId, error);
                        return [];
                    }
                },

                async sendMessage(threadId, messageContent) {
                    try {
                        // Create a new message using RPC to call a Python method
                        const result = await rpc("/web/dataset/call_kw", {
                            model: "llm.thread",
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
                 * Set an assistant for a thread
                 * @param {number} threadId - Thread ID
                 * @param {number} assistantId - Assistant ID
                 */
                async setThreadAssistant(threadId, assistantId) {
                    try {
                        console.log(`Setting assistant ${assistantId} for thread ${threadId}`);

                        await orm.write("llm.thread", [threadId], {
                            assistant_id: assistantId
                        });

                        // Refresh thread to get updated data including tools
                        await this.refreshThread(threadId);

                        console.log(`Successfully set assistant ${assistantId} for thread ${threadId}`);

                        return true;
                    } catch (error) {
                        console.error("Error setting thread assistant:", error);
                        throw error;
                    }
                },

                /**
                 * Clear the assistant from a thread
                 * @param {number} threadId - Thread ID
                 */
                async clearThreadAssistant(threadId) {
                    try {
                        console.log(`Clearing assistant for thread ${threadId}`);

                        await orm.write("llm.thread", [threadId], {
                            assistant_id: false
                        });

                        // Refresh thread to get updated data
                        await this.refreshThread(threadId);

                        console.log(`Successfully cleared assistant for thread ${threadId}`);

                        return true;
                    } catch (error) {
                        console.error("Error clearing thread assistant:", error);
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

                    console.log("OrderedThreads: Raw threads count:", this.threads.length);
                    console.log("OrderedThreads: Raw thread IDs:", this.threads.map(t => t.id));

                    const ordered = [...this.threads].sort((a, b) => {
                        const dateA = a.updatedAt
                            ? new Date(a.updatedAt.replace(" ", "T"))
                            : new Date(0);
                        const dateB = b.updatedAt
                            ? new Date(b.updatedAt.replace(" ", "T"))
                            : new Date(0);
                        return dateB - dateA;
                    });

                    console.log("OrderedThreads: Sorted thread IDs:", ordered.map(t => t.id));
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
                        console.log("DefaultLLMModel: No models available");
                        return null;
                    }

                    // Find the model with default: true
                    const defaultModel = this.llmModels.find(m => m && m.default === true);
                    console.log("Found default model:", defaultModel);

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