/** @odoo-module **/

import { attr } from "@mail/model/model_field";
import { registerPatch } from "@mail/model/model_core";

registerPatch({
  name: "LLMModel",
  recordMethods: {
    /**
     * Get the effective input schema for a specific thread
     * @param {Thread} thread - The thread to get the schema for
     * @returns {Object} The effective input schema
     */
    getEffectiveInputSchemaForThread(thread) {
      if (!thread || !this.isMediaGenerationModel) {
        return this.inputSchema;
      }
      // Store the current thread context
      this.update({ currentThreadContext: thread });

      // Calculate and return the schema
      return this.effectiveInputSchema;
    },
  },
  fields: {
    modelUse: attr(), // Field to store the model's use case, e.g., 'chat', 'image_generation'
    inputSchema: attr({
      default: null, // Stores the JSON schema for input parameters
    }),
    outputSchema: attr({
      default: null, // Stores the JSON schema for output parameters
    }),
    isMediaGenerationModel: attr({
      compute() {
        const result = ["image_generation"].includes(this.modelUse);
        return result;
      },
    }),
    // Computed property that returns the effective input schema
    // Priority order:
    // 1. If an assistant is selected, use its prompt's schema with evaluated default values
    // 2. If a prompt is selected directly on the thread, use its schema
    // 3. Otherwise, use the model's input schema
    // Store the current thread context for schema computation
    currentThreadContext: attr({
      default: null,
    }),

    effectiveInputSchema: attr({
      compute() {
        // Use the stored thread context or find a thread if not available
        const thread =
          this.currentThreadContext ||
          this.messaging.models.Thread.all().find(
            (t) => t.llmModel && t.llmModel.id === this.id
          );

        if (!thread || !this.isMediaGenerationModel) {
          return this.inputSchema;
        }

        // Start with the model's input schema
        let baseSchema = this.inputSchema;
        let schemaObj = null;

        try {
          // Priority 1: If an assistant is selected and it has a prompt, use that prompt's schema
          if (thread.llmAssistant && thread.llmAssistant.llmPrompt) {
            // Get the prompt's schema
            const promptSchema = thread.llmAssistant.llmPrompt.inputSchemaJson;
            if (promptSchema) {
              baseSchema = promptSchema;
            }
          }
          // Priority 2: If a prompt is selected directly on the thread, use its schema
          else if (thread.prompt_id) {
            // Use the input_schema_json field which contains a properly formatted JSON schema
            if (thread.prompt_id.inputSchemaJson) {
              baseSchema = thread.prompt_id.inputSchemaJson;
            }
          }

          // Parse the schema if it's a string
          schemaObj =
            typeof baseSchema === "string"
              ? JSON.parse(baseSchema)
              : baseSchema;

          // If an assistant is selected and it has evaluated default values, apply them to the schema
          if (
            thread.llmAssistant &&
            thread.llmAssistant.evaluatedDefaultValues
          ) {
            try {
              // Find the assistant in the llmAssistants collection to get the most up-to-date values
              const assistants = thread.llmChat?.llmAssistants;

              if (assistants) {
                const assistant = assistants.find(
                  (a) => a.id === thread.llmAssistant.id
                );

                if (assistant && assistant.evaluatedDefaultValues) {
                  // Parse the evaluated default values
                  const evaluatedDefaults = JSON.parse(
                    assistant.evaluatedDefaultValues
                  );

                  // If we have a valid schema object, update its defaults with the evaluated values
                  if (schemaObj && schemaObj.properties) {
                    // Create a new schema object to avoid modifying the original
                    const updatedSchema = JSON.parse(JSON.stringify(schemaObj));

                    // Update the default values in the schema
                    Object.entries(evaluatedDefaults).forEach(
                      ([key, value]) => {
                        if (updatedSchema.properties[key]) {
                          updatedSchema.properties[key].default = value;
                        }
                      }
                    );

                    // Return the updated schema
                    return typeof baseSchema === "string"
                      ? JSON.stringify(updatedSchema)
                      : updatedSchema;
                  }
                }
              }
            } catch (error) {
              console.error(
                "[DEBUG] Error applying assistant defaults to schema:",
                error
              );
            }
          }
          // Return the base schema if no modifications were made
          return baseSchema;
        } catch (error) {
          console.error("Error processing schema:", error);
          return this.inputSchema;
        }
      },
    }),
  },
});
