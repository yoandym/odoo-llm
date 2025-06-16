/** @odoo-module **/

import { Component, onWillStart, onMounted, onWillUnmount, useRef, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";

export class PhoenixDashboard extends Component {
    static template = "llm_observability.PhoenixDashboard";

    setup() {
        this.rpc = useService("rpc");
        this.notification = useService("notification");
        this.dashboardRef = useRef("dashboard");
        this.isMounted = false;

        this.state = useState({
            loading: true,
            error: null,
            phoenixAvailable: false,
            phoenixUrl: null,
            connectionStatus: 'disconnected',
            tracesData: null,
            environment: 'development',
            fullstackTracingEnabled: false,
            refreshInterval: null,
        });

        onWillStart(async () => {
            await this.loadDashboardData();
        });

        onMounted(() => {
            this.isMounted = true;
            this.setupAutoRefresh();
        });

        onWillUnmount(() => {
            this.isMounted = false;
            if (this.state.refreshInterval) {
                clearInterval(this.state.refreshInterval);
                this.state.refreshInterval = null;
            }
        });
    }

    async loadDashboardData() {
        // Check if component is still mounted before making RPC calls
        if (!this.isMounted && this.isMounted !== undefined) {
            return;
        }

        try {
            this.state.loading = true;
            this.state.error = null;

            const data = await this.rpc("/llm_observability/dashboard_data", {
                date_range: 7
            });

            // Check again after async operation
            if (!this.isMounted && this.isMounted !== undefined) {
                return;
            }

            if (data.error) {
                this.state.error = data.error;
                this.state.phoenixAvailable = false;
                return;
            }

            this.state.phoenixAvailable = data.phoenix_available;
            this.state.phoenixUrl = data.phoenix_url;
            this.state.connectionStatus = data.connection_status;
            this.state.tracesData = data.traces_summary;
            this.state.environment = data.environment;
            this.state.fullstackTracingEnabled = data.fullstack_tracing_enabled;

            // Load Phoenix iframe if available
            if (this.state.phoenixAvailable && this.state.connectionStatus === 'connected') {
                this.loadPhoenixIframe();
            }

        } catch (error) {
            // Only show error if component is still mounted
            if (this.isMounted || this.isMounted === undefined) {
                console.error("Error loading dashboard data:", error);
                this.state.error = error.message || "Failed to load dashboard data";
                this.notification.add(_t("Failed to load dashboard data"), {
                    type: "danger",
                });
            }
        } finally {
            if (this.isMounted || this.isMounted === undefined) {
                this.state.loading = false;
            }
        }
    }

    loadPhoenixIframe() {
        if (!this.dashboardRef.el) return;

        const iframeContainer = this.dashboardRef.el.querySelector('.phoenix_iframe_container');
        if (!iframeContainer) return;

        // Clear existing iframe
        iframeContainer.innerHTML = '';

        // Create new iframe
        const iframe = document.createElement('iframe');
        iframe.src = this.state.phoenixUrl;
        iframe.className = 'phoenix_iframe';
        iframe.frameBorder = '0';
        iframe.sandbox = 'allow-same-origin allow-scripts allow-forms allow-popups';
        iframe.loading = 'lazy';

        // Handle iframe load events
        iframe.onload = () => {
            console.log("Phoenix iframe loaded successfully");
        };

        iframe.onerror = () => {
            console.error("Failed to load Phoenix iframe");
            this.notification.add(_t("Failed to load Phoenix dashboard"), {
                type: "warning",
            });
        };

        iframeContainer.appendChild(iframe);
    }

    setupAutoRefresh() {
        // Clear any existing interval
        if (this.state.refreshInterval) {
            clearInterval(this.state.refreshInterval);
        }

        // Refresh data every 30 seconds, but only if component is still mounted
        this.state.refreshInterval = setInterval(() => {
            if (this.isMounted) {
                this.loadDashboardData();
            }
        }, 30000);
    }

    async testConnection() {
        try {
            const result = await this.rpc("/llm_observability/test_connection");

            if (result.success) {
                this.notification.add(_t("Connection successful!"), {
                    type: "success",
                });
                this.state.connectionStatus = 'connected';
            } else {
                this.notification.add(_t("Connection failed: %s", result.error), {
                    type: "danger",
                });
                this.state.connectionStatus = 'error';
            }

        } catch (error) {
            console.error("Error testing connection:", error);
            this.notification.add(_t("Connection test failed"), {
                type: "danger",
            });
        }
    }

    async refreshData() {
        await this.loadDashboardData();
        this.notification.add(_t("Data refreshed"), {
            type: "info",
        });
    }

    openPhoenixDashboard() {
        if (this.state.phoenixUrl) {
            window.open(this.state.phoenixUrl, '_blank');
        }
    }

    openConfiguration() {
        window.open('/web#action=llm_observability.action_phoenix_config', '_blank');
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    formatDuration(ms) {
        if (ms < 1000) {
            return `${Math.round(ms)}ms`;
        } else if (ms < 60000) {
            return `${(ms / 1000).toFixed(1)}s`;
        } else {
            return `${(ms / 60000).toFixed(1)}m`;
        }
    }

    formatCost(usd) {
        if (usd < 0.01) {
            return `$${(usd * 1000).toFixed(2)}‰`; // per mille
        }
        return `$${usd.toFixed(4)}`;
    }

    getStatusColor(status) {
        switch (status) {
            case 'connected':
                return 'success';
            case 'error':
                return 'danger';
            default:
                return 'warning';
        }
    }
}

// Register the component
registry.category("actions").add("phoenix_dashboard", PhoenixDashboard);
