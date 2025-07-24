/* @odoo-module */

import { LivechatService } from "@im_livechat/embed/common/livechat_service";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";

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
        
        // Register for bus notifications to get real-time updates
        this.busService.addEventListener("notification", this._onNotification.bind(this));
    },
    
    /**
     * Handle bus notifications for real-time updates
     * @param {Object|Array} notification - A notification object or array of notification objects
     */
    _onNotification(notification) {
        // Handle both array format and single notification format
        const notifications = Array.isArray(notification) ? notification : [notification];
        
        for (const { type, payload } of notifications) {
            // Handle message-related notifications
            if (type === 'mail.message/insert' && 
                this.thread && 
                payload.thread_id === this.thread.id) {
                // The thread model will update automatically via the store
                
                // If this is an LLM message that's complete, update streaming state
                if (payload.llm_message_complete) {
                    this.stopLLMStreaming(payload.thread_id);
                }
            }
            
            // Handle thread updates
            if (type === 'mail.thread/insert' && 
                this.thread && 
                payload.id === this.thread.id) {
                // The thread will update automatically through the store
                // No need for manual refreshThread calls
            }
        }
    },


    /**
     * Stop streaming for a thread
     * Updated to use store for reactivity
     * 
     * @param {number} threadId - The thread ID
     */
    stopLLMStreaming(threadId) {
        const eventSource = this.llmStreamSources.get(threadId);
        if (eventSource) {
            eventSource.close();
            this.llmStreamSources.delete(threadId);
            
            // Get current thread
            const thread = this.thread;
            
            // Update thread streaming status
            if (thread && thread.id === threadId) {
                if (thread.update) {
                    thread.update({ isStreaming: false });
                } else {
                    thread.isStreaming = false;
                }
            }
            
            // Remove typing indicator
            this._setTypingStatus(threadId, false);
        }
    },
    
    /**
     * Set typing status for the LLM assistant using Odoo's bus notification
     * This directly triggers the same notification that the typing service listens for
     * 
     * @param {number} threadId - The thread ID
     * @param {boolean} isTyping - Whether the LLM is typing
     * @private
     */
    _setTypingStatus(threadId, isTyping) {
        try {
            // Use the thread getter from parent LivechatService
            const thread = this.thread;
            if (!thread || thread.id !== threadId) return;
            
            // Get the assistant partner ID
            const partnerId = thread.assistantPartnerId;
            if (!partnerId) {
                console.log("[LLM] No assistant partner ID in thread");
                return;
            }
            
            // Create the payload that matches what the typing service expects
            const payload = {
                id: partnerId,          // Member ID (partner ID)
                thread: { id: threadId }, // Thread reference
                isTyping: isTyping      // Typing status flag
            };
            
            // Trigger the bus notification that the typing service listens for
            this.busService.trigger("discuss.channel.member/typing_status", payload);
            console.log(`[LLM] Sent typing notification: partner ${partnerId} in thread ${threadId} is ${isTyping ? "typing" : "not typing"}`);
        } catch (error) {
            console.error("[LLM] Error setting typing status:", error);
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
            
            // Only handle LLM streaming if the thread has an assistant
            console.log("[LLM] Thread in triggerLLMResponseForMessage:", thread.id, thread);
            
            if (thread.assistantId) {
                // Stop any existing stream first
                this.stopLLMStreaming(threadId);
                
                // Show typing indicator before starting the stream
                this._setTypingStatus(threadId, true);
                
                // Create SSE connection to the generate endpoint for LLM response streaming
                // We still need SSE for streaming the response tokens
                const eventSource = new EventSource(
                    `/im_livechat/llm/generate?thread_id=${threadId}&message_id=${messageId}`
                );
                
                // Set up message handlers - simplified as the thread updates come through the bus
                eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        
                        if (data.type === "error") {
                            console.error("[LLM] Stream error:", data.error);
                            this.stopLLMStreaming(threadId);
                        } else if (data.type === "done") {
                            this.stopLLMStreaming(threadId);
                        }
                        // No need to refresh thread - bus notifications will handle updates
                    } catch (error) {
                        console.error("[LLM] Stream parsing error:", error);
                    }
                };
                
                // Error handler
                eventSource.onerror = (error) => {
                    console.error("[LLM] EventSource error:", error);
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
                console.error("[LLM] No assistantId found in thread:", {
                    threadId: thread.id,
                    threadData: thread,
                    assistantId: thread.assistantId
                });
                throw new Error("No assistant available for this thread");
            }
            
            return {
                success: true,
                threadId,
            };
            
        } catch (error) {
            console.error("[LLM] Error triggering LLM response:", error);
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
        
        // Remove typing indicator
        this._setTypingStatus(channelId, false);
    },
    
    // updateThread method removed - using LivechatService's thread getter instead

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
                
                // Remove typing indicator
                this._setTypingStatus(threadId, false);
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