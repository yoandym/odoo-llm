/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { markup } from "@odoo/owl";

/**
 * LLMMessage Component with proper HTML handling
 */
export class LLMMessage extends Component {
    static template = "llm_thread.LLMMessage";
    static props = {
        message: { type: Object },
        isStreaming: { type: Boolean, optional: true },
    };

    setup() {
        this.userService = useService("user");

        this.state = useState({
            isToolCallsExpanded: false,
        });
    }

    /**
     * Get message body as safe HTML
     * Using Owl's markup function to safely render HTML
     */
    get messageBody() {
        if (!this.props.message?.body) {
            return "";
        }

        // For AI messages, render HTML
        if (this.props.message.isAiMessage) {
            return markup(this.props.message.body);
        }

        // For user messages, we need to extract text content from HTML
        // Create a temporary element to parse the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = this.props.message.body;

        // Get the text content (this strips all HTML tags)
        const textContent = tempDiv.textContent || tempDiv.innerText || '';

        // Convert line breaks to <br> tags for display
        const withLineBreaks = textContent.replace(/\n/g, '<br>');

        // Return as markup so line breaks are rendered
        return markup(withLineBreaks);
    }

    /**
     * Check if this is the current user's message
     */
    get isOwnMessage() {
        return this.props.message.author &&
            this.props.message.author[0] === this.userService.userId;
    }

    /**
     * Get message container classes
     */
    get messageClass() {
        const classes = ["o-mail-Message", "position-relative", "pt-1", "pb-1"];

        if (this.isOwnMessage) {
            classes.push("o-selfAuthored");
        }

        if (this.props.message.isAiMessage) {
            classes.push("o-ai-message");
        }

        if (this.props.isStreaming) {
            classes.push("o-streaming");
        }

        return classes.join(" ");
    }

    /**
     * Get author name
     */
    get authorName() {
        // First try to get from author field
        if (this.props.message.author && this.props.message.author[1]) {
            return this.props.message.author[1];
        }
        
        // Fallback to extracting from email_from
        if (this.props.message.email_from) {
            // Extract name from email format "Name" <email@domain> or Name <email@domain>
            const match = this.props.message.email_from.match(/^"?([^"<]+?)"?\s*</);
            if (match) {
                return match[1].trim();
            }
        }
        
        return this.props.message.isAiMessage ? _t("AI Assistant") : _t("Unknown");
    }

    /**
     * Get avatar URL or icon
     */
    get avatarSrc() {
        if (this.props.message.author && this.props.message.author[0]) {
            return `/web/image/res.partner/${this.props.message.author[0]}/avatar_128`;
        }
        return null;
    }

    /**
     * Format message date
     */
    get formattedDate() {
        const date = new Date(this.props.message.date);
        return date.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    /**
     * Toggle tool calls expansion
     */
    toggleToolCallsExpansion() {
        this.state.isToolCallsExpanded = !this.state.isToolCallsExpanded;
    }
}