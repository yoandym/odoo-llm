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
    insert(data) {
        const {id, model, ...otherData} = data;
        const thread = super.insert({id, model});

        assignDefined(thread, otherData);

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
        if ('assistant_partner_id' in data) {
            this.assistant.partner_id = data.assistant_partner_id;
        }

        // remove unwanted keys
        delete this.assistant_id;
        delete this.assistant_name;
        delete this.assistant_partner_id;
    }
});
