/** @odoo-module **/

import { registry } from "@web/core/registry";

/**
 * Register LLM message types with Odoo's mail system
 */
const llmMessageTypeService = {
    name: "llm.message_type",
    
    start() {
        // Register custom message subtypes
        const subtypeRegistry = registry.category("mail.message_subtypes");
        
        // Assistant message subtype
        subtypeRegistry.add("llm_mail_message_subtypes.mt_llm_assistant", {
            name: "AI Assistant",
            icon: "fa-robot",
            trackingType: "llm_assistant",
        });
        
        // Tool result message subtype
        subtypeRegistry.add("llm_mail_message_subtypes.mt_llm_tool_result", {
            name: "Tool Result",
            icon: "fa-wrench",
            trackingType: "llm_tool_result",
        });

        // Register message actions
        const actionRegistry = registry.category("mail.message_actions");
        
        // Retry action for failed AI messages
        actionRegistry.add("retry_llm_message", {
            name: "Retry",
            icon: "fa-refresh",
            sequence: 10,
            condition: (component) => {
                const message = component.props.message;
                return message?.subtype_xmlid === 'llm_mail_message_subtypes.mt_llm_assistant' && 
                       message?.is_failed;
            },
            onClick: async (component) => {
                const message = component.props.message;
                // Implement retry logic
                console.log("Retry message:", message.id);
            },
        });
    },
};

registry.category("services").add("llm.message_type", llmMessageTypeService);
