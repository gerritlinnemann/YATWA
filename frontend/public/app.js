// 🚀 YATWA - Main Application Logic
// Yet Another Trash Web App - Calendar Management

/* ============================================================================
   APPLICATION STATE
   ============================================================================ */

class YatwaApp {
    constructor() {
        this.state = {
            // User & Authentication
            user: null,
            isAuthenticated: false,
            userHash: null,

            // UI State
            currentView: 'auth', // 'auth' | 'calendar' | 'loading'
            theme: 'light',
            loading: false,

            // Data
            events: [],
            lastSync: null,

            // Error Handling
            error: null,
            connectionStatus: 'online'
        };

        this.eventListeners = new Map();
        this.components = new Map();
        this.services = {};

        // Bind methods
        this.setState = this.setState.bind(this);
        this.handleError = this.handleError.bind(this);
    }

    /* ============================================================================
       INITIALIZATION
       ============================================================================ */

    async init() {
        try {
            console.log('🚀 Initializing YATWA...');

            // Load services
            await this.loadServices();

            // Setup event listeners
            this.setupEventListeners();

            // Check for URL hash
            this.checkUrlHash();

            // Initialize theme
            this.initializeTheme();

            // Check connection status
            this.checkConnectionStatus();

            // Load user data if available
            await this.loadUserData();

            // Render initial view
            this.render();

            // Notify HTML that app is loaded
            if (window.appLoaded) {
                window.appLoaded();
            }

            console.log('✅ YATWA initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize YATWA:', error);
            this.handleError(error);
        }
    }

    /* ============================================================================
       SERVICE LOADING
       ============================================================================ */

    async loadServices() {
        try {
            // Load API service
            const apiModule = await import('./services/api.js');
            this.services.api = new apiModule.ApiService();

            // Load storage service
            const storageModule = await import('./services/storage.js');
            this.services.storage = new storageModule.StorageService();

            // Load theme service
            const themeModule = await import('./services/theme.js');
            this.services.theme = new themeModule.ThemeService();

            console.log('✅ Services loaded');

        } catch (error) {
            console.error('❌ Failed to load services:', error);
            throw new Error('Failed to load required services');
        }
    }

    /* ============================================================================
       EVENT LISTENERS
       ============================================================================ */

    setupEventListeners() {
        // Window events
        window.addEventListener('online', () => {
            this.setState({ connectionStatus: 'online' });
            this.showToast('Connection restored! 🌐', 'success');
        });

        window.addEventListener('offline', () => {
            this.setState({ connectionStatus: 'offline' });
            this.showToast('You are offline 📴', 'warning');
        });

        // Custom events
        window.addEventListener('yatwa-auth-success', this.handleAuthSuccess.bind(this));
        window.addEventListener('yatwa-auth-logout', this.handleLogout.bind(this));
        window.addEventListener('yatwa-error', this.handleError.bind(this));

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));

        // Escape key handling
        window.addEventListener('escape-pressed', this.handleEscape.bind(this));

        console.log('✅ Event listeners setup');
    }

    /* ============================================================================
       URL & HASH HANDLING
       ============================================================================ */

    checkUrlHash() {
        const urlParams = new URLSearchParams(window.location.search);
        const hash = urlParams.get('hash');

        if (hash && this.isValidHash(hash)) {
            console.log('📎 Hash found in URL:', hash.substring(0, 8) + '...');
            this.verifyHash(hash);
        }
    }

    isValidHash(hash) {
        // Basic hash validation
        return typeof hash === 'string' && hash.length >= 16 && /^[a-f0-9]+$/i.test(hash);
    }

    async verifyHash(hash) {
        try {
            this.setState({ loading: true });

            const response = await this.services.api.verifyHash(hash);

            if (response.success) {
                this.setState({
                    user: response.user,
                    userHash: hash,
                    isAuthenticated: true,
                    currentView: 'calendar',
                    loading: false
                });

                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);

                // Load user events
                await this.loadEvents();

                this.showToast('Welcome back! 👋', 'success');

            } else {
                throw new Error(response.error || 'Invalid hash');
            }

        } catch (error) {
            console.error('Hash verification failed:', error);
            this.setState({ loading: false });
            this.showToast('Invalid calendar link 😞', 'error');
        }
    }

    /* ============================================================================
       THEME MANAGEMENT
       ============================================================================ */

    initializeTheme() {
        const savedTheme = this.services.storage.get('theme');
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const theme = savedTheme || systemTheme;

        this.setState({ theme });
        this.services.theme.setTheme(theme);

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!this.services.storage.get('theme')) {
                const newTheme = e.matches ? 'dark' : 'light';
                this.setState({ theme: newTheme });
                this.services.theme.setTheme(newTheme);
            }
        });
    }

    handleThemeChange(event) {
        const { theme } = event.detail;
        this.setState({ theme });
        this.services.theme.setTheme(theme);
        this.services.storage.set('theme', theme);
    }

    toggleTheme() {
        const newTheme = this.state.theme === 'light' ? 'dark' : 'light';
        this.services.theme.setTheme(newTheme); // Service macht alles
        this.setState({ theme: newTheme }); // State sync
    }

    /* ============================================================================
       AUTHENTICATION HANDLING
       ============================================================================ */

    async handleAuthSuccess(event) {
        const { user, hash } = event.detail;

        this.setState({
            user,
            userHash: hash,
            isAuthenticated: true,
            currentView: 'calendar'
        });

        // Save user data
        this.services.storage.set('userHash', hash);
        this.services.storage.set('user', user);

        // Load events
        await this.loadEvents();

        this.showToast('Calendar ready! 🎉', 'success');
    }

    handleLogout() {
        this.setState({
            user: null,
            userHash: null,
            isAuthenticated: false,
            currentView: 'auth',
            events: []
        });

        // Clear stored data
        this.services.storage.remove('userHash');
        this.services.storage.remove('user');

        this.showToast('See you soon! 👋', 'info');
    }

    async loadUserData() {
        const storedHash = this.services.storage.get('userHash');
        const storedUser = this.services.storage.get('user');

        if (storedHash && storedUser) {
            console.log('📦 Loading stored user data');

            // Verify stored hash is still valid
            try {
                const response = await this.services.api.verifyHash(storedHash);
                if (response.success) {
                    this.setState({
                        user: response.user,
                        userHash: storedHash,
                        isAuthenticated: true,
                        currentView: 'calendar'
                    });

                    await this.loadEvents();
                } else {
                    // Clear invalid stored data
                    this.services.storage.remove('userHash');
                    this.services.storage.remove('user');
                }
            } catch (error) {
                console.warn('Stored hash verification failed:', error);
                this.services.storage.remove('userHash');
                this.services.storage.remove('user');
            }
        }
    }

    /* ============================================================================
       DATA MANAGEMENT
       ============================================================================ */

    async loadEvents() {
        if (!this.state.userHash) return;

        try {
            const events = await this.services.api.getEvents(this.state.userHash);
            this.setState({
                events,
                lastSync: new Date()
            });

            console.log(`📅 Loaded ${events.length} events`);

        } catch (error) {
            console.error('Failed to load events:', error);
            this.handleError(error);
        }
    }

    async createEvent(eventData) {
        if (!this.state.userHash) return;

        try {
            const newEvent = await this.services.api.createEvent(this.state.userHash, eventData);

            this.setState({
                events: [...this.state.events, newEvent]
            });

            this.showToast('Event created! 📅', 'success');
            return newEvent;

        } catch (error) {
            console.error('Failed to create event:', error);
            this.handleError(error);
            throw error;
        }
    }

    async updateEvent(eventId, eventData) {
        if (!this.state.userHash) return;

        try {
            const updatedEvent = await this.services.api.updateEvent(this.state.userHash, eventId, eventData);

            this.setState({
                events: this.state.events.map(event =>
                    event.id === eventId ? updatedEvent : event
                )
            });

            this.showToast('Event updated! ✏️', 'success');
            return updatedEvent;

        } catch (error) {
            console.error('Failed to update event:', error);
            this.handleError(error);
            throw error;
        }
    }

    async deleteEvent(eventId) {
        if (!this.state.userHash) return;

        try {
            await this.services.api.deleteEvent(this.state.userHash, eventId);

            this.setState({
                events: this.state.events.filter(event => event.id !== eventId)
            });

            this.showToast('Event deleted! 🗑️', 'info');

        } catch (error) {
            console.error('Failed to delete event:', error);
            this.handleError(error);
            throw error;
        }
    }

    /* ============================================================================
       UI MANAGEMENT
       ============================================================================ */

    setState(newState) {
        const prevState = { ...this.state };
        this.state = { ...this.state, ...newState };

        // Trigger re-render if needed
        this.render();

        // Dispatch state change event
        window.dispatchEvent(new CustomEvent('yatwa-state-change', {
            detail: { prevState, newState: this.state }
        }));
    }

    render() {
        const appContent = document.getElementById('app-content');
        if (!appContent) return;

        appContent.innerHTML = this.getViewContent();
        this.attachEventListeners();
        this.loadViewComponents();
    }

    getViewContent() {
        switch (this.state.currentView) {
            case 'auth':
                return this.getAuthView();
            case 'calendar':
                return this.getCalendarView();
            case 'loading':
                return this.getLoadingView();
            default:
                return '<div class="p-8 text-center">Unknown view</div>';
        }
    }

    getAuthView() {
        return `
      <div class="min-h-screen flex items-center justify-center p-4">
        <div id="auth-component"></div>
      </div>
    `;
    }

    getCalendarView() {
        return `
      <div class="min-h-screen flex flex-col">
        <!-- Header -->
        <header class="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg sticky top-0 z-10">
          <div class="max-w-6xl mx-auto px-4 py-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="text-2xl">🗓️</span>
                <h1 class="text-xl font-bold">YATWA</h1>
              </div>
              
              <div class="flex items-center gap-4">
                <span class="text-sm opacity-90">
                  📅 ${this.state.userHash?.substring(0, 8)}...
                </span>
                
                <button onclick="app.toggleTheme()" class="btn-ghost text-white hover:bg-white/20" title="Toggle theme">
                  ${this.state.theme === 'light' ? '🌙' : '☀️'}
                </button>
                
                <button onclick="app.handleLogout()" class="btn-ghost text-white hover:bg-white/20">
                  👋 Logout
                </button>
              </div>
            </div>
          </div>
        </header>
        
        <!-- Main Content -->
        <main class="flex-1 max-w-6xl mx-auto w-full p-4">
          <div id="calendar-component"></div>
        </main>
        
        <!-- Connection Status -->
        ${this.state.connectionStatus === 'offline' ? `
          <div class="fixed bottom-4 left-4 bg-warning text-white px-4 py-2 rounded-lg shadow-lg">
            📴 Offline Mode
          </div>
        ` : ''}
      </div>
    `;
    }

    getLoadingView() {
        return `
      <div class="min-h-screen flex items-center justify-center">
        <div class="text-center">
          <div class="spinner mx-auto mb-4"></div>
          <p class="text-secondary">Loading...</p>
        </div>
      </div>
    `;
    }

    async loadViewComponents() {
        try {
            switch (this.state.currentView) {
                case 'auth':
                    await this.loadAuthComponent();
                    break;
                case 'calendar':
                    await this.loadCalendarComponent();
                    break;
            }
        } catch (error) {
            console.error('Failed to load view components:', error);
            this.handleError(error);
        }
    }

    async loadAuthComponent() {
        try {
            const authModule = await import('./components/auth-component.js');
            const authContainer = document.getElementById('auth-component');
            if (authContainer) {
                authContainer.innerHTML = '<auth-component></auth-component>';
            }
        } catch (error) {
            console.error('Failed to load auth component:', error);
            // Fallback to simple form
            this.renderFallbackAuth();
        }
    }

    async loadCalendarComponent() {
        try {
            const calendarModule = await import('./components/calendar-component.js');
            const calendarContainer = document.getElementById('calendar-component');
            if (calendarContainer) {
                calendarContainer.innerHTML = '<calendar-component></calendar-component>';
            }
        } catch (error) {
            console.error('Failed to load calendar component:', error);
            // Fallback to simple view
            this.renderFallbackCalendar();
        }
    }

    renderFallbackAuth() {
        const authContainer = document.getElementById('auth-component');
        if (authContainer) {
            authContainer.innerHTML = `
        <div class="card max-w-md w-full">
          <div class="card-body text-center">
            <div class="text-4xl mb-4">🗓️</div>
            <h2 class="text-2xl font-bold mb-2">YATWA</h2>
            <p class="text-secondary mb-6">Yet Another Trash Web App</p>
            <button onclick="app.startRegistration()" class="btn btn-primary w-full">
              🚀 Get Started
            </button>
          </div>
        </div>
      `;
        }
    }

    renderFallbackCalendar() {
        const calendarContainer = document.getElementById('calendar-component');
        if (calendarContainer) {
            calendarContainer.innerHTML = `
        <div class="card">
          <div class="card-body text-center">
            <h2 class="text-xl font-bold mb-4">📅 Your Calendar</h2>
            <p class="text-secondary mb-4">
              You have ${this.state.events.length} events
            </p>
            <div class="flex gap-4 justify-center">
              <button onclick="app.showAddEventForm()" class="btn btn-primary">
                ➕ Add Event
              </button>
              <button onclick="app.showICalExport()" class="btn btn-secondary">
                📊 Export
              </button>
            </div>
          </div>
        </div>
      `;
        }
    }

    /* ============================================================================
       EVENT HANDLING
       ============================================================================ */

    attachEventListeners() {
        // This method would attach event listeners to dynamically created elements
        // For now, we use onclick attributes for simplicity
    }

    handleKeyboardShortcuts(event) {
        if (!this.state.isAuthenticated) return;

        if (event.metaKey || event.ctrlKey) {
            switch (event.key) {
                case 't':
                    event.preventDefault();
                    this.toggleTheme();
                    break;
                case 'n':
                    event.preventDefault();
                    this.showAddEventForm();
                    break;
                case 'e':
                    event.preventDefault();
                    this.showICalExport();
                    break;
            }
        }
    }

    handleEscape() {
        // Close any open modals or dropdowns
        window.dispatchEvent(new CustomEvent('close-modals'));
    }

    checkConnectionStatus() {
        this.setState({
            connectionStatus: navigator.onLine ? 'online' : 'offline'
        });
    }

    /* ============================================================================
       ERROR HANDLING
       ============================================================================ */

    handleError(error) {
        console.error('YATWA Error:', error);

        this.setState({ error: error.message || 'An unknown error occurred' });

        let message = 'Something went wrong';
        let type = 'error';

        if (error.message?.includes('network') || error.message?.includes('fetch')) {
            message = 'Connection error. Please check your internet.';
        } else if (error.message?.includes('auth')) {
            message = 'Authentication failed. Please try again.';
        }

        this.showToast(message, type);
    }

    /* ============================================================================
       UTILITY METHODS
       ============================================================================ */

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
      <div class="flex-1">
        <div class="font-medium">${message}</div>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">
        ×
      </button>
    `;

        container.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    // Fallback methods for when components don't load
    async startRegistration() {
        try {
            const email = prompt('Enter your email (optional):');
            const response = await this.services.api.register(email);

            if (response.success) {
                window.dispatchEvent(new CustomEvent('yatwa-auth-success', {
                    detail: { user: response.user, hash: response.hash }
                }));
            }
        } catch (error) {
            this.handleError(error);
        }
    }

    showAddEventForm() {
        alert('Add Event feature - Component will be loaded soon!');
    }

    showICalExport() {
        if (this.state.userHash) {
            const url = `/api/ical/${this.state.userHash}`;
            window.open(url, '_blank');
        }
    }
}

/* ============================================================================
   APPLICATION BOOTSTRAP
   ============================================================================ */

// Create global app instance
window.app = new YatwaApp();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.app.init());
} else {
    window.app.init();
}

// Export for modules
export default window.app;