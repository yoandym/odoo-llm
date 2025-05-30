/** @odoo-module **/

import { registry } from "@web/core/registry";
import { reactive } from "@odoo/owl";

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
                llmChatView: null,
                isInitThreadHandled: false,
                initActiveId: null,
                activeThread: null,
                threads: [],
                llmModels: [],
                tools: [],

                // Methods
                async initializeLLMChat(actionData, initActiveId, postInitializationPromises = []) {
                    this.llmChatView = {
                        actionId: actionData.id,
                    };
                    this.initActiveId = initActiveId;

                    // Load resources
                    await this.loadLLMModels();
                    await this.loadThreads();
                    await this.loadTools();

                    // Execute additional initialization promises
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
                            name: env._t("Chat"),
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
                    ];

                    const result = await orm.searchRead(
                        "llm.thread",
                        [["create_uid", "=", user.userId]],
                        [...THREAD_SEARCH_FIELDS, ...additionalFields],
                        { order: "write_date desc" }
                    );

                    this.threads = result.map(thread => this._mapThreadDataFromServer(thread));
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
                        selectedToolIds: threadData.tool_ids || [],
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
                    }

                    return mappedData;
                },

                async refreshThread(threadId, additionalFields = []) {
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
                        ];

                        const result = await orm.searchRead(
                            "llm.thread",
                            [["id", "=", threadId]],
                            [...THREAD_SEARCH_FIELDS, ...additionalFields]
                        );

                        if (!result || !result.length) {
                            return;
                        }

                        const mappedThreadData = this._mapThreadDataFromServer(result[0]);
                        const threadIndex = this.threads.findIndex(thread => thread.id === threadId);

                        if (threadIndex !== -1) {
                            // Update the thread in place to maintain reactivity
                            Object.assign(this.threads[threadIndex], mappedThreadData);
                        }
                    } catch (error) {
                        console.error("Error refreshing thread:", error);
                    }
                },

                async selectThread(threadId) {
                    const thread = this.threads.find(t => t.id === threadId && t.model === "llm.thread");
                    if (thread) {
                        this.activeThread = thread;
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
                },

                async createThread({ name, relatedThreadModel, relatedThreadId }) {
                    const defaultModel = this.defaultLLMModel;

                    if (!defaultModel) {
                        notification.add(
                            env._t("No LLMModel available"),
                            {
                                title: env._t("Warning"),
                                type: "warning",
                            }
                        );
                        throw new Error("No LLM model available");
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

                    const threadId = await orm.create("llm.thread", [threadData]);
                    const threadDetails = await orm.read(
                        "llm.thread",
                        threadId,
                        ["name", "model_id", "provider_id", "write_date"]
                    );

                    if (!threadDetails || !threadDetails[0]) {
                        notification.add(
                            env._t("Failed to create thread"),
                            {
                                title: env._t("Error"),
                                type: "danger",
                            }
                        );
                        return null;
                    }

                    const thread = {
                        id: threadId,
                        model: "llm.thread",
                        name: threadDetails[0].name,
                        message_needaction_counter: 0,
                        isServerPinned: true,
                        llmModel: defaultModel,
                        updatedAt: threadDetails[0].write_date,
                        ...(relatedThreadModel && { relatedThreadModel }),
                        ...(relatedThreadId && { relatedThreadId }),
                    };

                    // Add to threads list
                    this.threads.unshift(thread);

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
                            const name = `AI Chat for ${relatedThreadModel} ${relatedThreadId}`;
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
                        const name = `New Chat ${new Date().toLocaleString()}`;
                        return await this.createThread({ name });
                    } catch (error) {
                        console.error("Failed to create default thread:", error);
                        return null;
                    }
                },

                async createNewThread() {
                    try {
                        const name = `New Chat ${new Date().toLocaleString()}`;
                        const thread = await this.createThread({ name });
                        if (thread) {
                            this.selectThread(thread.id);
                        }
                    } catch (error) {
                        console.error("Failed to create new thread:", error);
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

                // Computed properties
                get activeId() {
                    return this.activeThread
                        ? this.threadToActiveId(this.activeThread)
                        : null;
                },

                get orderedThreads() {
                    if (!this.threads) return [];

                    return [...this.threads].sort((a, b) => {
                        const dateA = a.updatedAt
                            ? new Date(a.updatedAt.replace(" ", "T"))
                            : new Date(0);
                        const dateB = b.updatedAt
                            ? new Date(b.updatedAt.replace(" ", "T"))
                            : new Date(0);
                        return dateB - dateA;
                    });
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
                    if (!this.llmModels || !Array.isArray(this.llmModels)) {
                        return null;
                    }

                    const activeModel = this.activeThread?.llmModel;

                    if (!activeModel) {
                        return this.llmModels.length > 0 ? this.llmModels[0] : null;
                    }

                    return this.llmModels.find(m => m && m.id === activeModel.id) || null;
                },

                get threadCache() {
                    return this.activeThread ? { thread: this.activeThread } : null;
                },
            },
        });

        return store;
    },
};

// Register the service
registry.category("services").add("llm_chat", LLMChatService);