/** @odoo-module **/

import { Message } from "@mail/core/common/message";
import { patch } from "@web/core/utils/patch";
import { useState } from "@odoo/owl";
import { markup } from "@odoo/owl";

/**
 * Patch Odoo's Message component to add LLM-specific functionality
 */
patch(Message.prototype, {
    setup() {
        super.setup(...arguments);

        // Add LLM-specific state
        this.llmState = useState({
            isToolCallsExpanded: false,
            expandedToolCalls: {},
        });

    },

    /**
     * Decode HTML entities and fix double-encoded HTML
     */
    _decodeHtmlContent(content) {
        if (!content) return content;

        // Check if content has double-encoded HTML pattern like <p>&lt;p&gt;...&lt;/p&gt;</p>
        const doubleEncodedPattern = /<p>&lt;(.+?)&gt;(.+?)&lt;\/\1&gt;<\/p>/g;

        if (doubleEncodedPattern.test(content)) {
            // Fix double-encoded HTML by decoding HTML entities and unwrapping outer tags
            const decoded = content
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#x27;/g, "'");

            // Remove outer wrapper tags if they exist
            const unwrapped = decoded.replace(/^<p>(.+)<\/p>$/s, '$1');

            console.log('HTML Decoding Debug - Original:', content);
            console.log('HTML Decoding Debug - Decoded:', unwrapped);

            return unwrapped;
        }

        return content;
    },

    /**
     * Get processed message body with HTML decoding
     */
    get processedBody() {
        const body = this.props.message?.body;
        const decodedBody = this._decodeHtmlContent(body);

        // Convert HTML to markup for safe rendering in OWL
        if (decodedBody && decodedBody.includes('<')) {
            return markup(decodedBody);
        }

        return decodedBody;
    },

    /**
     * Ensure datetime property exists
     */
    get datetime() {
        return this.props.message?.datetime || this.props.message?.date || new Date().toISOString();
    },

    /**
     * Get formatted datetime short
     */
    get datetimeShort() {
        const date = new Date(this.datetime);
        return date.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
        });
    },

    /**
     * Check if this is an AI message
     */
    get isAiMessage() {
        const message = this.props.message;
        return message?.subtype_xmlid === 'llm_mail_message_subtypes.mt_llm_assistant' ||
            message?.subtype_xmlid === 'llm_mail_message_subtypes.mt_llm_tool_result' ||
            message?.message_type === 'llm_response';
    },

    /**
     * Check if this is a tool result message
     */
    get isToolResultMessage() {
        const message = this.props.message;
        return message?.subtype_xmlid === 'llm_mail_message_subtypes.mt_llm_tool_result';
    },

    /**
     * Get parsed tool calls
     */
    get parsedToolCalls() {
        if (!this.props.message?.tool_calls) return [];
        try {
            return JSON.parse(this.props.message.tool_calls);
        } catch (e) {
            console.error('Failed to parse tool calls:', e);
            return [];
        }
    },

    /**
     * Check if message has tool calls
     */
    get hasToolCalls() {
        return this.parsedToolCalls.length > 0;
    },

    /**
     * Get tool calls with their results
     */
    get toolCallsWithResults() {
        if (!this.hasToolCalls) return [];

        const toolCalls = this.parsedToolCalls;
        const toolResults = this.props.message.toolResults || [];

        return toolCalls.map(call => {
            const result = toolResults.find(r => r.tool_call_id === call.id);

            let parsedResult = null;
            let hasError = false;

            if (result?.tool_call_result) {
                try {
                    parsedResult = JSON.parse(result.tool_call_result);
                    hasError = !!parsedResult.error;
                } catch (e) {
                    console.error('Failed to parse tool result:', e);
                }
            }

            let parsedArguments = {};
            if (call.function?.arguments) {
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
    },

    /**
     * Toggle tool call expansion
     */
    toggleToolCall(toolCallId) {
        this.llmState.expandedToolCalls[toolCallId] =
            !this.llmState.expandedToolCalls[toolCallId];
    },

    /**
     * Format JSON for display
     */
    formatJSON(obj) {
        if (!obj) return '';
        return JSON.stringify(obj, null, 2);
    },

    /**
     * Check if message is streaming
     */
    get isStreaming() {
        // Check if this message is marked as streaming in the thread's context
        const threadComponent = this.props.env?.threadView?.threadComponent;
        return threadComponent?.state?.streamingMessageId === this.props.message.id;
    },

    /**
     * Get avatar data for AI messages
     */
    get avatarData() {
        if (this.isAiMessage) {
            return {
                displayName: "AI Assistant",
                avatarUrl: false,
            };
        }
        return super.avatarData;
    },
});
