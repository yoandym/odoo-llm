/** @odoo-module **/

import { Component, useState, useRef, useEnv, onWillStart, onMounted, onWillUnmount, onWillUpdateProps } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { Message } from "@mail/core/common/message";
import { LLMChatThreadHeader } from "../llm_chat_thread_header/llm_chat_thread_header";
import { LLMChatComposer } from "../llm_chat_composer/llm_chat_composer";

/**
 * LLMChatThread Component using Odoo's native Message component
 * 
 * This component integrates with Odoo's mail system by using
 * the native Message component with our patches.
 */
export class LLMChatThread extends Component {
    static template = "llm_thread.LLMChatThread";
    static components = {
        LLMChatThreadHeader,
        Message,
        LLMChatComposer,
    };
    static props = {
        thread: { type: Object },
        className: { type: String, optional: true },
        onOpenSidebar: { type: Function, optional: true },
    };

    setup() {
        // Services
        this.store = useService("mail.store");
        this.messagingService = useService("mail.messaging");
        this.llmChatService = useService("llm_chat");
        this.rpc = useService("rpc");
        this.notification = useService("notification");

        // Environment
        this.env = useEnv();

        // Refs
        this.contentRef = useRef("content");

        // State
        this.state = useState({
            messages: [],
            isLoadingMessages: false,
            hasMoreMessages: true,
            streamingMessageId: null,
            thread: null,
            // Add persistent composer state
            composerState: {
                textInputContent: "",
                attachments: [],
                mentionedChannels: [],
                mentionedPartners: [],
                cannedResponses: [],
                isFocused: false,
                forceCursorMove: false,
                selection: { start: 0, end: 0, direction: "none" },
                message: null,
            }
        });

        // Current thread ID - properly extracted
        this.currentThreadId = null;
        if (this.props.thread?.id) {

            let threadId = this.props.thread.id;

            // Handle Symbol or special objects
            if (threadId && typeof threadId === 'object' && threadId.toString) {
                const idStr = threadId.toString();
                const match = idStr.match(/\d+/);
                if (match) {
                    threadId = parseInt(match[0], 10);
                }
            } else if (Array.isArray(threadId)) {
                threadId = threadId[0];
            } else if (typeof threadId === 'string') {
                threadId = parseInt(threadId, 10);
            }

            if (threadId && !isNaN(threadId)) {
                this.currentThreadId = threadId;
            }

        }

        // Setup event listeners
        this.setupEventListeners();

        // Initialize
        onWillStart(async () => {
            if (this.props.thread?.id) {
                await this.initializeThread(this.props.thread);
            }
        });

        // Setup scroll handling
        onMounted(() => {
            setTimeout(() => {
                this.setupScrollHandling();
                this.scrollToBottom();
            }, 0);
        });

        // Handle thread changes
        onWillUpdateProps(async (nextProps) => {
            if (nextProps.thread?.id) {

                // Extract and normalize the thread ID
                let nextThreadId = nextProps.thread.id;

                // Handle Symbol or special objects
                if (nextThreadId && typeof nextThreadId === 'object' && nextThreadId.toString) {
                    const idStr = nextThreadId.toString();
                    const match = idStr.match(/\d+/);
                    if (match) {
                        nextThreadId = parseInt(match[0], 10);
                    }
                } else if (Array.isArray(nextThreadId)) {
                    nextThreadId = nextThreadId[0];
                } else if (typeof nextThreadId === 'string') {
                    nextThreadId = parseInt(nextThreadId, 10);
                }

                // Validate
                if (!nextThreadId || isNaN(nextThreadId)) {
                    console.error("Failed to extract valid thread ID from nextProps:", nextProps.thread);
                    return;
                }

                // Check if it's a different thread
                if (nextThreadId !== this.currentThreadId) {
                    this.currentThreadId = nextThreadId;
                    this.state.messages = [];
                    this.state.streamingMessageId = null;
                    this.state.hasMoreMessages = true;
                    await this.initializeThread(nextProps.thread);
                    requestAnimationFrame(() => {
                        this.scrollToBottom();
                    });
                }
            }
        });

        // Cleanup
        onWillUnmount(() => {
            this.cleanupEventListeners();
            if (this.scrollHandler && this.contentRef.el) {
                this.contentRef.el.removeEventListener("scroll", this.scrollHandler);
            }
        });
    }

    /**
     * Initialize thread and load messages
     */
    async initializeThread(threadData) {

        // Extract thread ID properly
        let threadId = threadData.id;

        // Handle Symbol or special objects
        if (threadId && typeof threadId === 'object' && threadId.toString) {
            // Try to get string representation
            const idStr = threadId.toString();
            // Extract numeric ID from string like "Symbol(123)" or "[123, 'name']"
            const match = idStr.match(/\d+/);
            if (match) {
                threadId = parseInt(match[0], 10);
            }
        } else if (Array.isArray(threadId)) {
            threadId = threadId[0];
        }

        // Ensure it's a number
        if (typeof threadId === 'string') {
            threadId = parseInt(threadId, 10);
        }

        // Validate
        if (!threadId || isNaN(threadId)) {
            console.error("Failed to extract valid thread ID from:", threadData);
            this.notification.add("Invalid thread ID. Please try again.", {
                type: "danger",
            });
            return;
        }

        // Store the numeric thread ID
        this.currentThreadId = threadId;

        // Create thread object for Odoo's mail system
        this.state.thread = this.store.Thread.insert({
            id: threadId,
            model: "discuss.channel",
            name: threadData.name || threadData.display_name || "LLM Chat",
            displayName: threadData.name || threadData.display_name || "LLM Chat",
        });

        // Add custom fields for related document linking (needed for message actions)
        if (threadData.model && threadData.res_id) {
            this.state.thread.model = threadData.model;
            this.state.thread.res_id = threadData.res_id;
        } 

        // Load messages
        await this.loadMessages();
    }

    /**
     * Load messages for the thread
     */
    async loadMessages() {
        if (!this.currentThreadId || this.state.isLoadingMessages) return;

        // Ensure thread ID is numeric
        let threadId = this.currentThreadId;
        if (typeof threadId !== 'number') {
            console.error("Invalid thread ID:", threadId);
            return;
        }

        this.state.isLoadingMessages = true;

        try {
            const result = await this.rpc("/mail/thread/messages", {
                thread_model: "discuss.channel",
                thread_id: threadId,
                limit: 30,
            });

            const messages = result.messages || [];
            this.state.messages = this.processMessages(messages);
            this.state.hasMoreMessages = messages.length === 30;
        } catch (error) {
            console.error("Failed to load messages:", error);
            // Show user-friendly error
            this.notification.add("Failed to load messages. Please try again.", {
                type: "danger",
            });
        } finally {
            this.state.isLoadingMessages = false;
        }
    }

    /**
     * Load more messages (for infinite scroll)
     */
    async loadMoreMessages() {
        if (this.state.isLoadingMessages || !this.state.hasMoreMessages || !this.currentThreadId) return;

        const oldestMessage = this.state.messages[0];
        if (!oldestMessage) return;

        // Ensure thread ID is numeric
        let threadId = this.currentThreadId;
        if (typeof threadId !== 'number') {
            console.error("Invalid thread ID for loadMoreMessages:", threadId);
            return;
        }

        this.state.isLoadingMessages = true;
        const previousScrollHeight = this.contentRef.el ? this.contentRef.el.scrollHeight : 0;

        try {
            const result = await this.rpc("/mail/thread/messages", {
                thread_model: "discuss.channel",
                thread_id: threadId,
                max_id: oldestMessage.id,
                limit: 30,
            });

            const newMessages = this.processMessages(result.messages || []);
            this.state.messages = [...newMessages, ...this.state.messages];
            this.state.hasMoreMessages = newMessages.length === 30;

            requestAnimationFrame(() => {
                if (this.contentRef.el) {
                    const newScrollHeight = this.contentRef.el.scrollHeight;
                    const scrollDiff = newScrollHeight - previousScrollHeight;
                    this.contentRef.el.scrollTop += scrollDiff;
                }
            });
        } catch (error) {
            console.error("Failed to load more messages:", error);
        } finally {
            this.state.isLoadingMessages = false;
        }
    }

    /**
     * Process raw messages from server
     */
    processMessages(rawMessages) {

        // Create Message objects in store
        const processedMessages = rawMessages.map(msgData => {

            // First check if message already exists
            let message = this.store.Message.get(msgData.id);

            if (!message) {
                // Prepare author data
                let authorData = msgData.author_id;

                // Create new message with safe data
                const messageData = {
                    id: msgData.id,
                    body: msgData.body || '',
                    date: msgData.date,
                    datetime: msgData.date, // Ensure datetime is set
                    thread: this.state.thread,
                };

                // Add author if it's in the correct format
                if (Array.isArray(authorData) && authorData.length >= 2) {
                    messageData.author = {
                        id: authorData[0],
                        name: authorData[1],
                    };
                }

                try {
                    message = this.store.Message.insert(messageData);
                } catch (error) {
                    console.error("Error creating message:", error, "messageData:", messageData);
                    return null;
                }
            }

            // Add custom fields that aren't part of standard Message model
            try {
                message.subtype_xmlid = msgData.subtype_xmlid;
                message.tool_call_id = msgData.tool_call_id;
                message.tool_calls = msgData.tool_calls;
                message.tool_call_definition = msgData.tool_call_definition;
                message.tool_call_result = msgData.tool_call_result;
                message.message_type = msgData.message_type;
                message.email_from = msgData.email_from;
                message.attachment_ids = msgData.attachment_ids || [];
            } catch (error) {
                console.error("Error adding custom fields:", error, "message:", message);
            }

            return message;
        }).filter(msg => msg !== null);

        // Sort by date
        const sorted = processedMessages.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateA - dateB;
        });

        // Link tool results to assistant messages
        sorted.forEach(msg => {
            if (msg.tool_call_id && msg.subtype_xmlid === "llm_mail_message_subtypes.mt_llm_tool_result") {
                const assistantMsg = sorted.find(m => {
                    if (m.tool_calls && m.subtype_xmlid === "llm_mail_message_subtypes.mt_llm_assistant") {
                        try {
                            const calls = JSON.parse(m.tool_calls);
                            return calls.some(call => call.id === msg.tool_call_id);
                        } catch (e) {
                            return false;
                        }
                    }
                    return false;
                });

                if (assistantMsg) {
                    if (!assistantMsg.toolResults) {
                        assistantMsg.toolResults = [];
                    }
                    assistantMsg.toolResults.push({
                        id: msg.id,
                        tool_call_id: msg.tool_call_id,
                        tool_call_definition: msg.tool_call_definition,
                        tool_call_result: msg.tool_call_result,
                        body: msg.body,
                        date: msg.date,
                    });
                    msg._hidden = true;
                }
            }
        });

        return sorted.filter(msg => !msg._hidden);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {

        this.messageCreatedHandler = (ev) => {
            if (ev.detail.threadId === this.currentThreadId) {
                this.handleMessageCreated(ev.detail.message);
            }
        };

        this.messageUpdatedHandler = (ev) => {
            if (ev.detail.threadId === this.currentThreadId) {
                this.handleMessageUpdated(ev.detail.message);
            }
        };

        this.streamingStoppedHandler = (ev) => {
            if (ev.detail.threadId === this.currentThreadId) {
                this.state.streamingMessageId = null;
            }
        };

        this.env.bus.addEventListener("message-created", this.messageCreatedHandler);
        this.env.bus.addEventListener("message-updated", this.messageUpdatedHandler);
        this.env.bus.addEventListener("streaming-stopped", this.streamingStoppedHandler);
    }

    /**
     * Cleanup event listeners
     */
    cleanupEventListeners() {
        this.env.bus.removeEventListener("message-created", this.messageCreatedHandler);
        this.env.bus.removeEventListener("message-updated", this.messageUpdatedHandler);
        this.env.bus.removeEventListener("streaming-stopped", this.streamingStoppedHandler);
    }

    /**
     * Handle new message creation
     */
    handleMessageCreated(messageData) {

        let message = this.store.Message.get(messageData.id);

        if (!message) {
            // Prepare safe message data
            const safeMessageData = {
                id: messageData.id,
                body: messageData.body || '',
                thread: this.state.thread,
            };

            // Add datetime - ensure it's a proper date string
            if (messageData.date) {
                safeMessageData.date = messageData.date;
                safeMessageData.datetime = messageData.date;
            } else {
                // Use current datetime if not provided
                const now = new Date().toISOString();
                safeMessageData.date = now;
                safeMessageData.datetime = now;
            }

            // Handle author data safely
            if (messageData.author_id) {
                if (Array.isArray(messageData.author_id) && messageData.author_id.length >= 2) {
                    safeMessageData.author = {
                        id: messageData.author_id[0],
                        name: messageData.author_id[1],
                        type: "partner",
                    };
                }
            } else if (messageData.author) {
                safeMessageData.author = messageData.author;
            }

            try {
                message = this.store.Message.insert(safeMessageData);
            } catch (error) {
                console.error("Error creating message:", error, "safeMessageData:", safeMessageData);
                return;
            }
        }

        // Add custom fields safely
        try {
            // Only add non-symbol, serializable fields
            if (messageData.subtype_xmlid) message.subtype_xmlid = messageData.subtype_xmlid;
            if (messageData.tool_call_id) message.tool_call_id = messageData.tool_call_id;
            if (messageData.tool_calls) message.tool_calls = messageData.tool_calls;
            if (messageData.tool_call_definition) message.tool_call_definition = messageData.tool_call_definition;
            if (messageData.tool_call_result) message.tool_call_result = messageData.tool_call_result;
            if (messageData.message_type) message.message_type = messageData.message_type;
            if (messageData.email_from) message.email_from = messageData.email_from;
            if (messageData.attachment_ids) message.attachment_ids = messageData.attachment_ids;
        } catch (error) {
            console.error("Error adding custom fields to message:", error);
        }

        if (message.subtype_xmlid === "llm_mail_message_subtypes.mt_llm_assistant") {
            this.state.streamingMessageId = message.id;
        }

        // Handle tool results
        if (message.tool_call_id && message.subtype_xmlid === "llm_mail_message_subtypes.mt_llm_tool_result") {
            const assistantMsg = this.state.messages.find(m => {
                if (m.tool_calls && m.subtype_xmlid === "llm_mail_message_subtypes.mt_llm_assistant") {
                    try {
                        const calls = JSON.parse(m.tool_calls);
                        return calls.some(call => call.id === message.tool_call_id);
                    } catch (e) {
                        return false;
                    }
                }
                return false;
            });

            if (assistantMsg) {
                if (!assistantMsg.toolResults) {
                    assistantMsg.toolResults = [];
                }
                assistantMsg.toolResults.push({
                    id: message.id,
                    tool_call_id: message.tool_call_id,
                    tool_call_definition: message.tool_call_definition,
                    tool_call_result: message.tool_call_result,
                    body: message.body,
                    date: message.date,
                });
                // Don't add as separate message
                return;
            }
        }

        // Ensure message has datetime property before adding to state
        if (!message.datetime && message.date) {
            message.datetime = message.date;
        }

        this.state.messages.push(message);

        requestAnimationFrame(() => {
            this.scrollToBottom();
        });
    }

    /**
     * Handle message updates
     */
    handleMessageUpdated(messageData) {
        // Handle tool result updates
        if (messageData.tool_call_id && messageData.subtype_xmlid === "llm_mail_message_subtypes.mt_llm_tool_result") {
            const assistantMsg = this.state.messages.find(m => {
                if (m.tool_calls && m.subtype_xmlid === "llm_mail_message_subtypes.mt_llm_assistant") {
                    try {
                        const calls = JSON.parse(m.tool_calls);
                        return calls.some(call => call.id === messageData.tool_call_id);
                    } catch (e) {
                        return false;
                    }
                }
                return false;
            });

            if (assistantMsg) {
                if (!assistantMsg.toolResults) {
                    assistantMsg.toolResults = [];
                }
                const existingResult = assistantMsg.toolResults.find(r => r.id === messageData.id);
                if (existingResult) {
                    Object.assign(existingResult, messageData);
                } else {
                    assistantMsg.toolResults.push(messageData);
                }
                return;
            }
        }

        // Regular message update
        const message = this.state.messages.find(m => m.id === messageData.id);
        if (message) {
            Object.assign(message, messageData);

            if (this.shouldAutoScroll()) {
                requestAnimationFrame(() => {
                    this.scrollToBottom({ smooth: true });
                });
            }
        }
    }

    /**
     * Setup scroll handling
     */
    setupScrollHandling() {
        if (!this.contentRef || !this.contentRef.el) return;

        const scrollElement = this.contentRef.el;
        this.scrollHandler = async (ev) => {
            const { scrollTop, scrollHeight, clientHeight } = ev.target;
            if (scrollTop < 100 && !this.state.isLoadingMessages && this.state.hasMoreMessages) {
                await this.loadMoreMessages();
            }
        };

        scrollElement.addEventListener("scroll", this.scrollHandler);
    }

    /**
     * Check if should auto-scroll
     */
    shouldAutoScroll() {
        if (!this.contentRef || !this.contentRef.el) return false;
        const scrollElement = this.contentRef.el;
        const { scrollTop, scrollHeight, clientHeight } = scrollElement;
        const scrollBottom = scrollHeight - scrollTop - clientHeight;
        return scrollBottom < 100;
    }

    /**
     * Scroll to bottom
     */
    scrollToBottom(options = {}) {
        if (!this.contentRef || !this.contentRef.el) return;
        const scrollElement = this.contentRef.el;
        const behavior = options.smooth ? "smooth" : "auto";
        scrollElement.scrollTo({
            top: scrollElement.scrollHeight,
            behavior,
        });
    }

    /**
     * Get container classes
     */
    get containerClass() {
        const classes = ["o_LLMChatThread", "d-flex", "flex-column", "h-100"];
        if (this.props.className) {
            classes.push(this.props.className);
        }
        if (this.state.streamingMessageId) {
            classes.push("o-streaming");
        }
        return classes.join(" ");
    }

    /**
     * Get composer state
     */
    get composerState() {
        // Update thread reference in composer state
        this.state.composerState.thread = this.state.thread || this.props.thread;
        return this.state.composerState;
    }

    /**
     * Get grouped messages by date
     */
    get groupedMessages() {
        const groups = [];
        let currentDate = null;
        let currentGroup = null;

        for (const message of this.state.messages) {
            const messageDate = new Date(message.date).toDateString();

            if (messageDate !== currentDate) {
                currentDate = messageDate;
                currentGroup = {
                    date: messageDate,
                    displayDate: this.formatGroupDate(new Date(message.date)),
                    messages: [],
                };
                groups.push(currentGroup);
            }

            currentGroup.messages.push(message);
        }

        return groups;
    }

    /**
     * Format date for group headers
     */
    formatGroupDate(date) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return _t("Today");
        } else if (date.toDateString() === yesterday.toDateString()) {
            return _t("Yesterday");
        } else {
            return date.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        }
    }

    /**
     * Get message props for Odoo's Message component
     */
    getMessageProps(message) {
        return {
            message: message,
            thread: this.state.thread,
            className: "mb-3",
            hasActions: true,
            showDates: true,
        };
    }
}
