/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";

/**
 * Form view button widget to open AI Chat for current record
 */
export class LLMFormButton extends Component {
    static template = "llm_thread.LLMFormButton";
    static props = {
        record: Object,
        className: { type: String, optional: true },
        string: { type: String, optional: true },
    };

    setup() {
        this.llmChatService = useService("llm_chat");
        this.actionService = useService("action");
        this.notificationService = useService("notification");

        this.state = useState({
            isOpening: false,
        });
    }

    /**
     * Get button text
     */
    get buttonText() {
        return this.props.string || _t("AI Chat");
    }

    /**
     * Open AI Chat for the current record
     */
    async openAIChat() {
        if (this.state.isOpening || !this.props.record) return;

        this.state.isOpening = true;

        try {
            const llmChat = this.llmChatService;

            // Ensure thread exists
            const thread = await llmChat.ensureThread({
                model: this.props.record.model,
                res_id: this.props.record.resId || this.props.record.data.id,
            });

            if (thread) {
                // Open the chat action with the thread
                await this.actionService.doAction({
                    type: "ir.actions.client",
                    tag: "llm_thread.llm_chat",
                    name: _t("AI Chat"),
                    target: "new",
                    context: {
                        active_thread_id: thread.id,
                    },
                });
            }
        } catch (error) {
            console.error("Failed to open AI chat:", error);
            this.notificationService.add(
                _t("Failed to open AI chat"),
                {
                    title: _t("Error"),
                    type: "danger",
                }
            );
        } finally {
            this.state.isOpening = false;
        }
    }
}

// Register as a field widget
registry.category("view_widgets").add("llm_chat_button", {
    component: LLMFormButton,
});

