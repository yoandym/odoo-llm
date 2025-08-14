/* @odoo-module */

import { Thread } from "@mail/core/common/thread_model";
import { patch } from "@web/core/utils/patch";
import { assignDefined } from "@mail/utils/common/misc";

/**
 * Extends Thread model to include LLM-specific properties
 */
patch(Thread, {
    /**
     * @override
     */
    _insert(data) {
        const thread = super._insert(data);

        assignDefined(thread, data);

        thread.creator = data.create_uid
            ? { id: data.create_uid[0], name: data.create_uid[1] }
            : undefined;

        // linked document
        // the previous call to assignDefined sets model
        // we also set res_model cauze there are places where its used
        // TODO: remove / clean
        thread.res_model = data.model;

        // TODO: remove / clean
        thread.updatedAt = data.write_date;

        // llm data
        if ('provider_id' in data && 'model_id' in data) {
            thread.llmModel = {
                id: data.model_id[0],
                name: data.model_id[1],
                llmProvider: {
                    id: data.provider_id[0],
                    name: data.provider_id[1],
                },
            };
        }

        if ('prompt_id' in data) {
            thread.prompt = {
                id: data.prompt_id[0],
                name: data.prompt_id[1],
            };
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
        
        this.creator = false;

        this.create_date = false;
        this.write_date = false;
        this.updatedAt = false;

        this.model = false
        this.res_model = false;
        this.res_id = false;

        this.llm_enabled = false;
        this.tool_ids = false;
        this.prompt_id = false;
        this.llmModel = {};

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

        if ('write_date' in data) {
            this.updatedAt = data.write_date;
        }

        // llm data
        if ('provider_id' in data && 'model_id' in data) {
            this.llmModel = {
                id: data.model_id[0],
                name: data.model_id[1],
                llmProvider: {
                    id: data.provider_id[0],
                    name: data.provider_id[1],
                },
            };
        }

        if ('prompt_id' in data) {
            this.prompt = {
                id: data.prompt_id[0],
                name: data.prompt_id[1],
            };
        }
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
