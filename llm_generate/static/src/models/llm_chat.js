/** @odoo-module **/

import { registerPatch } from "@mail/model/model_core";

registerPatch({
  name: "LLMChat",
  recordMethods: {
    /**
     * Override
     * Loads LLM models from the server.
     */
    async loadLLMModels() {
      const result = await this.messaging.rpc({
        model: "llm.model",
        method: "search_read",
        kwargs: {
          domain: [],
          fields: [
            "name",
            "id",
            "provider_id",
            "default",
            "model_use",
            "input_schema",
            "output_schema",
          ],
        },
      });

      const llmModelData = result.map((model) => ({
        id: model.id,
        name: model.name,
        llmProvider: model.provider_id
          ? { id: model.provider_id[0], name: model.provider_id[1] }
          : undefined,
        default: model.default,
        modelUse: model.model_use,
        inputSchema: model.input_schema,
        outputSchema: model.output_schema,
      }));

      this.update({ llmModels: llmModelData });
    },
  },
});
