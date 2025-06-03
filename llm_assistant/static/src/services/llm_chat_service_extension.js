/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { LLMChatService } from "@llm_thread/services/llm_chat_service";

console.log("LLM Assistant: Loading chat service extension");

// Store the original service start method
const originalStart = LLMChatService.start;

/**
 * Patch the LLM Chat Service to integrate assistant functionality
 */
LLMChatService.dependencies = [...(LLMChatService.dependencies || []), "llm_assistant"];
LLMChatService.start = function(env, dependencies) {
    console.log("LLM Assistant: Starting patched LLM Chat Service...");
    
    // Call the original service start method
    const llmChat = originalStart.call(this, env, dependencies);
    
    console.log("LLM Assistant: Original llmChat object:", llmChat);
    console.log("LLM Assistant: Has initializeLLMChat?", typeof llmChat.initializeLLMChat);
    console.log("LLM Assistant: llmChat methods:", Object.keys(llmChat).filter(k => typeof llmChat[k] === 'function'));
    
    const { llm_assistant: llmAssistantService } = dependencies;
    
    // Store original initializeLLMChat if it exists
    if (llmChat.initializeLLMChat) {
        const originalInitializeLLMChat = llmChat.initializeLLMChat.bind(llmChat);
        llmChat.initializeLLMChat = async function(actionData, initActiveId, postInitializationPromises = []) {
            console.log("LLM Assistant: Extended initializeLLMChat called");
            
            // Add assistant loading to initialization promises
            const extendedPromises = [
                ...postInitializationPromises,
                llmAssistantService.loadAssistants()
            ];
            
            return originalInitializeLLMChat(actionData, initActiveId, extendedPromises);
        };
    }
    
    // Extend the original loadThreads method
    if (llmChat.loadThreads) {
        const originalLoadThreads = llmChat.loadThreads.bind(llmChat);
        llmChat.loadThreads = async function(additionalFields = []) {
            console.log("LLM Assistant: Extended loadThreads called");
            
            // Add assistant_id to fields to fetch
            const fields = [...additionalFields, "assistant_id"];
            await originalLoadThreads(fields);
            
            // Load assistants if not already loaded
            if (!llmAssistantService.isLoaded) {
                await llmAssistantService.loadAssistants();
            }
            
            // Map assistant data to threads
            if (llmChat.threads) {
                llmChat.threads.forEach(thread => {
                    if (thread.assistant_id) {
                        thread.assistantId = thread.assistant_id[0];
                        thread.assistantName = thread.assistant_id[1];
                        thread.assistant = llmAssistantService.getAssistant(thread.assistantId);
                    }
                });
            }
            
            return llmChat.threads;
        };
    }
    
    // Extend the original refreshThread method
    if (llmChat.refreshThread) {
        const originalRefreshThread = llmChat.refreshThread.bind(llmChat);
        llmChat.refreshThread = async function(threadId, additionalFields = []) {
            // Add assistant_id to fields to fetch
            const fields = [...additionalFields, "assistant_id"];
            await originalRefreshThread(threadId, fields);
            
            // Find and update the thread in the threads array
            const threadObj = llmChat.threads.find(t => t.id === threadId);
            if (threadObj && threadObj.assistant_id) {
                threadObj.assistantId = threadObj.assistant_id[0];
                threadObj.assistantName = threadObj.assistant_id[1];
                threadObj.assistant = llmAssistantService.getAssistant(threadObj.assistantId);
                
                // Fetch thread-specific assistant values if needed
                if (threadObj.assistant && threadObj.assistant.promptId) {
                    const values = await llmAssistantService.getAssistantValuesForThread(
                        threadId,
                        threadObj.assistantId
                    );
                    if (values) {
                        Object.assign(threadObj.assistant, values);
                    }
                }
            }
            
            return threadObj;
        };
    }
    
    // Override _mapThreadDataFromServer to add assistant information
    if (llmChat._mapThreadDataFromServer) {
        const original_mapThreadDataFromServer = llmChat._mapThreadDataFromServer.bind(llmChat);
        llmChat._mapThreadDataFromServer = function(threadData) {
            const mappedData = original_mapThreadDataFromServer(threadData);
            
            // Add assistant information if present
            if (threadData.assistant_id) {
                mappedData.assistantId = threadData.assistant_id[0];
                mappedData.assistantName = threadData.assistant_id[1];
                mappedData.assistant = llmAssistantService.getAssistant(mappedData.assistantId);
            }
            
            return mappedData;
        };
    }
    
    // Add method to get assistants
    llmChat.getAssistants = function() {
        return llmAssistantService.assistants;
    };
    
    // Add method to update thread assistant
    llmChat.updateThreadAssistant = async function(threadId, assistantId) {
        const result = await llmAssistantService.setThreadAssistant(threadId, assistantId);
        
        if (result.success) {
            // Refresh the thread to get updated data
            await this.refreshThread(threadId);
        }
        
        return result;
    };
    
    console.log("LLM Assistant: Chat service patch complete");
    console.log("LLM Assistant: Returning patched llmChat with initializeLLMChat?", typeof llmChat.initializeLLMChat);
    
    // Return the extended llmChat object
    return llmChat;
};

console.log("LLM Assistant: Chat service extension loaded");
