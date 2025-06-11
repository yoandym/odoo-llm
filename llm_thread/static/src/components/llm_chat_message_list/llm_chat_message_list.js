/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { LLMMessage } from "../llm_message/llm_message";
import { LLMStreamingIndicator } from "../llm_streaming_indicator/llm_streaming_indicator";

/**
 * LLMChatMessageList Component for Odoo v17
 * 
 * Displays the list of messages in an LLM chat thread.
 * Handles both regular messages and streaming AI responses.
 */
export class LLMChatMessageList extends Component {
    static template = "llm_thread.LLMChatMessageList";
    static components = {
        LLMMessage,  // Use our custom LLMMessage component
        LLMStreamingIndicator,
    };
    static props = {
        messages: { type: Array, optional: true },
        isLoading: { type: Boolean, optional: true },
        hasMore: { type: Boolean, optional: true },
        streamingMessageId: { type: [String, Number], optional: true },
        onRetryMessage: { type: Function, optional: true },
        className: { type: String, optional: true },
    };
    static defaultProps = {
        messages: [],
        isLoading: false,
        hasMore: false,
        // streamingMessageId is optional and conditionally passed
    };

    setup() {
        // Services
        this.userService = useService("user");

        // State
        this.state = useState({
            hoveredMessageId: null,
        });
    }

    /**
     * Get container classes
     */
    get containerClass() {
        const classes = ["o_LLMChatMessageList", "d-flex", "flex-column"];
        if (this.props.className) {
            classes.push(this.props.className);
        }
        return classes.join(" ");
    }

    /**
     * Group messages by date
     */
    get groupedMessages() {
        const groups = [];
        let currentDate = null;
        let currentGroup = null;

        for (const message of this.props.messages) {
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
     * Check if a message is from the current user
     */
    isOwnMessage(message) {
        return message.author && message.author[0] === this.userService.userId;
    }

    /**
     * Check if a message is currently streaming
     */
    isMessageStreaming(message) {
        return message.id === this.props.streamingMessageId;
    }

    /**
     * Get message classes
     */
    getMessageClass(message) {
        const classes = ["o_LLMChatMessage", "mb-3"];

        if (this.isOwnMessage(message)) {
            classes.push("o-own");
        }

        if (message.isAiMessage) {
            classes.push("o-ai");
        }

        if (this.isMessageStreaming(message)) {
            classes.push("o-streaming");
        }

        if (this.state.hoveredMessageId === message.id) {
            classes.push("o-hovered");
        }

        return classes.join(" ");
    }

    /**
     * Handle message hover
     */
    onMessageHover(messageId) {
        this.state.hoveredMessageId = messageId;
    }

    /**
     * Handle message leave
     */
    onMessageLeave() {
        this.state.hoveredMessageId = null;
    }

    /**
     * Handle retry click
     */
    onRetryClick(messageId) {
        if (this.props.onRetryMessage) {
            this.props.onRetryMessage(messageId);
        }
    }

    /**
     * Format message time
     */
    formatMessageTime(date) {
        return new Date(date).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
        });
    }
}