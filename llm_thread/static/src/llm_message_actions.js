/** @odoo-module **/

import { messageActionsRegistry } from "@mail/core/common/message_actions";
import { _t } from "@web/core/l10n/translation";

/**
 * Helper function to handle the vote RPC and message update.
 * @param {object} component The component instance from which the action is called.
 * @param {object} message The message record.
 * @param {number} newVote The new vote value (1 for up, -1 for down, 0 for retract).
 * @param {number} voteValue The type of vote (1 for up, -1 for down) for error messages.
 */
async function handleVote(component, message, newVote, voteValue) {
    const currentVote = message.user_vote;
    try {
        // Optimistically update the UI
        message.update({ user_vote: newVote });

        await component.env.services.rpc("/llm/message/vote", {
            message_id: message.id,
            vote_value: newVote,
        });
        // If RPC is successful, the optimistic update is correct.
        // The message model itself should be reactive.
    } catch (error) {
        // Revert optimistic update on error
        message.update({ user_vote: currentVote });
        console.error(
            `Error voting ${voteValue === 1 ? "up" : "down"}:`,
            error
        );
        if (component.env && component.env.services.notification) {
            component.env.services.notification.add(
                _t("Failed to record vote. ") + (error.message || error),
                { type: "danger" }
            );
        } else {
            console.warn(
                "Notification service not available to display vote failure."
            );
        }
    }
}

messageActionsRegistry.add("llm_thumb_up", {
    condition: (component) => {
        // Show thumb up only for assistant messages (messages without a specific author)
        // and if the message itself is available.
        return component.props.message && !component.props.message.author;
    },
    icon: (component) => {
        const message = component.props.message;
        const isVoted = message && message.user_vote === 1;
        // Returns only the icon classes that change, common classes like 'fa fa-lg'
        // are typically handled by the component rendering the action button.
        return isVoted ? "fa-thumbs-up text-primary fw-bold" : "fa-thumbs-o-up";
    },
    title: (component) => _t("Thumb Up"),
    onClick: async (component) => {
        const message = component.props.message;
        if (!message) return;
        const currentVote = message.user_vote;
        const newVote = currentVote === 1 ? 0 : 1; // Toggle: if already voted up, retract; otherwise, vote up.
        await handleVote(component, message, newVote, 1);
    },
    sequence: 15, // Appears after standard reactions, before edit/delete
});

messageActionsRegistry.add("llm_thumb_down", {
    condition: (component) => {
        // Show thumb down only for assistant messages
        return component.props.message && !component.props.message.author;
    },
    icon: (component) => {
        const message = component.props.message;
        const isVoted = message && message.user_vote === -1;
        return isVoted ? "fa-thumbs-down text-primary fw-bold" : "fa-thumbs-o-down";
    },
    title: (component) => _t("Thumb Down"),
    onClick: async (component) => {
        const message = component.props.message;
        if (!message) return;
        const currentVote = message.user_vote;
        const newVote = currentVote === -1 ? 0 : -1; // Toggle: if already voted down, retract; otherwise, vote down.
        await handleVote(component, message, newVote, -1);
    },
    sequence: 16, // Appears right after thumb up
});

messageActionsRegistry.add("llm_post_as_note", {
    condition: (component) => {
        // Show post as note action only for assistant messages and if the thread has a related record
        const message = component.props.message;
        const thread = component.props.thread;

        return (
            message &&
            !message.author && // Assistant message only
            thread &&
            thread.model && // Thread must be linked to a model
            thread.res_id // Thread must be linked to a record
        );
    },
    icon: (component) => "fa-sticky-note-o",
    title: (component) => _t("Post as Note"),
    onClick: async (component) => {

        const message = component.props.message;
        const thread = component.props.thread;

        if (!message || !thread || !thread.model || !thread.res_id) {
            // Show a notification 
            component.env.services.notification.add(
                _t("Cannot post as note: Thread not linked to a record. Thread name: %s", thread?.name || 'Unknown'),
                { type: "warning" }
            );
            return;
        }

        try {
            // Get the message content - handle both text and HTML content
            let messageContent = message.body || message.content || '';

            // If it's HTML, we might want to preserve it, or convert to text
            // For now, let's preserve HTML content for rich formatting
            if (!messageContent) {
                component.env.services.notification.add(
                    _t("No message content to post"),
                    { type: "warning" }
                );
                return;
            }

            // Prepare the note content with context
            const noteContent = `
                <div class="llm-note-header" style="margin-bottom: 10px; padding: 8px; background-color: #f8f9fa; border-left: 4px solid #007bff; border-radius: 3px;">
                    <strong>💬 LLM Response from Thread: ${thread.name || 'Unnamed Thread'}</strong>
                    <br><small style="color: #6c757d;">Posted from LLM chat on ${new Date().toLocaleString()}</small>
                </div>
                <div class="llm-note-content">
                    ${messageContent}
                </div>
            `;

            // Post the note to the related record
            await component.env.services.rpc("/mail/message/post", {
                thread_model: thread.model,
                thread_id: thread.res_id,
                post_data: {
                    body: noteContent,
                    message_type: 'comment',
                    subtype_xmlid: 'mail.mt_note', // This makes it a note/internal message
                },
            });

            // Show success notification
            component.env.services.notification.add(
                _t("Message posted as note to %s", thread.model),
                { type: "success" }
            );

            // Refresh the chatter if it's available
            // Try to find and refresh any open chatter for this record
            component.env.bus.trigger("chatter:refresh", {
                model: thread.model,
                res_id: thread.res_id
            });

        } catch (error) {
            console.error("Error posting message as note:", error);
            component.env.services.notification.add(
                _t("Failed to post message as note: %s", error.message || error),
                { type: "danger" }
            );
        }
    },
    sequence: 17, // Appears after voting actions
});
