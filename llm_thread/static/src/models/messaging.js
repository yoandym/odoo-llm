/** @odoo-module **/

import { Record } from "@mail/core/common/record";
import { patch } from "@web/core/utils/patch";

import { Messaging } from "@mail/core/common/messaging_service";

patch(Messaging.prototype, {
    llmChat: Record.one("LLMChat", {
      default: {},
      isCausal: true,
    }),
});
