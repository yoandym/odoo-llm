/* @odoo-module */

import { Thread } from "@mail/core/common/thread_model";
import { patch } from "@web/core/utils/patch";
import { assignDefined } from "@mail/utils/common/misc";

/**
 * Extends Thread model to include LLM Assistant specific properties
 */
patch(Thread, {
    /**
     * @override
     */
    _insert(data) {
        const thread = super._insert(data);

        assignDefined(thread, data);

        thread._parse_assistant(data);

        return thread;
    },
});

patch(Thread.prototype, {
    /**
     * @override
     */
    setup() {
        super.setup();
        
        this.assistant = {
            id: false,
            name: false,
            partner_id: false,
        };

    },
    
    /**
     * @override
     */
    update(data) {
        super.update(data);

        assignDefined(this, data);
                
        this._parse_assistant(data);

    },

    _parse_assistant(data) {
        if (Array.isArray(data.assistant_id)) {
            // assistant_id may be an array [id, name] (at initialization)
            this.assistant.id = data.assistant_id[0];
            this.assistant.name = data.assistant_id[1];
        } else {
            // assistant_id may be just a number
            // and assistant_name comes in other property
            this.assistant.id = data.assistant_id;
        }
        if ('assistant_name' in data) {
            this.assistant.name = data.assistant_name;
        }

        // remove unwanted keys
        delete this.assistant_id;
        delete this.assistant_name;
    }
});
