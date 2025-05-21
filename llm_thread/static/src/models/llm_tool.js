/** @odoo-module **/

import { Record } from "@mail/core/common/record";

export class LLMTool extends Record {
    id = Record.attr({
      identifying: true,
    });
    name = Record.attr({
      required: true,
    });
}

LLMTool.register();