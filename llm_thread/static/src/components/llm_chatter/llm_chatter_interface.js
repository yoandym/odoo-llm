/** @odoo-module **/

import { Component, useState, useRef, onMounted, onWillStart } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { Deferred } from "@web/core/utils/concurrency";
import { LLMChatThreadHeader } from "../llm_chat_thread_header/llm_chat_thread_header";
import { LLMChatComposer } from "../llm_chat_composer/llm_chat_composer";

/**
 * LLM Chat Interface Component for Chatter
 * 
 * This component provides the full LLM chat interface including:
 * - Header with provider/model selection
 * - Messages display
 * - Extended LLM composer with streaming support
 */
export class LLMChatterInterface extends Component {
    static template = "llm_thread.LLMChatterInterface";
    static components = {
        LLMChatThreadHeader,
        LLMChatComposer,
    };
    static props = {
        thread: { type: Object },
        modelName: { type: String, optional: true },
        onSendMessage: { type: Function, optional: true },
    };

    setup() {
        this.llmChatService = useService("llm_chat");
        this.notificationService = useService("notification");
        this.userService = useService("user");

        this.state = useState({
            isLoadingMessages: true,
            messages: [],
            composer: null, // Will hold composer state for LLMChatComposer
        });

        this.messagesContainer = useRef("messagesContainer");
        this.composerAPI = null; // Will hold composer API from callback

        // Initialize composer state
        onWillStart(async () => {
            if (this.props.thread?.id) {
                // Create composer state compatible with LLMChatComposer
                // Include all properties that the base Composer expects
                this.state.composer = {
                    // Core text input properties
                    textInputContent: "",
                    isFocused: false,

                    // Selection state (required by base Composer)
                    selection: {
                        start: 0,
                        end: 0,
                        direction: "none"
                    },

                    // Attachment properties
                    attachments: [],
                    isUploading: false,
                    uploadingAttachments: [],

                    // Mention properties
                    mentionedChannels: [],
                    mentionedPartners: [],

                    // Canned responses
                    cannedResponses: [],

                    // Thread reference
                    thread: this.props.thread,

                    // Emoji picker state
                    showEmojiPicker: false,

                    // Additional base Composer properties that might be needed
                    isComposerSuggestion: false,
                    hasParent: false,
                    isEditing: false,

                    // Message properties
                    message: null,
                    messageToReplyTo: null,

                    // State flags
                    isExpanded: false,
                    isMinimized: false,
                };
            }
        });

        onMounted(() => {
            this.loadMessages();
            // Focus composer after mounting
            setTimeout(() => {
                if (this.composerAPI?.focus) {
                    this.composerAPI.focus();
                }
            }, 100);
        });
    }

    /**
     * Load messages for the current thread
     */
    async loadMessages() {
        if (!this.props.thread?.id) {
            this.state.isLoadingMessages = false;
            return;
        }

        try {

            const messages = await this.llmChatService.getMessages(this.props.thread.id);
            this.state.messages = messages || [];
            this.state.isLoadingMessages = false;

            // Render messages
            this.renderMessages();


        } catch (error) {
            console.error("[LLM] Failed to load messages:", error);
            this.state.isLoadingMessages = false;
            this.renderErrorMessage("Failed to load messages: " + error.message);
        }
    }

    /**
     * Render messages in the container
     */
    renderMessages() {
        const container = this.messagesContainer.el;
        if (!container) return;

        // Clear container
        container.innerHTML = '';

        if (this.state.messages.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info" role="alert">
                    <i class="fa fa-info-circle me-2"></i>
                    Welcome! This is your AI assistant. Ask me anything about this record or request help with your tasks.
                </div>
            `;
            return;
        }

        // Render each message
        this.state.messages.forEach(message => {
            const messageEl = this.createMessageElement(message);
            container.appendChild(messageEl);
        });

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    /**
     * Create a message element
     */
    createMessageElement(message) {
        const messageEl = document.createElement('div');

        // Enhanced sender detection using multiple approaches
        let isUser = this.isUserMessage(message);

        messageEl.className = `mb-3 d-flex ${isUser ? 'justify-content-end' : 'justify-content-start'}`;

        const content = this.formatMessageContent(message.content || message.body);
        const dateStr = this.formatMessageDate(message);
        const senderInfo = this.getSenderInfo(message, isUser);

        messageEl.innerHTML = `
            <div class="message-wrapper" style="max-width: 70%;">
                <div class="d-flex align-items-center mb-1 ${isUser ? 'justify-content-end' : 'justify-content-start'}">
                    <small class="text-muted">
                        ${senderInfo} • ${dateStr}
                    </small>
                </div>
                <div class="p-3 rounded ${isUser ? 'bg-primary text-white' : 'bg-light border'}">
                    <div style="white-space: pre-wrap;">${content}</div>
                </div>
            </div>
        `;

        return messageEl;
    }

    /**
     * Determine if message is from user
     */
    isUserMessage(message) {
        // Method 1: Use isFromUser field set by the service (most reliable)
        if (typeof message.isFromUser === 'boolean') {
            return message.isFromUser;
        }
        // Method 2: Check author ID against current user
        else if (message.author && message.author.id && this.userService.userId) {
            return message.author.id === this.userService.userId;
        }
        // Method 3: Check role field
        else if (message.role) {
            return message.role === 'user';
        }
        // Method 4: Check subtype for LLM messages
        else if (message.subtype_xmlid) {
            return message.subtype_xmlid.includes('llm_user');
        }
        // Method 5: Fallback - check message type and author existence
        else {
            return message.messageType === 'comment' && message.author && message.author.id;
        }
    }

    /**
     * Get sender information for display
     */
    getSenderInfo(message, isUser) {
        if (isUser) {
            // For user messages, try to get the actual author name
            let authorName = 'You';
            if (message.author && message.author.name) {
                authorName = message.author.name;
            } else if (this.userService.name) {
                authorName = this.userService.name;
            }
            return `<i class="fa fa-user me-1"></i>${authorName}`;
        } else {
            // For AI messages, check if we have specific AI info
            let aiName = 'AI Assistant';
            if (message.author && message.author.name && message.author.name !== 'AI Assistant') {
                // Sometimes the AI has a specific name from the provider
                aiName = message.author.name;
            }
            return `<i class="fa fa-robot me-1"></i>${aiName}`;
        }
    }

    /**
     * Format message date
     */
    formatMessageDate(message) {
        const dateField = message.create_date || message.createdAt || message.date || message.write_date || message.timestamp;

        if (!dateField) {
            return 'Just now';
        }

        try {
            // Handle different date formats
            let dateValue = dateField;

            // If it's a string that looks like Odoo datetime format, parse it
            if (typeof dateField === 'string') {
                // Replace space with 'T' for ISO format if needed
                dateValue = dateField.includes('T') ? dateField : dateField.replace(' ', 'T');
                // Add 'Z' if no timezone info
                if (!dateValue.includes('+') && !dateValue.includes('Z')) {
                    dateValue += 'Z';
                }
            }

            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
                // Check if date is today
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

                if (messageDate.getTime() === today.getTime()) {
                    // Today - show just time
                    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } else {
                    // Not today - show date and time
                    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
                        date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
            }
        } catch (e) {
            console.error("[LLM] Date parsing error for:", dateField, e);
        }

        return 'Recent';
    }

    /**
     * Format message content by decoding HTML entities and handling empty content
     */
    formatMessageContent(content) {
        if (!content) {
            return '<em class="text-muted">Empty message</em>';
        }

        // If content is already plain text, return it directly
        if (typeof content === 'string' && !content.includes('&') && !content.includes('<')) {
            return content;
        }

        // Create a temporary div to decode HTML entities
        const div = document.createElement('div');
        div.innerHTML = content;
        const decodedContent = div.textContent || div.innerText || '';

        return decodedContent || '<em class="text-muted">Unable to display content</em>';
    }

    /**
     * Render error message
     */
    renderErrorMessage(errorText) {
        const container = this.messagesContainer.el;
        if (!container) return;

        container.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <i class="fa fa-exclamation-triangle me-2"></i>
                ${errorText}
            </div>
        `;
    }

    /**
     * Handle message sending from composer
     * This is called by the LLMChatComposer when sendMessage is triggered
     */
    async onComposerSendMessage() {
        if (!this.state.composer?.textInputContent?.trim()) {
            return;
        }

        const message = this.state.composer.textInputContent.trim();

        try {
            // Use parent's onSendMessage if provided, or call service directly
            if (this.props.onSendMessage) {
                await this.props.onSendMessage(message);
            } else {
                // Direct service call as fallback
                await this.llmChatService.sendMessage(this.props.thread.id, message);
            }

            // Reload messages after sending
            await this.loadMessages();

        } catch (error) {
            console.error("[LLM] Failed to send message:", error);
            this.notificationService.add(
                _t("Failed to send message: ") + error.message,
                { type: "danger" }
            );
            // Re-throw so composer can handle error state
            throw error;
        }
    }

    /**
     * Refresh messages (called from parent)
     */
    async refreshMessages() {
        await this.loadMessages();
    }

    /**
     * Set composer API from callback
     */
    setComposerAPI(api) {
        this.composerAPI = api;
    }

    /**
     * Get composer API for external access
     */
    getComposerAPI() {
        return this.composerAPI;
    }
}
