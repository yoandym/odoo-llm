/* @odoo-module */

import { LivechatService, livechatService } from "@im_livechat/embed/common/livechat_service";
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

        this.orm = services.orm;

        // LLM thread management - only keep EventSource instances
        this.llmStreamSources = new Map(); // threadId -> EventSource

        // Subscribe to channel member changes for operator detection
        this.busService.addEventListener("notification", this._onBusNotification.bind(this));

        
    },

    /**
     * Stop streaming for a thread and clean up resources
     * 
     * @param {number} threadId - The thread ID
     */
    stopLLMStreaming(threadId) {
        const eventSource = this.llmStreamSources.get(threadId);
        if (eventSource) {
            eventSource.close();
            this.llmStreamSources.delete(threadId);
            
            // Fire streaming_stop event
            this.busService.trigger('streaming_stop', { threadId });
            
        } else {
            console.debug(`[stopLLMStreaming] No active stream found for thread ${threadId}`);
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
                        
            if (thread.assistant) {
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

                        // TODO: remove debug data
                        // print all message data for debugging purposes
                        console.debug("[triggerLLMResponseForMessage] Received data:", data);

                        
                        if (data.type === "error") {
                            console.error("[triggerLLMResponseForMessage] Stream error:", data.error);
                            this.cleanupLLMResources(threadId)

                        } else if (data.type === "done") {

                            this.cleanupLLMResources(threadId);

                        } else if (data.type === "message_create" || data.type === "message_chunk" || data.type === "message_update") {

                            this._processMsg(threadId, data.message);

                        }

                    } catch (error) {
                        console.error("[triggerLLMResponseForMessage] Stream parsing error:", error);
                    }
                };
                
                // Error handler
                eventSource.onerror = (ex) => {
                    console.error(ex)
                    // Wait a brief moment to ensure any pending message updates are processed
                    this.cleanupLLMResources(threadId);
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
                throw new Error("No assistant available for thread_id: " + threadId);
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
        // Wait a brief moment to ensure any pending message updates are processed
        setTimeout(() => {
            // Stop streaming
            this.stopLLMStreaming(channelId);
            this.env.services["mail.thread"].fetchMessages(this.thread);
        }, this.messageDelay);

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
            console.error("[_processMsg] Invalid thread or message data");
            return;
        }
        
        try {
            // Make sure body is properly marked up
            const safeData = {
                ...messageData,
                body: messageData.body && typeof messageData.body === 'string' ? 
                    markup(messageData.body) : messageData.body,
            };

            // Find the message in the thread's messages
            // weird things here
            // messages are at thread.messages and at store.Message
            // updating those ... works ... sometimes
            
            let messages = thread.messages || [];
            const threadMessageIdx = messages.findIndex(msg => msg.id === messageData.id);
            if (threadMessageIdx >= 0) {
                // Message exists - update it
                messages[threadMessageIdx].update(safeData)
            } else if (messageData.body) {
                // Message doesn't exist yet - add it
                messages.add(safeData);
            }

            let storeMessage = this.store.Message.get(safeData.id);
            if (storeMessage) {
                storeMessage.update(safeData);
            }
            else {
                // If the message doesn't exist in the store, add it
                this.store.Message.add(safeData);
            }

        } catch (error) {
            console.error("[_processMsg] Error updating message:", error);
        }
    },

    /**
     * Handle bus notifications for operator presence changes
     */
    _onBusNotification(notification) {
        const notifications = notification.detail;
        
        for (const notif of notifications) {
            const { type, payload } = notif;
            if (type === 'mail.record/insert' && payload.Thread) {
                const threadData = payload.Thread;
                
                // Check if this is a livechat channel with member changes
                if (threadData.model === 'discuss.channel' && 
                    threadData.channelMembers) {
                    
                    this._handleLivechatMemberChange(threadData);
                }
            }
        }
    },

    /**
     * Handle livechat channel member changes to detect operator presence
     */
    _handleLivechatMemberChange(threadData) {
       
        // Only process if this is our current thread
        if (!this.thread || this.thread.id !== threadData.id) {
            return;
        }

        // channelMembers[0] --> ['ADD', Array]
        // Array --> [{create_date, id, persona, thread}, ...]
        // persona --> {active, channelMembers, country, id, is_bot, is_public, name, type}
        if (threadData.channelMembers[0][0] === 'ADD') {
            const newMembers = threadData.channelMembers[0][1];
            for (const member of newMembers) {
                // if its a human operator (type != guest) mute de the llm for this thread
                if (!member.persona.is_bot && member.persona.type !== 'guest') {
                    this.muteAssistant(threadData.id, true);
                }
            }
        }
    },

    muteAssistant(thread_id, mute) {
        if (this.thread.id !== thread_id) {
            console.warn("[muteAssistant] Thread mismatch");
            return;
        }
        if (this.thread.llm_enabled) {

            this.rpc(`/llm/thread/mute_llm`, {
                uuid: this.thread.uuid, // Use uuid for thread identification to improve security
                mute: mute,
            })
            .then(result => {
                if (result.success) {
                    console.log("[muteAssistant] Result:", result);
                    // frontend mute - only update if backend was successful
                    this.thread.update({ llm_mute: mute });
                } else {
                    console.error("[muteAssistant] Error:", result.error);
                }
            })
            .catch(error => {
                console.error("[muteAssistant] RPC error:", error);
            });


        }
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
            this.busService.removeEventListener("notification", this._onBusNotification);
        }
        
        super.destroy?.();
    },
    
});


// Patch the service definition to include the orm dependency
patch(livechatService, {
    dependencies: [...livechatService.dependencies, "orm"],
});