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
