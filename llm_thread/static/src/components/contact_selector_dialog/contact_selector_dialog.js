/** @odoo-module **/

import { Dialog } from "@web/core/dialog/dialog";
import { Component, useState } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";

export class ContactSelectorDialog extends Component {
    static template = "llm_thread.ContactSelectorDialog";
    static components = { Dialog };
    static props = {
        close: Function,
        thread: { type: Object, optional: true },
        messageContent: String,
        onSendMessage: { type: Function, optional: true },
    };

    setup() {
        this.rpc = useService("rpc");
        this.notification = useService("notification");
        this.orm = useService("orm");

        this.state = useState({
            selectedPartners: [], // Changed to array for multiple selection
            isSending: false,
            searchTerm: "",
            searchResults: [],
            isSearching: false,
            isLoadingFollowers: false,
        });

        // Load followers if thread has model and res_id
        this.loadFollowers();
    }

    async loadFollowers() {
        if (!this.props.thread?.model || !this.props.thread?.res_id) {
            return;
        }

        this.state.isLoadingFollowers = true;

        try {
            // Fetch followers of the related record
            let followerPartners = [];

            // Try method 1: Get suggested recipients (more comprehensive)
            try {
                const followers = await this.orm.call(
                    this.props.thread.model,
                    'message_get_suggested_recipients',
                    [this.props.thread.res_id]
                );

                // The result is typically an array with partner info
                if (followers && followers[this.props.thread.res_id]) {
                    const recipientData = followers[this.props.thread.res_id];
                    for (const recipient of recipientData) {
                        if (recipient[0] && recipient[1]) { // [partner_id, display_name, email_or_reason]
                            followerPartners.push({
                                id: recipient[0],
                                name: recipient[1],
                                email: recipient[2] && recipient[2].includes('@') ? recipient[2] : null,
                            });
                        }
                    }
                }
            } catch (suggestedError) {
                console.warn("Failed to get suggested recipients:", suggestedError);
            }

            // Method 2: If no followers found via suggested recipients, try getting actual followers
            if (followerPartners.length === 0) {
                try {
                    const followerRecords = await this.orm.searchRead(
                        "mail.followers",
                        [['res_model', '=', this.props.thread.model], ['res_id', '=', this.props.thread.res_id]],
                        ['partner_id']
                    );

                    if (followerRecords.length > 0) {
                        const partnerIds = followerRecords.map(f => f.partner_id[0]);
                        const partners = await this.orm.searchRead(
                            "res.partner",
                            [['id', 'in', partnerIds], ['active', '=', true]],
                            ['id', 'name', 'email', 'display_name']
                        );

                        for (const partner of partners) {
                            followerPartners.push({
                                id: partner.id,
                                name: partner.display_name || partner.name,
                                email: partner.email,
                            });
                        }
                    }
                } catch (followersError) {
                    console.warn("Failed to get mail followers:", followersError);
                }
            }

            // Pre-populate with followers (remove duplicates by ID)
            const uniqueFollowers = followerPartners.filter((partner, index, self) =>
                index === self.findIndex(p => p.id === partner.id)
            );

            this.state.selectedPartners = uniqueFollowers;

        } catch (error) {
            console.error("Error loading followers:", error);
            // Don't show error to user, just continue with empty selection
        } finally {
            this.state.isLoadingFollowers = false;
        }
    }

    async onContactSearch(ev) {
        const searchTerm = ev.target.value.trim();
        this.state.searchTerm = searchTerm;

        if (searchTerm.length < 2) {
            this.state.searchResults = [];
            return;
        }

        this.state.isSearching = true;

        try {
            // Search for partners by name or email
            const domain = [
                '|', '|',
                ['name', 'ilike', searchTerm],
                ['email', 'ilike', searchTerm],
                ['display_name', 'ilike', searchTerm],
                ['active', '=', true]
            ];

            const partners = await this.orm.searchRead(
                "res.partner",
                domain,
                ["id", "name", "email", "display_name"],
                { limit: 10 }
            );

            // Filter out already selected partners
            const selectedIds = this.state.selectedPartners.map(p => p.id);
            this.state.searchResults = partners.filter(partner => !selectedIds.includes(partner.id));
        } catch (error) {
            console.error("Error searching partners:", error);
            this.state.searchResults = [];
        } finally {
            this.state.isSearching = false;
        }
    }

    onSearchKeyDown(ev) {
        // Handle Enter key to select first result
        if (ev.key === 'Enter' && this.state.searchResults.length > 0) {
            ev.preventDefault();
            this.selectPartner(this.state.searchResults[0]);
        }
        // Handle Escape key to clear search
        else if (ev.key === 'Escape') {
            this.state.searchTerm = "";
            this.state.searchResults = [];
        }
    }

    selectPartner(partner) {
        // Check if partner is already selected
        const isAlreadySelected = this.state.selectedPartners.some(p => p.id === partner.id);

        if (!isAlreadySelected) {
            // Add partner to selection
            this.state.selectedPartners.push({
                id: partner.id,
                name: partner.display_name || partner.name,
                email: partner.email
            });
        }

        // Clear search
        this.state.searchTerm = "";
        this.state.searchResults = [];
    }

    removePartner(partnerId) {
        this.state.selectedPartners = this.state.selectedPartners.filter(p => p.id !== partnerId);
    }

    async onSendMessage() {
        if (!this.state.selectedPartners.length) {
            this.notification.add(
                _t("Please select at least one contact"),
                { type: "warning" }
            );
            return;
        }

        this.state.isSending = true;

        try {
            // Prepare the message content with context
            const formattedContent = `
                <div class="llm-message-header" style="margin-bottom: 10px; padding: 8px; background-color: #e8f5e8; border-left: 4px solid #4caf50; border-radius: 3px;">
                    <strong>🤖 LLM Assistant Response</strong>
                    <br><small style="color: #666;">Shared from LLM chat "${this.props.thread?.name || 'Unnamed Thread'}" on ${new Date().toLocaleString()}</small>
                </div>
                <div class="llm-message-content">
                    ${this.props.messageContent}
                </div>
            `;

            // Send message to each selected partner
            const sendPromises = this.state.selectedPartners.map(partner =>
                this.rpc("/mail/message/post", {
                    thread_model: "res.partner",
                    thread_id: partner.id,
                    post_data: {
                        body: formattedContent,
                        message_type: 'comment',
                        subtype_xmlid: 'mail.mt_comment',
                        partner_ids: [partner.id], // Ensure the partner gets notified
                    },
                })
            );

            await Promise.all(sendPromises);

            // Show success notification
            if (this.state.selectedPartners.length === 1) {
                this.notification.add(
                    _t("Message sent to %s", this.state.selectedPartners[0].name),
                    { type: "success" }
                );
            } else {
                const partnerNames = this.state.selectedPartners.slice(0, 3).map(p => p.name).join(', ');
                const remainingCount = this.state.selectedPartners.length - 3;
                const namesList = remainingCount > 0
                    ? _t("%s and %s more", partnerNames, remainingCount)
                    : partnerNames;

                this.notification.add(
                    _t("Message sent to %s contacts: %s", this.state.selectedPartners.length, namesList),
                    { type: "success" }
                );
            }

            // Close the dialog
            this.props.close();

        } catch (error) {
            console.error("Error sending message to contacts:", error);
            this.notification.add(
                _t("Failed to send message: %s", error.message || error),
                { type: "danger" }
            );
        } finally {
            this.state.isSending = false;
        }
    }

    onCancel() {
        this.props.close();
    }
}
