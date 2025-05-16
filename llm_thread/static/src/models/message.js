/** @odoo-module **/

import { Record } from "@mail/core/common/record";
import { patch } from "@web/core/utils/patch";

/**
 * Helper function to safely parse JSON strings.
 * Returns defaultValue if parsing fails or input is invalid.
 * @param {String} jsonString - JSON string to parse
 * @param {any} [defaultValue=undefined] - Default value on failure
 * @returns {any} Parsed JSON or defaultValue
 */
function safeJsonParse(jsonString, defaultValue = undefined) {
  if (!jsonString || typeof jsonString !== "string") {
    return defaultValue;
  }
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    // Console.warn("Failed to parse JSON string:", jsonString, e); // Optional logging
    return defaultValue;
  }
}

patch(Message, {
  /**
   * @override
   */
  convertData(data) {
    const data2 = this._super(data);
    if ("user_vote" in data) {
      data2.user_vote = data.user_vote;
    }
    if ("subtype_xmlid" in data) {
      data2.messageSubtypeXmlid = data.subtype_xmlid;
    }
    if ("tool_call_definition" in data) {
      data2.toolCallDefinition = data.tool_call_definition;
    }
    if ("tool_call_result" in data) {
      data2.toolCallResult = data.tool_call_result;
    }
    if ("tool_calls" in data) {
      data2.toolCallCalls = data.tool_calls;
    }
    if ("tool_call_id" in data && data.tool_call_id !== null) {
      data2.toolCallId = data.tool_call_id;
    }
    return data2;
  },

  user_vote: Record.attr({
    default: 0,
  }),
  /**
   * Compute parsed tool call definition from llm_tool_call_definition field.
   */
  toolCallDefinition: Record.attr({}),
  toolCallDefinitionFormatted: Record.attr({
    compute() {
      return safeJsonParse(this.toolCallDefinition);
    },
  }),
  toolCallResult: Record.attr({
    default: "",
  }),
  toolCallId: Record.attr({
    default: null,
  }),
  /**
   * Compute parsed tool call result data from llm_tool_call_result field.
   */
  toolCallResultData: Record.attr({
    compute() {
      // Uses the field added by llm_thread's python patch
      return safeJsonParse(this.toolCallResult);
    },
  }),
  /**
   * Compute boolean indicating if the tool call result is an error.
   */
  toolCallResultIsError: Record.attr({
    compute() {
      const resultData = this.toolCallResultData;
      // Check if it's an object and has an 'error' key
      return (
        typeof resultData === "object" &&
        resultData !== null &&
        "error" in resultData
      );
    },
  }),
  /**
   * Compute formatted tool call result string (e.g., pretty JSON).
   */
  toolCallResultFormatted: Record.attr({
    compute() {
      const resultData = this.toolCallResultData;
      if (resultData === undefined || resultData === null) {
        return "";
      }
      try {
        // Only pretty print if it's likely an object/array
        return typeof resultData === "object"
          ? JSON.stringify(resultData, null, 2)
          : String(resultData);
      } catch (e) {
        console.error("Error formatting tool call result:", e);
        return String(resultData);
      }
    },
  }),
  toolCallCalls: Record.attr({
    default: [],
  }),
  /**
   * Compute parsed list of tool calls requested by an assistant message.
   */
  formattedToolCalls: Record.attr({
    compute() {
      // Uses the field added by llm_thread's python patch
      // parseJson returns undefined on failure, default to empty array for template
      return safeJsonParse(this.toolCallCalls, []);
    },
  }),
  /**
   * Compute the subtype XML ID (useful for templates).
   * Requires message_format to add subtype_xmlid to the payload.
   */
  messageSubtypeXmlid: Record.attr({}),
});
