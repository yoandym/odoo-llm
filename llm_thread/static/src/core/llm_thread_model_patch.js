/* @odoo-module */

import { Thread } from "@mail/core/common/thread_model";
import { patch } from "@web/core/utils/patch";
import { assignDefined } from "@mail/utils/common/misc";

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
    insert(data) {
        const {id, model, ...otherData} = data;
        const thread = super.insert({id, model});

        assignDefined(thread, otherData);

        thread.creator = data.create_uid
            ? { id: data.create_uid[0], name: data.create_uid[1] }
            : undefined;

        // linked document
        // the previous call to assignDefined sets model
        // we also set res_model
        thread.res_model = data.model;  

        return thread;
    },
});

patch(Thread.prototype, {
    /**
     * @override
     */
    setup() {
        super.setup();
        
        this.creator = false;

        this.create_date = false;
        this.write_date = false;

        this.model = false
        this.res_model = false;
        this.res_id = false;

        this.llm_enabled = false;
        this.tool_ids = false;
        this.prompt_id = false;

        this.isStreaming = false;
        this.eventSource = false;

    },
    
    /**
     * @override
     */
    update(data) {
        super.update(data);

        assignDefined(this, data);

        if ('create_uid' in data) {
            this.creator =  { id: data.create_uid[0], name: data.create_uid[1] };
        }

        // Single property definition - always infer from model_id
        this.llm_enabled = Boolean(this.model_id);
    },

    setStreaming(eventSource) {
        // eventSource is required
        if (!eventSource) {
            throw new Error("EventSource is required to set streaming state");
        }
        this.eventSource = eventSource;
        this.isStreaming = Boolean(eventSource);
    },

    stopStreaming() {
        this.eventSource?.close();
        this.eventSource = null;
        this.isStreaming = false;
    }
});
