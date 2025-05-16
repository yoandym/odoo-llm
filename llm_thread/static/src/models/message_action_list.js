/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { Record } from "@mail/core/common/record";

// 1. Patch MessageActionList to add compute fields for our custom actions
patch(MessageActionList, {
  actionThumbUp: Record.one("MessageAction", {
    compute() {
      // Show thumb up only for assistant messages
      if (this.message && !this.message.author) {
        return {};
      }
      return null;
    },
    inverse: "messageActionListOwnerAsThumbUp",
  }),
  actionThumbDown: Record.one("MessageAction", {
    compute() {
      // Show thumb down only for assistant messages
      if (this.message && !this.message.author) {
        return {};
      }
      return null;
    },
    inverse: "messageActionListOwnerAsThumbDown",
  }),
});
