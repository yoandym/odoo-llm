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
     * @param {CustomEvent} notification - A CustomEvent object containing notification details
     */
    _onNotification(notification) {
        // Extract notifications from the CustomEvent detail property
        const notifications = notification.detail || [];
        console.log("[LLM] Received notifications:", notifications);
        
        for (const notif of notifications) {
            const { type, payload } = notif;
            
            // Handle record insertions that might be messages
            if (type === 'mail.record/insert' && 
                this.thread &&
                payload.ChannelMember) {
                
                // Check if this is related to our thread
                const threadData = payload.ChannelMember?.thread;
                if (threadData && threadData.id === this.thread.id) {
                    console.log("[LLM] Processing mail.record/insert for thread:", this.thread.id);
                    
                    // If this is an LLM message that's complete, update streaming state
                    // Note: The actual message completion might come in a different notification type
                    if (payload.llm_message_complete) {
                        this.stopLLMStreaming(threadData.id);
                    }
                }
            }
            
            // Handle message-related notifications (original format)
            // Keeping this for backward compatibility
            if (type === 'mail.message/insert' && 
                this.thread && 
                payload.thread_id === this.thread.id) {

                console.log("[LLM] Processing mail.message/insert for thread:", this.thread.id);
                
                // If this is an LLM message that's complete, update streaming state
                if (payload.llm_message_complete) {
                    this.stopLLMStreaming(payload.thread_id);
                }
            }
            
            // Handle thread updates (original format)
            if (type === 'mail.thread/insert' && 
                this.thread && 
                payload.id === this.thread.id) {
                // The thread will update automatically through the store
                // No need for manual refreshThread calls
                console.log("[LLM] Processing mail.thread/insert for thread:", this.thread.id);
            }
            
            // Handle new message notifications - this is crucial for message chunks
            if (type === 'discuss.channel/new_message' && 
                this.thread && 
                payload.id === this.thread.id) {
                
                // Check if this message has content and belongs to our thread
                if (payload.message && payload.message.id) {
                    console.log("[LLM] Processing discuss.channel/new_message for message:", payload.message.id);
                    
                    // Check if this is a streaming message (from the LLM)
                    const isLLMMessage = this.llmStreamSources.has(this.thread.id);
                                        
                    // Force a refresh to ensure the UI updates
                    // This is particularly important for message chunks
                    this._forceThreadRefresh(payload.id, payload.message);
                }
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
            console.log(`[LLM] Stopping stream for thread ${threadId}`);
            eventSource.close();
            this.llmStreamSources.delete(threadId);
            // Fire streaming_stop event
            this.busService.trigger('streaming_stop', { threadId });
            // Get current thread
            const thread = this.thread;
            
            // Update thread streaming status
            if (thread && thread.id === threadId) {
                console.log(`[LLM] Updating thread ${threadId} streaming status to false`);
                if (thread.update) {
                    thread.update({ isStreaming: false });
                } else {
                    thread.isStreaming = false;
                }
                
                // Force a final refresh to ensure the UI shows the complete message
                // This is important in case we missed any updates
                if (thread.invalidateCache) {
                    console.log(`[LLM] Invalidating cache for thread ${threadId}`);
                    thread.invalidateCache();
                }
                
                // Try to find and update the most recent message
                const messages = thread.messages || [];
                if (messages.length > 0) {
                    // Find the most recent message (likely the streaming one)
                    const latestMessage = messages[messages.length - 1];
                    console.log(`[LLM] Found latest message in thread: ${latestMessage.id}`);
                    
                    // Force a refresh for this specific message to ensure it's displayed correctly
                    if (thread.env?.store && thread.model === 'discuss.channel') {
                        const store = thread.env.store;
                        if (store.Message && store.Message.insert) {
                            console.log(`[LLM] Refreshing message in store: ${latestMessage.id}`);
                            store.Message.insert(latestMessage);
                        }
                    }
                }
            }
            
        } else {
            console.log(`[LLM] No active stream found for thread ${threadId}`);
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
                        console.log("[LLM] Received stream data:", data);
                        
                        if (data.type === "error") {
                            console.error("[LLM] Stream error:", data.error);
                            this.stopLLMStreaming(threadId);
                        } else if (data.type === "done") {
                            console.log("[LLM] Stream completed successfully");
                            this.stopLLMStreaming(threadId);
                        } else if (data.type === "token") {
                            // Log token updates for debugging
                            console.log("[LLM] Token received:", data.token ? data.token.slice(0, 15) + "..." : "empty token");
                        } else if (data.type === "message_create" || data.type === "message_chunk") {
                            // Handle message creation and updates
                            console.log(`[LLM] ${data.type === "message_create" ? "Creating new" : "Updating"} message:`, data.message?.id);
                            
                            // Update the thread with the new message data
                            // We need to force a refresh since bus notifications may not trigger UI updates for message chunks
                            this._forceThreadRefresh(threadId, data.message);
                        }
                    } catch (error) {
                        console.error("[LLM] Stream parsing error:", error);
                    }
                };
                
                // Error handler
                eventSource.onerror = (error) => {
                    console.error("[LLM] EventSource error:", error);
                    console.error("[LLM] EventSource readyState:", eventSource.readyState);
                    
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
        
    },
    
    // updateThread method removed - using LivechatService's thread getter instead

    /**
     * Force refresh of thread to show message updates
     * This is necessary for message chunks that may not trigger UI updates through the bus
     * 
     * @param {number} threadId - The thread ID
     * @param {Object} messageData - The message data to update
     * @private 
     */
    _forceThreadRefresh(threadId, messageData) {
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
                const message = messages[messageIndex];
                if (message.update) {
                    // Use the thread store's update mechanism if available
                    message.update(messageData);
                } else {
                    // Direct property update as fallback
                    Object.assign(message, messageData);
                }
                
                // Trigger a UI refresh for the thread if needed
                if (thread.invalidateCache) {
                    thread.invalidateCache();
                }
                
                // If this is a store-based thread, trigger specific message updates
                if (thread.env?.store && thread.model === 'discuss.channel') {
                    const store = thread.env.store;
                    if (store.Message && store.Message.insert) {
                        // Use store's insert/update mechanism for the message
                        store.Message.insert(messageData);
                    }
                }
            } else if (messageData.body) {
                // Message doesn't exist yet - create it if we have content
                // This might happen if we get a chunk before the message is in the thread
                console.log("[LLM] Message not found in thread, attempting to add it");
                
                // If we have a store, try to insert the message directly
                if (thread.env?.store && thread.model === 'discuss.channel') {
                    const store = thread.env.store;
                    if (store.Message && store.Message.insert) {
                        console.log("[LLM] Inserting new message into store:", messageData.id);
                        // Add the message to the store - this should trigger UI updates
                        store.Message.insert(messageData);
                        
                        // Link the message to the thread if needed
                        if (store.Thread && store.Thread.updateMessages) {
                            store.Thread.updateMessages([{
                                id: threadId,
                                messages: [{ id: messageData.id }],
                            }]);
                        }
                        
                        // Force a refresh of the thread UI
                        if (thread.invalidateCache) {
                            thread.invalidateCache();
                        }
                    }
                } else if (Array.isArray(thread.messages)) {
                    // Fallback: Add directly to the thread's messages array
                    console.log("[LLM] Adding message directly to thread messages array");
                    thread.messages.push(messageData);
                    
                    // Force a thread refresh if possible
                    if (thread.invalidateCache) {
                        thread.invalidateCache();
                    } else if (thread.refresh) {
                        thread.refresh();
                    }
                }
            }
        } catch (error) {
            console.error("[LLM] Error forcing thread refresh:", error);
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
            this.busService.removeEventListener("notification", this._onNotification);
        }
        
        super.destroy?.();
    },
    
});