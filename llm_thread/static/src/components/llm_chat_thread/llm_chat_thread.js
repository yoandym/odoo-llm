/** @odoo-module **/

import { Component, useState, useRef, onWillStart, onMounted, onWillUnmount, onWillUpdateProps } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { LLMChatThreadHeader } from "../llm_chat_thread_header/llm_chat_thread_header";
import { LLMChatMessageList } from "../llm_chat_message_list/llm_chat_message_list";
import { LLMChatComposer } from "../llm_chat_composer/llm_chat_composer";

/**
 * LLMChatThread Component for Odoo v17
 * 
 * This component displays a complete chat thread including:
 * - Thread header with settings
 * - Message list with streaming support
 * - Message composer
 */
export class LLMChatThread extends Component {
    static template = "llm_thread.LLMChatThread";
    static components = {
        LLMChatThreadHeader,
        LLMChatMessageList,
        LLMChatComposer,
    };
    static props = {
        thread: { type: Object },
        className: { type: String, optional: true },
        onOpenSidebar: { type: Function, optional: true },
    };

    setup() {
        // Services
        this.llmChatService = useService("llm_chat");
        this.llmComposerService = useService("llm_composer");
        this.messageService = useService("mail.store");
        this.rpc = useService("rpc");

        // Refs
        this.contentRef = useRef("content");

        // State
        this.state = useState({
            messages: [],
            isLoadingMessages: false,
            hasMoreMessages: true,
            streamingMessageId: null,
        });

        // Initialize current thread ID
        this.currentThreadId = this.props.thread?.id;

        // Subscribe to composer events
        this.setupEventListeners();

        // Load initial messages
        onWillStart(async () => {
            if (this.props.thread?.id) {
                await this.loadMessages();
            }
        });

        // Setup scroll handling
        onMounted(() => {
            // Add a small delay to ensure DOM is ready
            setTimeout(() => {
                this.setupScrollHandling();
                this.scrollToBottom();
            }, 0);
        });

        // Handle thread prop changes
        onWillUpdateProps(async (nextProps) => {
            console.log("onWillUpdateProps - Current:", this.currentThreadId, "Next:", nextProps.thread?.id);

            // Check if we're switching to a different thread
            if (nextProps.thread?.id && nextProps.thread.id !== this.currentThreadId) {
                console.log("Thread changed! Loading messages for thread:", nextProps.thread.id);

                // Update the current thread ID
                this.currentThreadId = nextProps.thread.id;

                // Clear current messages immediately
                this.state.messages = [];
                this.state.streamingMessageId = null;
                this.state.hasMoreMessages = true;

                // Load new thread messages
                await this.loadMessagesForThread(nextProps.thread.id);

                // Schedule scroll after the DOM updates with new messages
                requestAnimationFrame(() => {
                    this.scrollToBottom();
                });
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
     * Setup event listeners for composer events
     */
    setupEventListeners() {
        const eventBus = this.llmComposerService.eventBus;

        // Message created handler
        this.messageCreatedHandler = (ev) => {
            // Use currentThreadId instead of props.thread.id
            if (ev.detail.threadId === this.currentThreadId) {
                this.handleMessageCreated(ev.detail.message);
            }
        };

        // Message updated handler (for streaming)
        this.messageUpdatedHandler = (ev) => {
            // Use currentThreadId instead of props.thread.id
            if (ev.detail.threadId === this.currentThreadId) {
                this.handleMessageUpdated(ev.detail.message);
            }
        };

        // Streaming stopped handler
        this.streamingStoppedHandler = (ev) => {
            // Use currentThreadId instead of props.thread.id
            if (ev.detail.threadId === this.currentThreadId) {
                this.state.streamingMessageId = null;
            }
        };

        eventBus.addEventListener("message-created", this.messageCreatedHandler);
        eventBus.addEventListener("message-updated", this.messageUpdatedHandler);
        eventBus.addEventListener("streaming-stopped", this.streamingStoppedHandler);
    }

    /**
     * Cleanup event listeners
     */
    cleanupEventListeners() {
        const eventBus = this.llmComposerService.eventBus;
        if (eventBus) {
            eventBus.removeEventListener("message-created", this.messageCreatedHandler);
            eventBus.removeEventListener("message-updated", this.messageUpdatedHandler);
            eventBus.removeEventListener("streaming-stopped", this.streamingStoppedHandler);
        }
    }

    /**
     * Setup scroll handling for infinite scroll
     */
    setupScrollHandling() {
        // Check if ref is available
        if (!this.contentRef || !this.contentRef.el) {
            console.warn("Content ref not available for scroll handling");
            return;
        }

        const scrollElement = this.contentRef.el;

        this.scrollHandler = async (ev) => {
            const { scrollTop, scrollHeight, clientHeight } = ev.target;

            // Load more messages when scrolling to top
            if (scrollTop < 100 && !this.state.isLoadingMessages && this.state.hasMoreMessages) {
                await this.loadMoreMessages();
            }
        };

        scrollElement.addEventListener("scroll", this.scrollHandler);
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
     * Check if currently streaming
     */
    get isStreaming() {
        return this.state.streamingMessageId !== null;
    }

    /**
     * Load messages for the current thread
     */
    async loadMessages() {
        if (this.currentThreadId) {
            await this.loadMessagesForThread(this.currentThreadId);
        }
    }

    /**
     * Load messages for a specific thread
     */
    async loadMessagesForThread(threadId) {
        if (this.state.isLoadingMessages || !threadId) return;

        // Ensure threadId is an integer, not a list
        const actualThreadId = Array.isArray(threadId) ? threadId[0] : threadId;
        const numericThreadId = typeof actualThreadId === 'string' ? parseInt(actualThreadId, 10) : actualThreadId;

        console.log("Loading messages for thread:", numericThreadId);
        this.state.isLoadingMessages = true;

        try {
            const result = await this.rpc("/mail/thread/messages", {
                thread_model: "llm.thread",
                thread_id: numericThreadId,
                limit: 30,
            });

            console.log("Loaded messages:", result.messages?.length || 0);
            this.state.messages = this.processMessages(result.messages || []);
            this.state.hasMoreMessages = (result.messages?.length || 0) === 30;
        } catch (error) {
            console.error("Failed to load messages:", error);
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

        // Ensure threadId is an integer
        const actualThreadId = Array.isArray(this.currentThreadId) ? this.currentThreadId[0] : this.currentThreadId;
        const numericThreadId = typeof actualThreadId === 'string' ? parseInt(actualThreadId, 10) : actualThreadId;

        this.state.isLoadingMessages = true;
        
        // Safely get scroll height
        const previousScrollHeight = this.contentRef.el ? this.contentRef.el.scrollHeight : 0;

        try {
            const result = await this.rpc("/mail/thread/messages", {
                thread_model: "llm.thread",
                thread_id: numericThreadId,
                max_id: oldestMessage.id,
                limit: 30,
            });

            const newMessages = this.processMessages(result.messages || []);
            this.state.messages = [...newMessages, ...this.state.messages];
            this.state.hasMoreMessages = newMessages.length === 30;

            // Maintain scroll position after DOM updates
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
        return rawMessages.map(msg => ({
            id: msg.id,
            body: msg.body,
            author: msg.author_id,
            date: msg.date,
            isAiMessage: msg.message_type === "llm_response",
            isStreaming: false,
            attachments: msg.attachment_ids || [],
        }));
    }

    /**
     * Handle new message creation
     */
    handleMessageCreated(messageData) {
        const processedMessage = this.processMessages([messageData])[0];

        // Mark as streaming if it's an AI message
        if (processedMessage.isAiMessage) {
            processedMessage.isStreaming = true;
            this.state.streamingMessageId = processedMessage.id;
        }

        this.state.messages.push(processedMessage);

        // Scroll to bottom for new messages
        requestAnimationFrame(() => {
            this.scrollToBottom();
        });
    }

    /**
     * Handle message updates (for streaming)
     */
    handleMessageUpdated(messageData) {
        const messageIndex = this.state.messages.findIndex(
            m => m.id === messageData.id
        );

        if (messageIndex >= 0) {
            Object.assign(this.state.messages[messageIndex], {
                body: messageData.body,
                date: messageData.date,
            });

            // Auto-scroll during streaming
            if (this.shouldAutoScroll()) {
                requestAnimationFrame(() => {
                    this.scrollToBottom({ smooth: true });
                });
            }
        }
    }

    /**
     * Check if should auto-scroll
     */
    shouldAutoScroll() {
        // Safely check if element exists
        if (!this.contentRef || !this.contentRef.el) return false;
        
        const scrollElement = this.contentRef.el;
        const { scrollTop, scrollHeight, clientHeight } = scrollElement;
        const scrollBottom = scrollHeight - scrollTop - clientHeight;

        // Auto-scroll if user is near bottom (within 100px)
        return scrollBottom < 100;
    }

    /**
     * Scroll to bottom of message list
     */
    scrollToBottom(options = {}) {
        // Safely check if element exists
        if (!this.contentRef || !this.contentRef.el) {
            console.warn("Cannot scroll - content ref not available");
            return;
        }
        
        const scrollElement = this.contentRef.el;
        const behavior = options.smooth ? "smooth" : "auto";
        
        scrollElement.scrollTo({
            top: scrollElement.scrollHeight,
            behavior,
        });
    }

    /**
     * Handle retry for failed messages
     */
    async onRetryMessage(messageId) {
        // Implementation depends on your message retry logic
        console.log("Retry message:", messageId);
    }

    /**
     * Expose translation function to template
     */
    get _t() {
        return _t;
    }
}