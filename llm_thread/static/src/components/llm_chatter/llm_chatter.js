/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { Chatter } from "@mail/core/web/chatter";
import { useState, Component, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { LLMChatThread } from "@llm_thread/components/llm_chat_thread/llm_chat_thread";
import { LLMChatThreadHeader } from "@llm_thread/components/llm_chat_thread_header/llm_chat_thread_header";

/**
 * Patch the Chatter component to add LLM chat integration
 * 
 * This allows users to switch between normal chatter and AI chat
 * directly from the form view chatter.
 */
patch(Chatter.prototype, {
    /**
     * @override
     */
    setup() {
        super.setup();

        // Services
        this.llmChatService = useService("llm_chat");
        this.notificationService = useService("notification");
        this.actionService = useService("action");
        this.userService = useService("user");

        // Extend state with LLM chat properties
        Object.assign(this.state, {
            isChattingWithLLM: false,
            llmThread: null,
            isInitializingLLM: false,
        });

        // Add AI button after component is mounted
        onMounted(() => {
            console.log("[LLM] Chatter mounted, adding AI button...");
            this.addAIButton();
            // Try multiple times with delays to ensure DOM is ready
            setTimeout(() => this.addAIButton(), 100);
            setTimeout(() => this.addAIButton(), 500);
            setTimeout(() => this.addAIButton(), 1000);
        });
    },



    /**
     * Add AI button to the chatter
     */
    addAIButton() {
        console.log("[LLM] Adding AI button...");

        // Find chatter element in the DOM
        const chatterEl = document.querySelector('.o-mail-Chatter');
        if (!chatterEl) {
            console.log("[LLM] Chatter element not found, will retry...");
            return;
        }

        // Check if button already exists
        if (chatterEl.querySelector('.o-mail-Chatter-aiButton')) {
            console.log("[LLM] AI button already exists");
            return;
        }

        // Look for topbar
        let topbar = chatterEl.querySelector('.o-mail-Chatter-topbar');
        console.log("[LLM] Topbar found:", topbar);

        // If no topbar, create one at the beginning
        if (!topbar) {
            console.log("[LLM] Creating topbar...");
            topbar = document.createElement('div');
            topbar.className = 'o-mail-Chatter-topbar d-flex align-items-center gap-2 p-2 border-bottom';

            // Insert as first child
            chatterEl.insertBefore(topbar, chatterEl.firstChild);
            console.log("[LLM] Topbar created");
        }

        // Create AI button
        const aiButton = document.createElement('button');
        aiButton.className = 'btn btn-light o-mail-Chatter-aiButton';
        aiButton.innerHTML = `
            <i class="fa fa-robot"></i>
            <span class="d-none d-md-inline ms-1">AI Chat</span>
        `;
        aiButton.title = 'Toggle AI Chat';

        // Add click handler with arrow function to preserve 'this' context
        aiButton.addEventListener('click', () => {
            console.log("[LLM] AI button clicked");
            this.toggleLLMChat();
        });

        // Look for existing buttons in topbar to match style
        const existingButton = topbar.querySelector('.btn');
        if (existingButton) {
            console.log("[LLM] Found existing button, copying classes:", existingButton.className);
            // Copy relevant classes
            const classes = existingButton.className.split(' ').filter(cls =>
                cls.startsWith('btn') && cls !== 'btn-primary'
            );
            aiButton.className = [...classes, 'o-mail-Chatter-aiButton'].join(' ');
        }

        // Add to topbar
        topbar.appendChild(aiButton);
        console.log("[LLM] AI button added successfully!");
    },

    /**
     * Toggle between normal chatter and LLM chat mode
     */
    async toggleLLMChat() {
        console.log("[LLM] Toggle LLM chat called");

        // Try multiple ways to get thread information from Chatter
        const thread = this.thread || this.props.thread || this.state?.thread;
        console.log("[LLM] Thread found:", thread);
        console.log("[LLM] Props:", this.props);
        console.log("[LLM] State:", this.state);

        // If no thread from component, try to get it from props.threadModel and props.threadId
        let threadModel = thread?.model || this.props?.threadModel;
        let threadId = thread?.id || this.props?.threadId;

        // Try to get from action context if still not found
        if (!threadModel || !threadId) {
            const action = this.actionService.currentController?.action;
            console.log("[LLM] Current action:", action);

            if (action?.res_model && action?.res_id) {
                threadModel = action.res_model;
                threadId = action.res_id;
                console.log("[LLM] Got from action - Model:", threadModel, "ID:", threadId);
            }
        }

        // Try to get from URL or environment
        if (!threadModel || !threadId) {
            // Try to get from browser URL
            const urlParams = new URLSearchParams(window.location.search);
            const urlModel = urlParams.get('model');
            const urlId = urlParams.get('id');

            if (urlModel && urlId) {
                threadModel = urlModel;
                threadId = parseInt(urlId);
                console.log("[LLM] Got from URL - Model:", threadModel, "ID:", threadId);
            }
        }

        console.log("[LLM] Final thread model:", threadModel, "Thread ID:", threadId);

        if (!threadModel || !threadId) {
            console.warn("[LLM] No valid thread information available");
            this.notificationService.add(
                _t("Unable to start AI chat - no record context found"),
                {
                    title: _t("Error"),
                    type: "warning",
                }
            );
            return;
        }

        // Create thread object for compatibility
        const threadInfo = {
            model: threadModel,
            id: threadId,
            ...thread
        };

        if (this.state.isChattingWithLLM) {
            this.exitLLMMode();
        } else {
            await this.enterLLMMode(threadInfo);
        }
    },

    /**
     * Enter LLM chat mode
     */
    async enterLLMMode(thread) {
        console.log("[LLM] Entering LLM mode with thread:", thread);

        if (this.state.isInitializingLLM) return;

        this.state.isInitializingLLM = true;
        this.updateAIButton(true, true);

        try {
            const llmChat = this.llmChatService.llmChat;

            // Ensure thread for the current record
            const llmThread = await llmChat.ensureThread({
                relatedThreadModel: thread.model,
                relatedThreadId: thread.id,
            });

            if (!llmThread) {
                throw new Error("Failed to create AI chat thread");
            }

            console.log("[LLM] LLM thread created/found:", llmThread);

            // Select the thread
            await llmChat.selectThread(llmThread.id);

            // Update state
            this.state.llmThread = llmThread;
            this.state.isChattingWithLLM = true;

            // Update UI
            this.updateAIButton(true, false);
            await this.showLLMContent(thread);

            console.log("[LLM] Successfully entered LLM mode");

        } catch (error) {
            console.error("[LLM] Failed to initialize LLM chat:", error);
            this.notificationService.add(
                _t("Failed to start AI chat: ") + error.message,
                {
                    title: _t("Error"),
                    type: "danger",
                }
            );
            this.state.isChattingWithLLM = false;
            this.state.llmThread = null;
            this.updateAIButton(false, false);
        } finally {
            this.state.isInitializingLLM = false;
        }
    },

    /**
     * Exit LLM chat mode
     */
    exitLLMMode() {
        console.log("[LLM] Exiting LLM mode...");

        // Cleanup mounted header component
        if (this.mountedHeaderComponent) {
            try {
                this.mountedHeaderComponent.destroy();
                console.log("[LLM] Header component destroyed");
            } catch (error) {
                console.warn("[LLM] Error destroying header component:", error);
            }
            this.mountedHeaderComponent = null;
        }

        this.state.isChattingWithLLM = false;
        this.state.llmThread = null;
        this.updateAIButton(false, false);
        this.hideLLMContent();
    },

    /**
     * Update AI button state
     */
    updateAIButton(isActive, isLoading) {
        const aiButton = document.querySelector('.o-mail-Chatter-aiButton');
        if (!aiButton) {
            console.log("[LLM] AI button not found for update");
            return;
        }

        if (isActive) {
            aiButton.classList.remove('btn-light');
            aiButton.classList.add('btn-primary');
        } else {
            aiButton.classList.remove('btn-primary');
            aiButton.classList.add('btn-light');
        }

        if (isLoading) {
            aiButton.innerHTML = `<i class="fa fa-spinner fa-spin"></i><span class="d-none d-md-inline ms-1">Loading...</span>`;
            aiButton.disabled = true;
        } else {
            aiButton.innerHTML = `<i class="fa fa-robot"></i><span class="d-none d-md-inline ms-1">${isActive ? 'Exit AI' : 'AI Chat'}</span>`;
            aiButton.disabled = false;
        }
    },

    /**
     * Show LLM content
     */
    async showLLMContent(thread) {
        console.log("[LLM] Showing LLM content...");

        const chatterEl = document.querySelector('.o-mail-Chatter');
        if (!chatterEl) {
            console.log("[LLM] Chatter element not found");
            return;
        }

        // Hide normal chatter content
        const normalContent = chatterEl.querySelector('.o-mail-Chatter-content');
        if (normalContent) {
            normalContent.style.display = 'none';
            console.log("[LLM] Normal content hidden");
        }

        // Check if LLM content already exists
        let llmContent = chatterEl.querySelector('.o-mail-Chatter-llmContent');
        if (!llmContent) {
            // Create LLM content container
            llmContent = document.createElement('div');
            llmContent.className = 'o-mail-Chatter-content o-mail-Chatter-llmContent';
            llmContent.style.cssText = 'height: 600px; display: flex; flex-direction: column; min-height: 0;';

            // Insert after topbar
            const topbar = chatterEl.querySelector('.o-mail-Chatter-topbar');
            if (topbar && topbar.nextSibling) {
                topbar.parentNode.insertBefore(llmContent, topbar.nextSibling);
            } else {
                chatterEl.appendChild(llmContent);
            }
            console.log("[LLM] LLM content container created");
        } else {
            llmContent.style.display = 'flex';
            llmContent.innerHTML = ''; // Clear existing content
        }

        // Load the chat interface
        await this.loadChatInterface(llmContent, thread);
    },

    /**
     * Load the actual chat interface
     */
    async loadChatInterface(container, thread) {
        try {
            console.log("[LLM] Loading actual chat interface...");

            // Get thread model info - use thread parameter or try to get current thread
            const threadInfo = thread || this.thread;
            const modelName = threadInfo?.model || 'record';

            // Create a working chat interface with header above messages
            container.innerHTML = `
                <div class="h-100 d-flex flex-column llm-chat-interface">
                    <!-- Header for Provider/Model/Tools Selection -->
                    <div class="llm-header-placeholder" id="llm-header-${this.state.llmThread.id}">
                        <div class="p-3 border-bottom bg-light">
                            <div class="d-flex justify-content-between align-items-center">
                                <h6 class="mb-0">
                                    <i class="fa fa-robot me-2"></i>
                                    AI Assistant
                                    <span class="badge bg-primary ms-2">${this.state.llmThread.name || 'Thread ' + this.state.llmThread.id}</span>
                                </h6>
                                <button class="btn btn-sm btn-outline-secondary" onclick="document.querySelector('.o-mail-Chatter-aiButton').click()">
                                    <i class="fa fa-times"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Messages Area -->
                    <div class="flex-grow-1 overflow-auto p-3" style="max-height: 400px;">
                        <div class="llm-messages" id="llm-messages-${this.state.llmThread.id}">
                            <div class="alert alert-info">
                                <i class="fa fa-info-circle me-2"></i>
                                Welcome! This is your AI assistant for this record. You can ask questions, get help, or request actions related to this ${modelName} record.
                            </div>
                            <div class="text-muted text-center">
                                <small>Loading previous messages...</small>
                            </div>
                        </div>
                    </div>

                    <!-- Composer -->
                    <div class="p-3 border-top">
                        <div class="input-group">
                            <input type="text" 
                                   class="form-control llm-input" 
                                   placeholder="Type your message here..." 
                                   id="llm-input-${this.state.llmThread.id}"
                                   onkeypress="if(event.key === 'Enter') { this.nextElementSibling.click(); }">
                            <button class="btn btn-primary llm-send-btn" 
                                    type="button" 
                                    onclick="window.llmChatter.sendMessage(${this.state.llmThread.id})">
                                <i class="fa fa-paper-plane"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Store reference for message sending
            window.llmChatter = window.llmChatter || {};
            window.llmChatter.sendMessage = (threadId) => {
                this.sendLLMMessage(threadId);
            };

            // Mount the LLMChatThreadHeader component
            await this.mountHeaderComponent();

            // Load existing messages
            await this.loadMessages();

            console.log("[LLM] Chat interface loaded successfully");

        } catch (error) {
            console.error("[LLM] Failed to load chat interface:", error);
            container.innerHTML = `
                <div class="text-center p-5">
                    <i class="fa fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                    <h4>Failed to load chat interface</h4>
                    <p class="text-muted">Error: ${error.message}</p>
                    <button class="btn btn-secondary mt-3" onclick="document.querySelector('.o-mail-Chatter-aiButton').click()">
                        <i class="fa fa-arrow-left me-2"></i>Back to Chatter
                    </button>
                </div>
            `;
        }
    },

    /**
     * Mount the LLMChatThreadHeader component
     */
    async mountHeaderComponent() {
        try {
            console.log("[LLM] Mounting LLMChatThreadHeader component...");

            const headerPlaceholder = document.getElementById(`llm-header-${this.state.llmThread.id}`);
            if (!headerPlaceholder) {
                console.warn("[LLM] Header placeholder not found");
                return;
            }

            // Ensure we have thread data properly structured
            const threadData = {
                id: this.state.llmThread.id,
                name: this.state.llmThread.name || 'New Chat',
                llmModel: this.state.llmThread.llmModel || null,
                selectedToolIds: this.state.llmThread.selectedToolIds || [],
                ...this.state.llmThread
            };

            // Create component using modern OWL approach
            const headerComponent = new LLMChatThreadHeader();

            // Set up the component with proper environment and props
            headerComponent.env = this.env;
            headerComponent.props = {
                thread: threadData,
                onOpenSidebar: () => {
                    console.log('Sidebar requested (not implemented in chatter)');
                }
            };

            // Setup the component
            headerComponent.setup();

            // Mount to the DOM element
            await headerComponent.mount(headerPlaceholder);

            // Store reference for cleanup
            this.mountedHeaderComponent = headerComponent;

            console.log("[LLM] LLMChatThreadHeader component mounted successfully");

        } catch (error) {
            console.error("[LLM] Failed to mount LLMChatThreadHeader component:", error);
            console.log("[LLM] Falling back to enhanced simple header with dropdowns");

            // Enhanced fallback header with provider/model selection
            const headerPlaceholder = document.getElementById(`llm-header-${this.state.llmThread.id}`);
            if (headerPlaceholder) {
                await this.createEnhancedHeader(headerPlaceholder);
            }
        }
    },

    /**
     * Create enhanced header with provider/model dropdowns as fallback
     */
    async createEnhancedHeader(container) {
        try {
            console.log("[LLM] Creating enhanced header fallback...");

            // Get providers and models from LLM chat service
            const llmChat = this.llmChatService.llmChat;
            const providers = llmChat.llmProviders || [];
            const models = llmChat.llmModels || [];

            // Get current selections
            const currentProviderId = this.state.llmThread.llmModel?.llmProvider?.id;
            const currentModelId = this.state.llmThread.llmModel?.id;

            // Build provider options
            let providerOptions = '<option value="">Select Provider...</option>';
            providers.forEach(provider => {
                const selected = provider.id === currentProviderId ? 'selected' : '';
                providerOptions += `<option value="${provider.id}" ${selected}>${provider.name || provider.displayName}</option>`;
            });

            // Build model options for current provider
            let modelOptions = '<option value="">Select Model...</option>';
            if (currentProviderId) {
                const providerModels = models.filter(m => m.llmProvider?.id == currentProviderId);
                providerModels.forEach(model => {
                    const selected = model.id === currentModelId ? 'selected' : '';
                    modelOptions += `<option value="${model.id}" ${selected}>${model.name || model.displayName}</option>`;
                });
            }

            container.innerHTML = `
                <div class="p-3 border-bottom bg-light">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h6 class="mb-0">
                            <i class="fa fa-robot me-2"></i>
                            AI Assistant
                            <span class="badge bg-primary ms-2">${this.state.llmThread.name || 'Thread ' + this.state.llmThread.id}</span>
                        </h6>
                        <button class="btn btn-sm btn-outline-secondary" onclick="document.querySelector('.o-mail-Chatter-aiButton').click()">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    
                    <!-- Provider and Model Selection -->
                    <div class="row g-2">
                        <div class="col-md-6">
                            <label class="form-label small">Provider</label>
                            <select class="form-select form-select-sm" id="llm-provider-select-${this.state.llmThread.id}">
                                ${providerOptions}
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small">Model</label>
                            <select class="form-select form-select-sm" id="llm-model-select-${this.state.llmThread.id}">
                                ${modelOptions}
                            </select>
                        </div>
                    </div>
                </div>
            `;

            // Add event listeners for provider/model changes
            const providerSelect = document.getElementById(`llm-provider-select-${this.state.llmThread.id}`);
            const modelSelect = document.getElementById(`llm-model-select-${this.state.llmThread.id}`);

            if (providerSelect) {
                providerSelect.addEventListener('change', async () => {
                    await this.handleProviderChange(providerSelect.value, modelSelect);
                });
            }

            if (modelSelect) {
                modelSelect.addEventListener('change', async () => {
                    await this.handleModelChange(modelSelect.value);
                });
            }

            console.log("[LLM] Enhanced header created successfully");

        } catch (error) {
            console.error("[LLM] Failed to create enhanced header:", error);

            // Ultimate fallback - simple header
            container.innerHTML = `
                <div class="p-3 border-bottom bg-light">
                    <div class="d-flex justify-content-between align-items-center">
                        <h6 class="mb-0">
                            <i class="fa fa-robot me-2"></i>
                            AI Assistant - ${this.state.llmThread.name || 'Thread ' + this.state.llmThread.id}
                        </h6>
                        <button class="btn btn-sm btn-outline-secondary" onclick="document.querySelector('.o-mail-Chatter-aiButton').click()">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        }
    },

    /**
     * Handle provider selection change
     */
    async handleProviderChange(providerId, modelSelect) {
        try {
            console.log("[LLM] Provider changed to:", providerId);

            // Clear model selection
            modelSelect.innerHTML = '<option value="">Select Model...</option>';

            if (providerId) {
                const llmChat = this.llmChatService.llmChat;
                const models = llmChat.llmModels?.filter(m => m.llmProvider?.id == providerId) || [];

                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.name || model.displayName;
                    modelSelect.appendChild(option);
                });

                console.log(`[LLM] Loaded ${models.length} models for provider ${providerId}`);
            }

        } catch (error) {
            console.error("[LLM] Error handling provider change:", error);
        }
    },

    /**
     * Handle model selection change
     */
    async handleModelChange(modelId) {
        try {
            console.log("[LLM] Model changed to:", modelId);

            if (modelId) {
                const llmChat = this.llmChatService.llmChat;
                await llmChat.updateThread(this.state.llmThread.id, {
                    llmModelId: parseInt(modelId)
                });

                // Update local thread data
                const selectedModel = llmChat.llmModels?.find(m => m.id == modelId);
                if (selectedModel) {
                    this.state.llmThread.llmModel = selectedModel;
                }

                console.log("[LLM] Thread model updated successfully");

                this.notificationService.add(
                    _t("AI model updated successfully"),
                    {
                        type: "success",
                    }
                );
            }

        } catch (error) {
            console.error("[LLM] Error handling model change:", error);
            this.notificationService.add(
                _t("Failed to update AI model: ") + error.message,
                {
                    title: _t("Error"),
                    type: "danger",
                }
            );
        }
    },

    /**
     * Load providers and models for the header dropdowns
     */
    async loadProvidersAndModels() {
        try {
            const llmChat = this.llmChatService.llmChat;

            // Get providers
            const providers = llmChat.llmProviders || [];
            const providerSelect = document.getElementById(`llm-provider-select-${this.state.llmThread.id}`);

            if (providerSelect && providers.length > 0) {
                providers.forEach(provider => {
                    const option = document.createElement('option');
                    option.value = provider.id;
                    option.textContent = provider.name || provider.displayName;
                    if (provider.id === this.state.llmThread.llmModel?.llmProvider?.id) {
                        option.selected = true;
                    }
                    providerSelect.appendChild(option);
                });

                // Add change handler
                providerSelect.addEventListener('change', () => this.onProviderChange());
            }

            // Load models for current provider
            await this.loadModelsForProvider();

        } catch (error) {
            console.error("[LLM] Failed to load providers and models:", error);
        }
    },

    /**
     * Handle provider change
     */
    async onProviderChange() {
        await this.loadModelsForProvider();
    },

    /**
     * Load models for the selected provider
     */
    async loadModelsForProvider() {
        try {
            const providerSelect = document.getElementById(`llm-provider-select-${this.state.llmThread.id}`);
            const modelSelect = document.getElementById(`llm-model-select-${this.state.llmThread.id}`);

            if (!providerSelect || !modelSelect) return;

            const providerId = providerSelect.value;
            modelSelect.innerHTML = '<option value="">Select Model...</option>';

            if (providerId) {
                const llmChat = this.llmChatService.llmChat;
                const models = llmChat.llmModels?.filter(m => m.llmProvider?.id == providerId) || [];

                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.name || model.displayName;
                    if (model.id === this.state.llmThread.llmModel?.id) {
                        option.selected = true;
                    }
                    modelSelect.appendChild(option);
                });

                // Add change handler
                modelSelect.addEventListener('change', () => this.onModelChange());
            }

        } catch (error) {
            console.error("[LLM] Failed to load models:", error);
        }
    },

    /**
     * Handle model change
     */
    async onModelChange() {
        try {
            const modelSelect = document.getElementById(`llm-model-select-${this.state.llmThread.id}`);
            if (!modelSelect) return;

            const modelId = modelSelect.value;
            if (modelId) {
                // Update the thread's model
                const llmChat = this.llmChatService.llmChat;
                await llmChat.updateThread(this.state.llmThread.id, {
                    llmModelId: parseInt(modelId)
                });
                console.log("[LLM] Thread model updated to:", modelId);
            }

        } catch (error) {
            console.error("[LLM] Failed to update model:", error);
        }
    },

    /**
     * Load messages for the current thread
     */
    async loadMessages() {
        try {
            const messagesContainer = document.getElementById(`llm-messages-${this.state.llmThread.id}`);
            if (!messagesContainer) return;

            console.log("[LLM] Loading messages for thread:", this.state.llmThread.id);

            const llmChat = this.llmChatService.llmChat;
            const messages = await llmChat.getMessages(this.state.llmThread.id);

            console.log("[LLM] Loaded messages:", messages);

            messagesContainer.innerHTML = '';

            if (messages && messages.length > 0) {
                messages.forEach(message => {
                    const messageEl = document.createElement('div');

                    // Enhanced sender detection using multiple approaches
                    let isUser = false;

                    // Method 1: Use isFromUser field set by the service (most reliable)
                    if (typeof message.isFromUser === 'boolean') {
                        isUser = message.isFromUser;
                    }
                    // Method 2: Check author ID against current user
                    else if (message.author && message.author.id && this.userService.userId) {
                        isUser = message.author.id === this.userService.userId;
                    }
                    // Method 3: Check role field
                    else if (message.role) {
                        isUser = message.role === 'user';
                    }
                    // Method 4: Check subtype for LLM messages
                    else if (message.subtype_xmlid) {
                        isUser = message.subtype_xmlid.includes('llm_user');
                    }
                    // Method 5: Fallback - check message type and author existence
                    else {
                        isUser = message.messageType === 'comment' && message.author && message.author.id;
                    }

                    console.log("[LLM] Message sender detection:", {
                        messageId: message.id,
                        isFromUser: message.isFromUser,
                        author: message.author,
                        role: message.role,
                        messageType: message.messageType,
                        subtype_xmlid: message.subtype_xmlid,
                        currentUserId: this.userService.userId,
                        finalIsUser: isUser,
                        detectionMethod: typeof message.isFromUser === 'boolean' ? 'isFromUser field' :
                            (message.author && message.author.id && this.userService.userId) ? 'author ID comparison' :
                                message.role ? 'role field' :
                                    message.subtype_xmlid ? 'subtype check' : 'fallback'
                    });

                    messageEl.className = `mb-3 d-flex ${isUser ? 'justify-content-end' : 'justify-content-start'}`;

                    const content = this.formatMessageContent(message.content || message.body);

                    // Format date properly with better fallback handling
                    let dateStr = 'Just now';
                    const dateField = message.create_date || message.createdAt || message.date || message.write_date || message.timestamp;

                    if (dateField) {
                        try {
                            // Handle different date formats
                            let dateValue = dateField;

                            // If it's a string that looks like Odoo datetime format, parse it
                            if (typeof dateField === 'string') {
                                // Replace space with 'T' for ISO format if needed
                                dateValue = dateField.includes('T') ? dateField : dateField.replace(' ', 'T');
                                // Add 'Z' if no timezone info
                                if (!dateValue.includes('+') && !dateValue.includes('Z')) {
                                    dateValue += 'Z';
                                }
                            }

                            const date = new Date(dateValue);
                            if (!isNaN(date.getTime())) {
                                // Check if date is today
                                const now = new Date();
                                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

                                if (messageDate.getTime() === today.getTime()) {
                                    // Today - show just time
                                    dateStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                } else {
                                    // Not today - show date and time
                                    dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
                                        date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                }
                            }
                        } catch (e) {
                            console.log("[LLM] Date parsing error for:", dateField, e);
                            dateStr = 'Recent';
                        }
                    }

                    // Create sender indicator with enhanced author detection
                    let senderInfo;
                    if (isUser) {
                        // For user messages, try to get the actual author name
                        let authorName = 'You';
                        if (message.author && message.author.name) {
                            authorName = message.author.name;
                        } else if (this.userService.name) {
                            authorName = this.userService.name;
                        }
                        senderInfo = `<i class="fa fa-user me-1"></i>${authorName}`;
                    } else {
                        // For AI messages, check if we have specific AI info
                        let aiName = 'AI Assistant';
                        if (message.author && message.author.name && message.author.name !== 'AI Assistant') {
                            // Sometimes the AI has a specific name from the provider
                            aiName = message.author.name;
                        }
                        senderInfo = `<i class="fa fa-robot me-1"></i>${aiName}`;
                    }

                    messageEl.innerHTML = `
                        <div class="message-wrapper" style="max-width: 70%;">
                            <div class="d-flex align-items-center mb-1 ${isUser ? 'justify-content-end' : 'justify-content-start'}">
                                <small class="text-muted">
                                    ${senderInfo} • ${dateStr}
                                </small>
                            </div>
                            <div class="p-3 rounded ${isUser ? 'bg-primary text-white' : 'bg-light border'}">
                                <div style="white-space: pre-wrap;">${content}</div>
                            </div>
                        </div>
                    `;
                    messagesContainer.appendChild(messageEl);
                });

                // Scroll to bottom
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else {
                messagesContainer.innerHTML = `
                    <div class="alert alert-info">
                        <i class="fa fa-info-circle me-2"></i>
                        Welcome! This is your AI assistant. Ask me anything about this record or request help with your tasks.
                    </div>
                `;
            }
        } catch (error) {
            console.error("[LLM] Failed to load messages:", error);
            const messagesContainer = document.getElementById(`llm-messages-${this.state.llmThread.id}`);
            if (messagesContainer) {
                messagesContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fa fa-exclamation-triangle me-2"></i>
                        Failed to load messages: ${error.message}
                    </div>
                `;
            }
        }
    },

    /**
     * Format message content by decoding HTML entities and handling empty content
     */
    formatMessageContent(content) {
        if (!content) {
            return '<em class="text-muted">Empty message</em>';
        }

        // If content is already plain text, return it directly
        if (typeof content === 'string' && !content.includes('&') && !content.includes('<')) {
            return content;
        }

        // Create a temporary div to decode HTML entities
        const div = document.createElement('div');
        div.innerHTML = content;
        const decodedContent = div.textContent || div.innerText || '';

        return decodedContent || '<em class="text-muted">Unable to display content</em>';
    },

    /**
     * Send a message in LLM chat
     */
    async sendLLMMessage(threadId) {
        console.log("[LLM] Sending message to thread:", threadId);

        const input = document.getElementById(`llm-input-${threadId}`);
        const sendBtn = document.querySelector('.llm-send-btn');

        if (!input || !input.value.trim()) return;

        const message = input.value.trim();
        input.value = '';
        sendBtn.disabled = true;

        try {
            // Get initial message count to detect when AI responds
            const initialMessages = await this.llmChatService.llmChat.getMessages(threadId);
            const initialCount = initialMessages ? initialMessages.length : 0;

            console.log("[LLM] Initial message count:", initialCount);

            const llmChat = this.llmChatService.llmChat;
            await llmChat.sendMessage(threadId, message);

            // Show user message immediately
            this.loadMessages();

            // Start polling for AI response
            this.pollForAIResponse(threadId, initialCount);

        } catch (error) {
            console.error("[LLM] Failed to send message:", error);
            this.notificationService.add(
                _t("Failed to send message: ") + error.message,
                {
                    title: _t("Error"),
                    type: "danger",
                }
            );
            sendBtn.disabled = false;
            input.focus();
        }
    },

    /**
     * Poll for AI response with exponential backoff
     */
    async pollForAIResponse(threadId, initialCount, attempt = 1, maxAttempts = 15) {
        const sendBtn = document.querySelector('.llm-send-btn');
        const input = document.getElementById(`llm-input-${threadId}`);

        try {
            console.log(`[LLM] Polling attempt ${attempt}/${maxAttempts} for AI response...`);

            const messages = await this.llmChatService.llmChat.getMessages(threadId);
            const currentCount = messages ? messages.length : 0;

            console.log(`[LLM] Current message count: ${currentCount}, initial: ${initialCount}`);

            // Check if we have new messages (should be at least +2: user message + AI response)
            if (currentCount > initialCount + 1) {
                console.log("[LLM] AI response detected, reloading messages...");
                await this.loadMessages();

                // Re-enable input
                if (sendBtn) sendBtn.disabled = false;
                if (input) input.focus();
                return;
            }

            // Also check if we have at least one AI message that's newer
            if (messages && messages.length > initialCount) {
                const latestMessages = messages.slice(initialCount);
                const hasAIResponse = latestMessages.some(msg =>
                    msg.role === 'assistant' ||
                    msg.role === 'ai' ||
                    !msg.isFromUser ||
                    msg.role !== 'user'
                );

                if (hasAIResponse) {
                    console.log("[LLM] AI response found in latest messages, reloading...");
                    await this.loadMessages();

                    // Re-enable input
                    if (sendBtn) sendBtn.disabled = false;
                    if (input) input.focus();
                    return;
                }
            }

            // Continue polling if we haven't reached max attempts
            if (attempt < maxAttempts) {
                // Progressive backoff: 1s, 2s, 3s, 5s, 5s, then 8s intervals
                let delay;
                if (attempt <= 3) {
                    delay = attempt * 1000; // 1s, 2s, 3s
                } else if (attempt <= 6) {
                    delay = 5000; // 5s for attempts 4-6
                } else {
                    delay = 8000; // 8s for later attempts
                }

                console.log(`[LLM] No AI response yet, waiting ${delay}ms before next attempt...`);

                setTimeout(() => {
                    this.pollForAIResponse(threadId, initialCount, attempt + 1, maxAttempts);
                }, delay);
            } else {
                console.log("[LLM] Max polling attempts reached, doing final reload...");
                await this.loadMessages(); // Final reload

                // Re-enable input
                if (sendBtn) sendBtn.disabled = false;
                if (input) input.focus();

                // Show a message that AI might still be processing
                this.notificationService.add(
                    _t("AI is taking longer than usual to respond. The response may appear shortly."),
                    {
                        title: _t("Info"),
                        type: "info",
                    }
                );
            }

        } catch (error) {
            console.error(`[LLM] Error during polling attempt ${attempt}:`, error);

            // Re-enable input on error
            if (sendBtn) sendBtn.disabled = false;
            if (input) input.focus();

            // Continue polling unless it's the last attempt
            if (attempt < maxAttempts) {
                setTimeout(() => {
                    this.pollForAIResponse(threadId, initialCount, attempt + 1, maxAttempts);
                }, 3000); // Wait 3 seconds on error
            } else {
                this.notificationService.add(
                    _t("Failed to check for AI response. Please try again."),
                    {
                        title: _t("Error"),
                        type: "warning",
                    }
                );
            }
        }
    },

    /**
     * Hide LLM content and show normal chatter
     */
    hideLLMContent() {
        console.log("[LLM] Hiding LLM content...");

        const llmContent = document.querySelector('.o-mail-Chatter-llmContent');
        if (llmContent) {
            llmContent.style.display = 'none';
        }

        const normalContent = document.querySelector('.o-mail-Chatter-content:not(.o-mail-Chatter-llmContent)');
        if (normalContent) {
            normalContent.style.display = '';
        }
    },

    /**
     * Override click handlers to exit LLM mode when using normal chatter features
     */
    onClickSendMessage(ev) {
        if (this.state.isChattingWithLLM) {
            this.toggleLLMChat();
        }
        this._super(ev);
    },

    onClickLogNote(ev) {
        if (this.state.isChattingWithLLM) {
            this.toggleLLMChat();
        }
        this._super(ev);
    },

    onClickScheduleActivity(ev) {
        if (this.state.isChattingWithLLM) {
            this.toggleLLMChat();
        }
        this._super(ev);
    },

    onClickAttachFiles(ev) {
        if (this.state.isChattingWithLLM) {
            this.toggleLLMChat();
        }
        this._super(ev);
    },
});

// Add LLMChatThread to Chatter's components
patch(Chatter, {
    components: {
        ...Chatter.components,
        LLMChatThread,
    },
});

/**
 * Alternative: Standalone Chatter Button Component
 * 
 * This can be used to add an AI chat button to any view
 */
export class ChatterLLMButton extends Component {
    static template = "llm_thread.ChatterLLMButton";
    static props = {
        record: { type: Object },
        className: { type: String, optional: true },
    };

    setup() {
        this.llmChatService = useService("llm_chat");
        this.actionService = useService("action");

        this.state = useState({
            isOpening: false,
        });
    }

    /**
     * Open LLM chat for the current record
     */
    async openLLMChat() {
        if (this.state.isOpening) return;

        this.state.isOpening = true;

        try {
            const llmChat = this.llmChatService.llmChat;

            // Ensure thread exists
            const thread = await llmChat.ensureThread({
                relatedThreadModel: this.props.record.resModel,
                relatedThreadId: this.props.record.resId,
            });

            if (thread) {
                // Open the chat in a dialog or as an action
                await llmChat.openThread(thread);
            }
        } catch (error) {
            console.error("Failed to open LLM chat:", error);
        } finally {
            this.state.isOpening = false;
        }
    }
}