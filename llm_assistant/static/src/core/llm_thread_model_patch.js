/* @odoo-module */

import { Thread } from "@mail/core/common/thread_model";
import { patch } from "@web/core/utils/patch";
import { assignDefined } from "@mail/utils/common/misc";

/**
 * Extends Thread model to include LLM-specific properties
 * 
 * This patch adds:
 * - assistantId: ID of the attached LLM assistant if any (presence indicates LLM capabilities)
 * - assistantPartnerId: ID of the partner representing the assistant
 */
patch(Thread, {
    /**
     * @override
     */
    insert(data) {
        const {id, model, ...otherData} = data;
        const thread = super.insert({id, model});

        assignDefined(thread, otherData);

        // llm llm data
        thread.assistantId = data.assistant_id;
        thread.assistantPartnerId = data.assistant_partner_id;

        return thread;
    },
});

patch(Thread.prototype, {
    /**
     * @override
     */
    setup() {
        super.setup();
        
        this.assistantId = false;
        this.assistantPartnerId = false;

    },
    
    /**
     * @override
     */
    update(data) {
        super.update(data);

        assignDefined(this, data);
        
        // Use correct property name from server data
        if ('assistant_id' in data) {
            this.assistantId = data.assistant_id;
            // Debug log when assistant_id is received from server
        }
        
        if ('assistant_partner_id' in data) {
            this.assistantPartnerId = data.assistant_partner_id;
        }
        
    }
});
