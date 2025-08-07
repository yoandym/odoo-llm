/* @odoo-module */

import { ThreadService } from "@mail/core/common/thread_service";
import { patch } from "@web/core/utils/patch";

patch(ThreadService.prototype, {
    getFetchParams(thread) {
        if (thread.llm_enabled) {
            return { channel_id: thread.id };
        }
        return super.getFetchParams(thread);
    }
});