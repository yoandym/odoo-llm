/** @odoo-module */

import { Component, markup } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

/**
 * Markdown Renderer Component
 * Renders markdown text as HTML with proper formatting
 */
export class MarkdownRenderer extends Component {
    setup() {
        this.notification = useService("notification");
    }

    /**
     * Convert markdown text to HTML and return as markup for safe rendering
     */
    get renderedContent() {
        if (!this.props.content) {
            return markup("");
        }

        let html = this.props.content;

        // Escape HTML first to prevent XSS
        html = this.escapeHtml(html);

        // Convert headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // Convert horizontal rules
        html = html.replace(/^---$/gim, '<hr>');
        html = html.replace(/^\*\*\*$/gim, '<hr>');

        // Convert bold text
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

        // Convert italic text
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/_(.*?)_/g, '<em>$1</em>');

        // Convert code blocks
        html = html.replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>');
        html = html.replace(/`(.*?)`/g, '<code>$1</code>');

        // Convert lists
        const lines = html.split('\n');
        let inList = false;
        let listType = '';
        let processedLines = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            // Check for bullet list
            if (line.match(/^[\*\-\+]\s+(.*)$/)) {
                const content = line.replace(/^[\*\-\+]\s+/, '');
                if (!inList || listType !== 'ul') {
                    if (inList) processedLines.push(`</${listType}>`);
                    processedLines.push('<ul>');
                    inList = true;
                    listType = 'ul';
                }
                processedLines.push(`<li>${content}</li>`);
            }
            // Check for numbered list
            else if (line.match(/^\d+\.\s+(.*)$/)) {
                const content = line.replace(/^\d+\.\s+/, '');
                if (!inList || listType !== 'ol') {
                    if (inList) processedLines.push(`</${listType}>`);
                    processedLines.push('<ol>');
                    inList = true;
                    listType = 'ol';
                }
                processedLines.push(`<li>${content}</li>`);
            }
            else {
                if (inList) {
                    processedLines.push(`</${listType}>`);
                    inList = false;
                    listType = '';
                }
                processedLines.push(line);
            }
        }
        
        if (inList) {
            processedLines.push(`</${listType}>`);
        }

        html = processedLines.join('\n');

        // Convert line breaks and paragraphs
        const blocks = html.split(/\n\n+/);
        html = blocks.map(block => {
            // Don't wrap if already wrapped in block elements
            if (block.match(/^<(h[1-6]|p|ul|ol|pre|hr)/)) {
                return block;
            }
            return `<p>${block.replace(/\n/g, '<br>')}</p>`;
        }).join('\n');

        // Return as markup to allow HTML rendering
        return markup(html);
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Copy content to clipboard
     */
    async copyToClipboard() {
        try {
            await navigator.clipboard.writeText(this.props.content);
            this.notification.add("Content copied to clipboard", {
                type: "success",
            });
        } catch (error) {
            this.notification.add("Failed to copy content", {
                type: "danger",
            });
        }
    }
}

MarkdownRenderer.template = "web_json_editor.MarkdownRenderer";
MarkdownRenderer.props = {
    content: { type: String, optional: true },
    showCopyButton: { type: Boolean, optional: true },
    class: { type: String, optional: true },
};
