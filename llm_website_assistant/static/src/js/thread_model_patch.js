/* @odoo-module */

import { Thread } from "@mail/core/common/thread_model";
import { patch } from "@web/core/utils/patch";

/**
 * Extends Thread model to include LLM-specific properties
 * 
 * This patch adds:
 * - isStreaming: Boolean flag indicating if the thread has an active LLM stream
 */
patch(Thread.prototype, {
    setup() {
        super.setup();
        
        /**
         * Indicates whether this thread has an active LLM streaming connection
         * @type {boolean}
         */
        this.isStreaming = false;
    }
});
