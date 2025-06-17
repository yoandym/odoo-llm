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

            return unwrapped;
        }

        return content;
    },

    /**
     * Simple markdown to HTML converter for basic formatting
     */
    _convertMarkdownToHtml(text) {
        if (!text) return text;

        // Split text into lines for processing
        let lines = text.split('\n');
        let html = [];
        let inList = false;
        let listType = null;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            // Handle empty lines
            if (!line) {
                if (inList) {
                    html.push(listType === 'ul' ? '</ul>' : '</ol>');
                    inList = false;
                    listType = null;
                }
                html.push('<br>');
                continue;
            }

            // Handle headers
            if (line.match(/^#{1,6}\s/)) {
                if (inList) {
                    html.push(listType === 'ul' ? '</ul>' : '</ol>');
                    inList = false;
                    listType = null;
                }
                const level = line.match(/^#{1,6}/)[0].length;
                const text = line.replace(/^#{1,6}\s/, '');
                html.push(`<h${level}>${text}</h${level}>`);
                continue;
            }

            // Handle bullet lists
            if (line.match(/^[-*+]\s/)) {
                if (!inList || listType !== 'ul') {
                    if (inList) html.push('</ol>');
                    html.push('<ul>');
                    inList = true;
                    listType = 'ul';
                }
                const text = line.replace(/^[-*+]\s/, '');
                html.push(`<li>${this._processInlineMarkdown(text)}</li>`);
                continue;
            }

            // Handle numbered lists
            if (line.match(/^\d+\.\s/)) {
                if (!inList || listType !== 'ol') {
                    if (inList) html.push('</ul>');
                    html.push('<ol>');
                    inList = true;
                    listType = 'ol';
                }
                const text = line.replace(/^\d+\.\s/, '');
                html.push(`<li>${this._processInlineMarkdown(text)}</li>`);
                continue;
            }

            // Handle blockquotes
            if (line.match(/^>\s/)) {
                if (inList) {
                    html.push(listType === 'ul' ? '</ul>' : '</ol>');
                    inList = false;
                    listType = null;
                }
                const text = line.replace(/^>\s/, '');
                html.push(`<blockquote>${this._processInlineMarkdown(text)}</blockquote>`);
                continue;
            }

            // Handle regular paragraphs
            if (inList) {
                html.push(listType === 'ul' ? '</ul>' : '</ol>');
                inList = false;
                listType = null;
            }
            html.push(`<p>${this._processInlineMarkdown(line)}</p>`);
        }

        // Close any open lists
        if (inList) {
            html.push(listType === 'ul' ? '</ul>' : '</ol>');
        }

        return html.join('');
    },

    /**
     * Process inline markdown formatting (bold, italic, code, etc.)
     */
    _processInlineMarkdown(text) {
        if (!text) return text;

        let processed = text;

        // Convert code blocks first (to avoid processing their contents)
        processed = processed.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

        // Convert inline code
        processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Convert bold (** or __)
        processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        processed = processed.replace(/__([^_]+)__/g, '<strong>$1</strong>');

        // Convert italic (* or _)
        processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        processed = processed.replace(/_([^_]+)_/g, '<em>$1</em>');

        return processed;
    },

    /**
     * Detect if content is likely markdown
     */
    _isMarkdown(text) {
        if (!text) return false;

        // Check for common markdown patterns
        const markdownPatterns = [
            /^#{1,6}\s+/m,          // Headers (with space required)
            /\*\*[^*]+\*\*/,        // Bold
            /\*[^*\n]+\*/,          // Italic  
            /`[^`]+`/,              // Inline code
            /```[\s\S]*?```/,       // Code blocks
            /^[-*+]\s+/m,           // Bullet lists (with space required)
            /^\d+\.\s+/m,           // Numbered lists (with space required)
            /^>\s+/m                // Blockquotes (with space required)
        ];

        const hasMarkdown = markdownPatterns.some(pattern => pattern.test(text));

        // Debug logging
        if (hasMarkdown) {
            console.log('Markdown detected in text:', text.substring(0, 100) + '...');
        }

        return hasMarkdown;
    },

    /**
     * Get processed message body with HTML decoding and markdown support
     */
    get processedBody() {
        const body = this.props.message?.body;
        const decodedBody = this._decodeHtmlContent(body);

        console.log('Processing message body:', decodedBody?.substring(0, 100) + '...');

        // Check if it's markdown wrapped in basic HTML tags (like <p>)
        if (decodedBody && decodedBody.includes('<')) {
            // Extract content from basic HTML wrapper tags
            let content = decodedBody;
            
            // Remove wrapping <p> tags if they contain markdown
            if (content.match(/^<p>.*<\/p>$/s)) {
                const innerContent = content.replace(/^<p>(.*)<\/p>$/s, '$1');
                if (this._isMarkdown(innerContent)) {
                    console.log('Content detected as Markdown wrapped in HTML, converting...');
                    const htmlContent = this._convertMarkdownToHtml(innerContent);
                    console.log('Converted HTML:', htmlContent.substring(0, 200) + '...');
                    return markup(htmlContent);
                }
            }
            
            // If it's proper HTML (has multiple tags or complex structure), treat as HTML
            const htmlTagCount = (content.match(/<[^>]+>/g) || []).length;
            if (htmlTagCount > 2 || content.includes('<div') || content.includes('<span') || content.includes('<ul')) {
                console.log('Content detected as proper HTML');
                return markup(decodedBody);
            }
            
            // If it's simple HTML but contains markdown patterns, convert as markdown
            if (this._isMarkdown(content)) {
                console.log('Content detected as simple HTML with Markdown, converting...');
                const htmlContent = this._convertMarkdownToHtml(content);
                return markup(htmlContent);
            }
            
            console.log('Content detected as simple HTML');
            return markup(decodedBody);
        }

        // Check if it's markdown and convert to HTML
        if (decodedBody && this._isMarkdown(decodedBody)) {
            console.log('Content detected as plain Markdown, converting...');
            const htmlContent = this._convertMarkdownToHtml(decodedBody);
            console.log('Converted HTML:', htmlContent.substring(0, 200) + '...');
            return markup(htmlContent);
        }

        console.log('Content treated as plain text');
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
