/** @odoo-module **/

/**
 * Alternative implementation using registry for client action
 * This is the recommended approach for v17
 */
import { registry } from "@web/core/registry";
import { Component, xml } from "@odoo/owl";
import { LLMChatContainer } from "./components/llm_chat_container/llm_chat_container";

class LLMChatClientAction extends Component {
  static template = xml`
        <LLMChatContainer
            action="props.action"
        />
    `;
  static components = { LLMChatContainer };
  static props = {
    action: { type: Object },
    actionId: { type: Number, optional: true },
    className: { type: String, optional: true },
    // These are common props that Odoo client actions receive
    actionProps: { type: Object, optional: true },
    globalState: { type: Object, optional: true },
    breadcrumbs: { type: Array, optional: true },
  };
}

// Register as a client action
registry.category("actions").add("llm_thread.chat_client_action", LLMChatClientAction);