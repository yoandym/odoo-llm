/* @odoo-module */

import { LivechatService } from "@im_livechat/embed/common/livechat_service";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";
import { markup } from "@odoo/owl";

/**
 * Extended LivechatService with LLM capabilities
 * 
 * This service extension handles:
 * - LLM thread management
 * - SSE streaming for real-time responses
 * - Network communication with LLM endpoints
 * - Message processing for LLM conversations
 */
patch(LivechatService.prototype, {
    /**
     * Setup LLM-specific properties
     */
    setup(env, services) {
        super.setup(env, services);
        
        // Store env for later use
        this.env = env;
        
        // LLM thread management - only keep EventSource instances
        this.llmStreamSources = new Map(); // threadId -> EventSource
        
    },

    /**
     * Stop streaming for a thread and clean up resources
     * 
     * @param {number} threadId - The thread ID
     */
    stopLLMStreaming(threadId) {
        const eventSource = this.llmStreamSources.get(threadId);
        if (eventSource) {
            console.log(`[stopLLMStreaming] Stopping stream for thread ${threadId}`);
            eventSource.close();
            this.llmStreamSources.delete(threadId);
            
            // Fire streaming_stop event
            this.busService.trigger('streaming_stop', { threadId });
            
        } else {
            console.log(`[stopLLMStreaming] No active stream found for thread ${threadId}`);
        }
    },
    


    /**
     * Trigger LLM response generation for a message that was already posted
     * This method should be called after a message has been posted through the standard Composer flow
     * 
     * @param {number} threadId - The thread ID
     * @param {number} messageId - The ID of the message to generate a response for
     * @return {Promise<Object>} Result with success status
     */
    async triggerLLMResponseForMessage(threadId, messageId) {
        try {
            if (!threadId || !messageId) {
                throw new Error("Thread ID and message ID are required");
            }
            
            // Use the thread getter from parent LivechatService
            const thread = this.thread;
            
            if (!thread || thread.id !== threadId) {
                throw new Error("Thread not found or doesn't match current thread");
            }
                        
            if (thread.assistantId) {
                // Stop any existing stream first
                this.stopLLMStreaming(threadId);
                // Fire streaming_start event
                this.busService.trigger('streaming_start', { threadId });
                // Create SSE connection to the generate endpoint for LLM response streaming
                // We still need SSE for streaming the response tokens
                const eventSource = new EventSource(
                    `/im_livechat/llm/generate?thread_id=${threadId}`
                );
                
                // Set up message handlers to handle both token events and message updates
                eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        
                        if (data.type === "error") {
                            console.error("[triggerLLMResponseForMessage] Stream error:", data.error);

                            this.stopLLMStreaming(threadId);

                        } else if (data.type === "done") {
                            console.log("[triggerLLMResponseForMessage] Stream completed successfully");
                            
                            // Wait a brief moment to ensure any pending message updates are processed
                            setTimeout(() => {
                                // Stop streaming
                                this.stopLLMStreaming(threadId);
                            }, this.messageDelay);

                        } else if (data.type === "message_create" || data.type === "message_chunk") {
                            console.log("[triggerLLMResponseForMessage] Received:", data.type);

                            // We need to force a refresh since bus notifications may not trigger UI updates for message chunks
                            this._processMsg(threadId, data.message);

                        } else if (data.type === "message_update") {
                            console.log("[triggerLLMResponseForMessage] Received:", data.type);
                            console.log("[triggerLLMResponseForMessage] Message data:", data.message);

                            // Get the existing message
                            let stored_msg = this.store.Message.get(data.message.id);
                                                        
                            // Force direct body update and DOM refresh
                            console.log("[triggerLLMResponseForMessage] Current body:", stored_msg.body);
                            console.log("[triggerLLMResponseForMessage] New body:", data.message.body);
                            
                            
     
                            
                        }
                    } catch (error) {
                        console.error("[triggerLLMResponseForMessage] Stream parsing error:", error);
                    }
                };
                
                // Error handler
                eventSource.onerror = (ex) => {
                    console.error(ex)
                    // Stop streaming and clean up resources
                    this.stopLLMStreaming(threadId);
                };
                
                // Store the EventSource for later cleanup
                this.llmStreamSources.set(threadId, eventSource);
                
                // Update thread streaming status - using the store for reactivity
                if (thread.update) {
                    thread.update({ isStreaming: true });
                } else {
                    // Fallback if thread doesn't have update method
                    thread.isStreaming = true;
                }
            }
            else {
                // we should have an assistant at this point. throw an error if not

                throw new Error("No assistant available for this thread");
            }
            
            return {
                success: true,
                threadId,
            };
            
        } catch (error) {
            console.error("[triggerLLMResponseForMessage] Error triggering LLM response:", error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Enhanced cleanup for LLM resources (including streaming)
     * Updated to use store for reactivity
     * 
     
    * @param {number} channelId - The channel ID
     */
    cleanupLLMResources(channelId) {
        // Stop any active streams for this thread
        this.stopLLMStreaming(channelId);

        // Use the thread getter from parent LivechatService
        const thread = this.thread;
        
        // Reset thread streaming status
        if (thread && thread.id === channelId) {
            if (thread.update) {
                thread.update({ 
                    isStreaming: false,
                });
            } else {
                thread.isStreaming = false;
            }
        }
        
    },
    
    /**
     * Update a specific message in the thread or add it if it doesn't exist
     * 
     * @param {number} threadId - The thread ID
     * @param {Object} messageData - The message data to update
     * @private 
     */
    _processMsg(threadId, messageData) {
        // Get current thread and make sure it matches
        const thread = this.thread;
        if (!thread || thread.id !== threadId || !messageData) {
            return;
        }
        
        try {
            // Find the message in the thread's messages
            const messages = thread.messages || [];
            const messageIndex = messages.findIndex(msg => msg.id === messageData.id);
            
            if (messageIndex >= 0) {
                // Message exists - update it
                this._updateExistingMessage(messages[messageIndex], messageData);
            } else if (messageData.body) {
                // Message doesn't exist yet - add it
                this._addNewMessage(thread, threadId, messageData);
            }

            
        } catch (error) {
            console.error("[_processMsg] Error updating message:", error);
        }
    },
    
    /**
     * Update an existing message with new data
     * 
     * @private
     * @param {Object} message - The message to update
     * @param {Object} messageData - The new message data
     */
    _updateExistingMessage(message, messageData) {
        console.log("[_updateExistingMessage] Updating existing message:", message.id);
        console.log("[_updateExistingMessage] Current message body:", message.body);
        console.log("[_updateExistingMessage] New message body:", messageData.body);

        try {

            // Make sure body is properly marked up
            const updatedData = {
                ...messageData,
                body: messageData.body && typeof messageData.body === 'string' ? 
                    markup(messageData.body) : messageData.body,
            };

            message.update(updatedData);
            
            // Get the message from the store for direct update
            const storedMsg = this.store.Message.get(message.id);
            if (!storedMsg) {
                console.log("[_updateExistingMessage] Message not in store, inserting");
                const markedBody = messageData.body && typeof messageData.body === 'string' ? 
                    markup(messageData.body) : messageData.body;
                
                const msgToInsert = { ...messageData, body: markedBody };
                this.store.Message.insert(msgToInsert, { html: true });
                return;
            }
            
            
        } catch (error) {
            console.error("[_updateExistingMessage] Error updating message:", error);
        }
    },

    /**
     * Add a new message to the thread
     * 
     * @private
     * @param {Object} thread - The thread to add the message to
     * @param {number} threadId - The thread ID
     * @param {Object} messageData - The message data
     */
    _addNewMessage(thread, threadId, messageData) {
        console.log("[_addNewMessage] Adding new message:", messageData.id);
        console.log("[_addNewMessage] Current thread messages:", (thread.messages || []).map(msg => (msg.id, msg.body)));
        console.log("[_addNewMessage] New message data:", messageData);
        
        // Ensure body is marked up properly if needed
        const message = {
            ...messageData,
            body: messageData.body && typeof messageData.body === 'string' ? 
                    markup(messageData.body) : messageData.body,
        };
        
        // Use the standard Odoo method to add messages
        thread.messages.add(message);

        // Update store.Message
        this.store.Message.insert(message)
    },

    
    /**
     * Enhanced destroy method with streaming cleanup
     * Updated to use store for proper cleanup
     */
    destroy() {
        // Close all active streams
        if (this.llmStreamSources?.size) {
            for (const [threadId, eventSource] of this.llmStreamSources.entries()) {
                eventSource.close();
                
                // Get current thread
                const thread = this.thread;
                
                // Reset thread streaming status if it matches
                if (thread && thread.id === threadId) {
                    if (thread.update) {
                        thread.update({ isStreaming: false });
                    } else {
                        thread.isStreaming = false;
                    }
                }
                            }
            this.llmStreamSources.clear();
        }
        
        // Remove bus event listener
        if (this.busService) {
            this.busService.removeEventListener("notification", this._onNotification);
        }
        
        super.destroy?.();
    },
    
});