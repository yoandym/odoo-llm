/** @odoo-module **/

import { Component, useState, useRef, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { LLMChatThreadHeader } from "../llm_chat_thread_header/llm_chat_thread_header";

/**
 * LLM Chat Interface Component for Chatter
 * 
 * This component provides the full LLM chat interface including:
 * - Header with provider/model selection
 * - Messages display
 * - Message composer
 */
export class LLMChatterInterface extends Component {
    static template = "llm_thread.LLMChatterInterface";
    static components = { LLMChatThreadHeader };
    static props = {
        thread: { type: Object },
        modelName: { type: String, optional: true },
        onSendMessage: { type: Function },
    };

    setup() {
        this.llmChatService = useService("llm_chat");
        this.notificationService = useService("notification");
        this.userService = useService("user");

        this.state = useState({
            isSending: false,
            isLoadingMessages: true,
            messages: [],
        });

        this.messagesContainer = useRef("messagesContainer");
        this.messageInput = useRef("messageInput");

        onMounted(() => {
            this.loadMessages();
            // Focus input after a short delay
            setTimeout(() => {
                if (this.messageInput.el) {
                    this.messageInput.el.focus();
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
            console.log("[LLM] Loading messages for thread:", this.props.thread.id);

            const messages = await this.llmChatService.getMessages(this.props.thread.id);
            this.state.messages = messages || [];
            this.state.isLoadingMessages = false;

            // Render messages
            this.renderMessages();

            console.log("[LLM] Loaded messages:", this.state.messages);

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
                <div class="alert alert-info">
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
            console.log("[LLM] Date parsing error for:", dateField, e);
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
            <div class="alert alert-danger">
                <i class="fa fa-exclamation-triangle me-2"></i>
                ${errorText}
            </div>
        `;
    }

    /**
     * Handle key down events in input
     */
    onKeyDown(ev) {
        if (ev.key === 'Enter' && !ev.shiftKey) {
            ev.preventDefault();
            this.sendMessage();
        }
    }

    /**
     * Send a message
     */
    async sendMessage() {
        const input = this.messageInput.el;
        if (!input?.value.trim() || this.state.isSending) {
            return;
        }

        const message = input.value.trim();
        input.value = '';
        this.state.isSending = true;

        try {
            await this.props.onSendMessage(message);

            // Reload messages after sending
            await this.loadMessages();

        } catch (error) {
            console.error("[LLM] Failed to send message:", error);
            this.notificationService.add(
                _t("Failed to send message: ") + error.message,
                { type: "danger" }
            );
        } finally {
            this.state.isSending = false;
            if (input) {
                input.focus();
            }
        }
    }

    /**
     * Refresh messages (called from parent)
     */
    async refreshMessages() {
        await this.loadMessages();
    }
}
