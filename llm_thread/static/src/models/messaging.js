/** @odoo-module **/

import { Record } from "@mail/core/common/record";
import { patch } from "@web/core/utils/patch";

import { Messaging } from "@mail/core/common/messaging_service";

patch(Messaging, {
    llmChat: Record.one("LLMChat", {
      default: {},
      isCausal: true,
    }),
});
