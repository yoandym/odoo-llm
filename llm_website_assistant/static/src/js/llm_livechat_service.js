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
        
        // LLM thread management - only keep EventSource instances
        this.llmStreamSources = new Map(); // threadId -> EventSource
        
        // We'll rely on the Odoo native typing service for typing indicators
        this.typingService = services["discuss.typing"];
        
    },

    
    /**
     * Check for inconsistencies between Thread.isStreaming and llmStreamSources
     * and fix them if needed
     * 
     * @param {number} threadId - The thread ID to check
     */
    checkStreamingConsistency(threadId) {
        const eventSource = this.llmStreamSources.get(threadId);
        
        if (!this.thread) {
            // Thread not found, clean up any hanging EventSource
            if (eventSource) {
                this.stopLLMStreaming(threadId);
            }
            return;
        }
        
        // Case 1: Thread says streaming but no EventSource
        if (this.thread.isStreaming && !eventSource) {
            console.warn("[LLM] Inconsistent state: thread marked as streaming but no EventSource");
            this.thread.isStreaming = false;
            // We don't restart streaming here as it should be triggered by user action
        }
        
        // Case 2: EventSource exists but thread not marked as streaming
        if (!this.thread.isStreaming && eventSource) {
            console.warn("[LLM] Inconsistent state: EventSource exists but thread not marked as streaming");
            this.thread.isStreaming = true;
        }
    },

    /**
     * Start streaming responses for a thread
     * 
     * @param {number} threadId - The thread ID
     * @returns {Promise<Object>} Stream information
     */
    async startLLMStreaming(threadId) {
        try {
            // Find thread in store
            if (!this.thread) {
                throw new Error("Thread not found");
            }
            
            // Stop any existing stream
            this.stopLLMStreaming(threadId);

            // Create SSE connection - no need to post message first, we'll use the
            // standard message posting mechanism
            const eventSource = new EventSource(
                `/im_livechat/llm/stream?thread_id=${threadId}`
            );
            
            // Set up message handlers
            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    switch (data.type) {
                        case "message_create":
                        case "message_update":
                            // Refresh thread to update UI
                            this.refreshThread(threadId);
                            break;
                            
                        case "done":
                            // Final refresh and cleanup
                            this.refreshThread(threadId);
                            this.stopLLMStreaming(threadId);
                            break;
                            
                        case "error":
                            console.error("[LLM] Stream error:", data.error);
                            this.stopLLMStreaming(threadId);
                            break;
                    }
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
            
            // Update thread streaming status
            this.thread.isStreaming = true;
            
            return {
                success: true,
                eventSource,
                threadId
            };

        } catch (error) {
            console.error("[LLM] Error starting stream:", error);
            this.notificationService?.add?.(
                error.message || _t("Failed to send message"),
                { type: "danger" }
            );
            return { success: false, error: error.message };
        }
    },

    /**
     * Stop streaming for a thread
     * 
     * @param {number} threadId - The thread ID
     */
    stopLLMStreaming(threadId) {
        const eventSource = this.llmStreamSources.get(threadId);
        if (eventSource) {
            eventSource.close();
            this.llmStreamSources.delete(threadId);
            
            // Update thread streaming status
            if (this.thread) {
                this.thread.isStreaming = false;
            }
        }
    },

    /**
     * Send a message to the thread and trigger LLM response generation
     * @param {number} threadId - The thread ID
     * @param {string} messageContent - The message content to send
     * @return {Promise<Object>} Result with success status and message info
     */
    async sendMessage(threadId, messageContent) {
        try {
            // Send message to backend endpoint
            const result = await this.rpc("/web/dataset/call_kw", {
                model: "discuss.channel",
                method: "send_message",
                args: [threadId, messageContent],
                kwargs: {},
            });
            
            if (result && result.success) {
                // Start streaming for responses
                await this.startLLMStreaming(threadId);
                
                return result;
            } else {
                throw new Error("Failed to send message to thread");
            }
        } catch (error) {
            console.error("[LLM] Error sending message to thread:", error);
            this.notificationService?.add?.(
                error.message || _t("Failed to send message"),
                { type: "danger" }
            );
            throw error;
        }
    },

    /**
     * Enhanced cleanup for LLM resources (including streaming)
     * 
     * @param {number} channelId - The channel ID
     */
    cleanupLLMResources(channelId) {
        // Stop any active streams for this thread
        this.stopLLMStreaming(channelId);

        // Reset thread streaming status
        if (this.thread) {
            this.thread.isStreaming = false;
        }
    },
    
    /**
     * Refresh thread data from server to update UI
     * @param {number} threadId - Thread ID to refresh
     * @param {Array<string>} additionalFields - Optional additional fields to fetch
     * @returns {Promise<Object>} Updated thread data
     */
    async refreshThread(threadId, additionalFields = []) {
        try {
            // Use the standard channel_info method to get updated thread data
            const result = await this.rpc("/mail/channel/info", {
                channel_id: threadId,
                fields: [...(additionalFields || [])],
            });
            
            if (result && result.length > 0) {
                // Update the thread in the service
                const channelInfo = result[0];
                
                // If we have this channel as our main thread, update it
                if (this.thread && this.thread.id === threadId) {
                    Object.assign(this.thread, channelInfo);
                    
                    // If there are any handlers for thread updates, call them
                    if (this.onThreadUpdate) {
                        this.onThreadUpdate(this.thread);
                    }
                }
                
                return channelInfo;
            }
            
            return null;
        } catch (error) {
            console.error("[LLM] Error refreshing thread:", error);
            return null;
        }
    },

    /**
     * Enhanced destroy method with streaming cleanup
     */
    destroy() {
        // Close all active streams
        if (this.llmStreamSources?.size) {
            for (const [threadId, eventSource] of this.llmStreamSources.entries()) {
                eventSource.close();
                
                // Reset thread streaming status if possible
                if (this.thread) {
                    this.thread.isStreaming = false;
                }
            }
            this.llmStreamSources.clear();
        }
        
        super.destroy?.();
    },
    
});