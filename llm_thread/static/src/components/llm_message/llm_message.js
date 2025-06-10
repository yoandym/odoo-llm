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
            expandedToolCalls: {}, // Track which tool calls are expanded
            isExpanded: false, // For simple tool message expansion
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
        if (this.isAiMessage) {
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

        if (this.isAiMessage) {
            classes.push("o-ai-message");
        }

        if (this.props.isStreaming) {
            classes.push("o-streaming");
        }

        return classes.join(" ");
    }

    /**
     * Check if this is an AI message
     */
    get isAiMessage() {
        // Check if it's an assistant message or tool result message
        return this.props.message.subtype_xmlid === 'llm_mail_message_subtypes.mt_llm_assistant' ||
               this.props.message.subtype_xmlid === 'llm_mail_message_subtypes.mt_llm_tool_result';
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
        
        return this.isAiMessage ? _t("AI Assistant") : _t("Unknown");
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

    /**
     * Toggle individual tool call expansion
     */
    toggleToolCall(toolCallId) {
        this.state.expandedToolCalls[toolCallId] = !this.state.expandedToolCalls[toolCallId];
    }

    /**
     * Get parsed tool calls
     */
    get parsedToolCalls() {
        if (!this.props.message.tool_calls) {
            return [];
        }
        try {
            return JSON.parse(this.props.message.tool_calls);
        } catch (e) {
            console.error('Failed to parse tool calls:', e);
            return [];
        }
    }

    /**
     * Check if message has tool calls
     */
    get hasToolCalls() {
        return this.parsedToolCalls.length > 0;
    }

    /**
     * Get parsed tool call definition
     */
    get parsedToolCallDefinition() {
        if (!this.props.message.tool_call_definition) {
            return null;
        }
        try {
            return JSON.parse(this.props.message.tool_call_definition);
        } catch (e) {
            console.error('Failed to parse tool call definition:', e);
            return null;
        }
    }

    /**
     * Get parsed tool call result
     */
    get parsedToolCallResult() {
        if (!this.props.message.tool_call_result) {
            return null;
        }
        try {
            return JSON.parse(this.props.message.tool_call_result);
        } catch (e) {
            console.error('Failed to parse tool call result:', e);
            return null;
        }
    }

    /**
     * Check if this is a tool result message
     */
    get isToolResultMessage() {
        // Check by subtype_xmlid
        if (this.props.message.subtype_xmlid === 'llm_mail_message_subtypes.mt_llm_tool_result') {
            return true;
        }
        
        // Alternative check: if message has tool_call_id or tool_call_result
        if (this.props.message.tool_call_id || this.props.message.tool_call_result) {
            return true;
        }
        
        return false;
    }

    /**
     * Format JSON for display
     */
    formatJSON(obj) {
        if (!obj) return '';
        return JSON.stringify(obj, null, 2);
    }

    /**
     * Toggle simple expansion for tool messages
     */
    toggleExpansion() {
        this.state.isExpanded = !this.state.isExpanded;
    }

    /**
     * Get tool name from author
     */
    get toolName() {
        if (this.parsedToolCallDefinition?.function?.name) {
            return this.parsedToolCallDefinition.function.name;
        }
        // Use the author name as tool name
        return this.authorName;
    }

    /**
     * Get combined tool information
     */
    get toolCallsWithResults() {
        if (!this.hasToolCalls) {
            return [];
        }

        const toolCalls = this.parsedToolCalls;
        const toolResults = this.props.message.toolResults || [];

        // Map tool calls with their results
        return toolCalls.map(call => {
            const result = toolResults.find(r => r.tool_call_id === call.id);
            
            // Parse the result data if available
            let parsedResult = null;
            let hasError = false;
            
            if (result && result.tool_call_result) {
                try {
                    const resultData = JSON.parse(result.tool_call_result);
                    parsedResult = resultData;
                    hasError = !!resultData.error;
                } catch (e) {
                    console.error('Failed to parse tool result:', e);
                }
            }
            
            // Parse the arguments if available
            let parsedArguments = {};
            if (call.function && call.function.arguments) {
                try {
                    parsedArguments = JSON.parse(call.function.arguments);
                } catch (e) {
                    console.error('Failed to parse tool arguments:', e);
                }
            }
            
            return {
                ...call,
                result: result || null,
                parsedResult: parsedResult,
                hasError: hasError,
                parsedArguments: parsedArguments
            };
        });
    }

    /**
     * Create click handler for tool call
     */
    getToolCallClickHandler(toolCallId) {
        return () => this.toggleToolCall(toolCallId);
    }
}