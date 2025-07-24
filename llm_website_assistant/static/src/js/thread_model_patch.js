/* @odoo-module */

import { Thread } from "@mail/core/common/thread_model";
import { patch } from "@web/core/utils/patch";

/**
 * Extends Thread model to include LLM-specific properties
 * 
 * This patch adds:
 * - isStreaming: Boolean flag indicating if the thread has an active LLM stream
 * - assistantId: ID of the attached LLM assistant if any (presence indicates LLM capabilities)
 * - assistantPartnerId: ID of the partner representing the assistant
 */
patch(Thread, {
    /**
     * @override
     */
    _insert(data) {
        const thread = super._insert(...arguments);
        
        // Process LLM specific fields from raw data
        if (data.assistant_id !== undefined) {
            thread.assistantId = data.assistant_id;
            thread.hasLLMCapabilities = Boolean(data.assistant_id);
            console.log("[LLM] Thread insert received assistant_id:", data.assistant_id, "for thread:", thread.id);
        }
        
        if (data.assistant_partner_id !== undefined) {
            thread.assistantPartnerId = data.assistant_partner_id;
        }
        
        return thread;
    },
});

patch(Thread.prototype, {
    /**
     * @override
     */
    setup() {
        super.setup();
        
        /**
         * Indicates whether this thread has an active LLM streaming connection
         * @type {boolean}
         */
        this.isStreaming = false;
        
        /**
         * ID of the LLM assistant if any
         * @type {number|false}
         */
        this.assistantId = false;
        
        /**
         * ID of the partner representing the assistant in this thread
         * @type {number|false}
         */
        this.assistantPartnerId = false;
        
        /**
         * Whether this thread has LLM capabilities
         * @type {boolean}
         */
        this.hasLLMCapabilities = false;
    },
    
    /**
     * @override
     */
    update(data) {
        super.update(data);
        
        if ('isStreaming' in data) {
            this.isStreaming = data.isStreaming;
        }
        
        // Use correct property name from server data
        if ('assistant_id' in data) {
            this.assistantId = data.assistant_id;
            // Debug log when assistant_id is received from server
            console.log("[LLM] Thread received assistant_id:", data.assistant_id, "for thread:", this.id);
        }
        
        if ('assistant_partner_id' in data) {
            this.assistantPartnerId = data.assistant_partner_id;
        }
        
        // Single property definition - always infer from assistantId
        this.hasLLMCapabilities = Boolean(this.assistantId);
    }
});
