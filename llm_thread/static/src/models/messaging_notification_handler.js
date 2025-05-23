/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { onWillStart, useState } from "@odoo/owl";

/**
 * Hook for listening to LLM thread deletion notifications from the bus.
 * In Odoo 17, we use bus_service directly with custom listeners instead of
 * patching a notification handler.
 *
 * @returns {Object} A state object
 */
export function useLLMThreadDeleteHandler() {
  const busService = useService("bus_service");
  const threadService = useService("mail.thread");
  const state = useState({});

  /**
   * Handle deletion of multiple LLM threads
   * @private
   * @param {Array} ids - The IDs of the threads to delete
   */
  function handleLLMThreadsDelete({ ids }) {
    for (const id of ids) {
      handleLLMThreadDelete(id);
    }
  }

  /**
   * Handle the deletion of a single LLM thread
   * @private
   * @param {Number} id - The ID of the thread to delete
   */
  function handleLLMThreadDelete(id) {
    // In Odoo 17, we access models from the store (through mail.thread service)
    const thread = threadService.getThread({ id, model: "llm.thread" });

    if (!thread) return;

    // Check and handle LLM chat relations
    if (thread.llmChat) {
      const llmChat = thread.llmChat;
      const isActiveThread =
        llmChat.activeThread && llmChat.activeThread.id === thread.id;

      // Stop any ongoing streaming
      if (isActiveThread) {
        const composer = llmChat.llmChatView?.composer;
        if (composer?.isStreaming && typeof composer._closeEventSource === "function") {
          composer._closeEventSource();
        }
      }

      // Update the LLM chat state
      const updatedData = {
        threads: (llmChat.threads || []).filter((t) => t.id !== thread.id),
      };

      if (isActiveThread) {
        updatedData.activeThread = null;
      }

      // Update the chat data
      llmChat.update?.(updatedData);
    }

    // Delete the thread from the store or call appropriate method
    thread.delete?.();
  }

  onWillStart(() => {
    // Subscribe to "llm.thread/delete" notifications
    busService.addEventListener("notification", ({ detail: notifications }) => {
      for (const { type, payload } of notifications) {
        if (type === "llm.thread/delete") {
          handleLLMThreadsDelete(payload);
        }
      }
    });
  });

  return state;
}

// Register the service for handling LLM thread delete notifications
registry.category("services").add("llm_thread_delete_handler", {
  dependencies: ["bus_service", "mail.thread"],
  start() {
    // The actual subscription logic happens in the components that use
    // the useLLMThreadDeleteHandler hook
    return {
      name: "llm_thread_delete_handler",
    };
  },
});