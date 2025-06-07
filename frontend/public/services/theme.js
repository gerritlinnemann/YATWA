// 🎨 YATWA Theme Service - Advanced Theme Management
// Handles light/dark themes, custom themes, and system preferences

export class ThemeService {
    constructor() {
        this.currentTheme = 'light';
        this.availableThemes = ['light', 'dark', 'auto'];
        this.customThemes = new Map();
        this.themeTransition = 300; // ms

        // Event listeners
        this.listeners = new Set();
        this.mediaQuery = null;

        this.init();
    }

    /* ============================================================================
       INITIALIZATION
       ============================================================================ */

    init() {
        try {
            // Setup system theme detection
            this.setupSystemThemeDetection();

            // Load custom themes
            this.loadCustomThemes();

            // Initialize theme transition
            this.setupThemeTransition();

            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();

            console.log('🎨 Theme service initialized');

        } catch (error) {
            console.error('🎨 Theme service initialization failed:', error);
        }
    }

    /**
     * Setup system theme preference detection
     */
    setupSystemThemeDetection() {
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        // Listen for system theme changes
        this.mediaQuery.addEventListener('change', (e) => {
            if (this.currentTheme === 'auto') {
                this.applySystemTheme();
            }

            this.notifyListeners('system-theme-change', {
                systemPrefersDark: e.matches
            });
        });
    }

    /**
     * Setup smooth theme transitions
     */
    setupThemeTransition() {
        // Add transition styles to document
        const style = document.createElement('style');
        style.textContent = `
      * {
        transition: 
          background-color ${this.themeTransition}ms ease,
          color ${this.themeTransition}ms ease,
          border-color ${this.themeTransition}ms ease,
          box-shadow ${this.themeTransition}ms ease !important;
      }
      
      /* Disable transitions during theme change */
      .theme-transition-disabled * {
        transition: none !important;
      }
      
      /* Special handling for images and media */
      img, video, canvas, svg {
        transition: opacity ${this.themeTransition}ms ease !important;
      }
    `;
        document.head.appendChild(style);
    }

    /**
     * Setup keyboard shortcuts for theme switching
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Shift + T for theme toggle
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                this.toggleTheme();
            }

            // Ctrl/Cmd + Shift + A for auto theme
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                this.setTheme('auto');
            }
        });
    }

    /* ============================================================================
       CORE THEME METHODS
       ============================================================================ */

    /**
     * Set theme with smooth transition
     */
    setTheme(theme, options = {}) {
        if (!this.isValidTheme(theme)) {
            console.warn(`🎨 Invalid theme: ${theme}`);
            return false;
        }

        const prevTheme = this.currentTheme;

        if (prevTheme === theme) {
            return true;
        }

        this.currentTheme = theme;
        this.applyThemeWithTransition(theme, options);

        // Notify listeners
        this.notifyListeners('theme-change', {
            theme,
            prevTheme,
            timestamp: Date.now()
        });

        // Dispatch global event
        window.dispatchEvent(new CustomEvent('yatwa-theme-change', {
            detail: { theme, prevTheme }
        }));

        console.log(`🎨 Theme changed: ${prevTheme} → ${theme}`);
        return true;
    }

    /**
     * Get current theme
     */
    getTheme() {
        return this.currentTheme;
    }

    /**
     * Get effective theme (resolves 'auto' to actual theme)
     */
    getEffectiveTheme() {
        if (this.currentTheme === 'auto') {
            return this.getSystemTheme();
        }
        return this.currentTheme;
    }

    /**
     * Toggle between light and dark theme
     */
    toggleTheme() {
        const effectiveTheme = this.getEffectiveTheme();
        const newTheme = effectiveTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    /**
     * Cycle through all available themes
     */
    cycleTheme() {
        const currentIndex = this.availableThemes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % this.availableThemes.length;
        const nextTheme = this.availableThemes[nextIndex];
        this.setTheme(nextTheme);
    }

    /* ============================================================================
       THEME APPLICATION
       ============================================================================ */

    /**
     * Apply theme with smooth transition
     */
    applyThemeWithTransition(theme, options = {}) {
        const { skipTransition = false, duration = this.themeTransition } = options;

        if (skipTransition) {
            this.applyTheme(theme);
            return;
        }

        // Temporarily disable transitions for instant change if needed
        if (duration === 0) {
            document.documentElement.classList.add('theme-transition-disabled');
            this.applyTheme(theme);
            requestAnimationFrame(() => {
                document.documentElement.classList.remove('theme-transition-disabled');
            });
            return;
        }

        // Apply theme with transition
        this.applyTheme(theme);
    }

    /**
     * Apply theme to document
     */
    applyTheme(theme) {
        const effectiveTheme = theme === 'auto' ? this.getSystemTheme() : theme;

        // Set data attribute for CSS
        document.documentElement.setAttribute('data-theme', effectiveTheme);

        // Update meta theme-color for mobile browsers
        this.updateMetaThemeColor(effectiveTheme);

        // Apply custom theme if available
        if (this.customThemes.has(theme)) {
            this.applyCustomTheme(this.customThemes.get(theme));
        }

        // Store theme preference
        this.storeThemePreference(theme);
    }

    /**
     * Apply system theme automatically
     */
    applySystemTheme() {
        if (this.currentTheme === 'auto') {
            this.applyTheme('auto');
        }
    }

    /**
     * Get system preferred theme
     */
    getSystemTheme() {
        return this.mediaQuery?.matches ? 'dark' : 'light';
    }

    /**
     * Update mobile browser theme color
     */
    updateMetaThemeColor(theme) {
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (themeColorMeta) {
            const colors = {
                light: '#667eea',
                dark: '#1f2937'
            };
            themeColorMeta.setAttribute('content', colors[theme] || colors.light);
        }
    }

    /* ============================================================================
       CUSTOM THEMES
       ============================================================================ */

    /**
     * Register custom theme
     */
    registerTheme(name, themeConfig) {
        if (!name || typeof name !== 'string') {
            throw new ThemeError('Theme name must be a non-empty string');
        }

        if (!themeConfig || typeof themeConfig !== 'object') {
            throw new ThemeError('Theme configuration must be an object');
        }

        // Validate theme configuration
        this.validateThemeConfig(themeConfig);

        // Store custom theme
        this.customThemes.set(name, {
            ...themeConfig,
            name,
            created: Date.now()
        });

        // Add to available themes
        if (!this.availableThemes.includes(name)) {
            this.availableThemes.push(name);
        }

        // Save to storage
        this.saveCustomThemes();

        console.log(`🎨 Custom theme registered: ${name}`);
        return true;
    }

    /**
     * Remove custom theme
     */
    unregisterTheme(name) {
        if (!this.customThemes.has(name)) {
            return false;
        }

        // Don't allow removing built-in themes
        if (['light', 'dark', 'auto'].includes(name)) {
            throw new ThemeError('Cannot remove built-in themes');
        }

        this.customThemes.delete(name);
        this.availableThemes = this.availableThemes.filter(theme => theme !== name);

        // If current theme is being removed, switch to light
        if (this.currentTheme === name) {
            this.setTheme('light');
        }

        this.saveCustomThemes();
        console.log(`🎨 Custom theme removed: ${name}`);
        return true;
    }

    /**
     * Apply custom theme CSS variables
     */
    applyCustomTheme(themeConfig) {
        const root = document.documentElement;

        // Apply CSS custom properties
        if (themeConfig.colors) {
            Object.entries(themeConfig.colors).forEach(([key, value]) => {
                root.style.setProperty(`--${key}`, value);
            });
        }

        // Apply fonts
        if (themeConfig.fonts) {
            Object.entries(themeConfig.fonts).forEach(([key, value]) => {
                root.style.setProperty(`--font-${key}`, value);
            });
        }

        // Apply spacing
        if (themeConfig.spacing) {
            Object.entries(themeConfig.spacing).forEach(([key, value]) => {
                root.style.setProperty(`--space-${key}`, value);
            });
        }
    }

    /**
     * Validate theme configuration
     */
    validateThemeConfig(config) {
        const requiredProps = ['colors'];
        const validProps = ['colors', 'fonts', 'spacing', 'shadows', 'borders'];

        // Check required properties
        requiredProps.forEach(prop => {
            if (!config.hasOwnProperty(prop)) {
                throw new ThemeError(`Missing required theme property: ${prop}`);
            }
        });

        // Check for invalid properties
        Object.keys(config).forEach(prop => {
            if (!validProps.includes(prop) && !['name', 'created'].includes(prop)) {
                console.warn(`🎨 Unknown theme property: ${prop}`);
            }
        });

        // Validate colors
        if (config.colors && typeof config.colors !== 'object') {
            throw new ThemeError('Theme colors must be an object');
        }
    }

    /* ============================================================================
       THEME PERSISTENCE
       ============================================================================ */

    /**
     * Store theme preference
     */
    storeThemePreference(theme) {
        try {
            localStorage.setItem('yatwa_theme', theme);
        } catch (error) {
            console.warn('🎨 Failed to store theme preference:', error);
        }
    }

    /**
     * Load theme preference
     */
    loadThemePreference() {
        try {
            return localStorage.getItem('yatwa_theme') || 'auto';
        } catch (error) {
            console.warn('🎨 Failed to load theme preference:', error);
            return 'auto';
        }
    }

    /**
     * Save custom themes to storage
     */
    saveCustomThemes() {
        try {
            const themesData = Array.from(this.customThemes.entries());
            localStorage.setItem('yatwa_custom_themes', JSON.stringify(themesData));
        } catch (error) {
            console.warn('🎨 Failed to save custom themes:', error);
        }
    }

    /**
     * Load custom themes from storage
     */
    loadCustomThemes() {
        try {
            const stored = localStorage.getItem('yatwa_custom_themes');
            if (stored) {
                const themesData = JSON.parse(stored);
                this.customThemes = new Map(themesData);

                // Add custom theme names to available themes
                this.customThemes.forEach((config, name) => {
                    if (!this.availableThemes.includes(name)) {
                        this.availableThemes.push(name);
                    }
                });
            }
        } catch (error) {
            console.warn('🎨 Failed to load custom themes:', error);
        }
    }

    /* ============================================================================
       THEME UTILITIES
       ============================================================================ */

    /**
     * Check if theme is valid
     */
    isValidTheme(theme) {
        return this.availableThemes.includes(theme);
    }

    /**
     * Get all available themes
     */
    getAvailableThemes() {
        return [...this.availableThemes];
    }

    /**
     * Get theme information
     */
    getThemeInfo(theme) {
        if (!this.isValidTheme(theme)) {
            return null;
        }

        const info = {
            name: theme,
            isCustom: this.customThemes.has(theme),
            isSystem: theme === 'auto',
            isCurrent: theme === this.currentTheme
        };

        if (this.customThemes.has(theme)) {
            info.config = this.customThemes.get(theme);
        }

        return info;
    }

    /**
     * Get current theme statistics
     */
    getThemeStats() {
        return {
            currentTheme: this.currentTheme,
            effectiveTheme: this.getEffectiveTheme(),
            systemTheme: this.getSystemTheme(),
            availableThemes: this.availableThemes.length,
            customThemes: this.customThemes.size,
            listeners: this.listeners.size
        };
    }

    /**
     * Generate theme preview
     */
    generateThemePreview(theme) {
        const effectiveTheme = theme === 'auto' ? this.getSystemTheme() : theme;

        return {
            theme,
            effectiveTheme,
            preview: {
                background: effectiveTheme === 'dark' ? '#1f2937' : '#ffffff',
                text: effectiveTheme === 'dark' ? '#f9fafb' : '#111827',
                primary: '#667eea',
                secondary: '#764ba2'
            }
        };
    }

    /* ============================================================================
       EVENT HANDLING
       ============================================================================ */

    /**
     * Add theme change listener
     */
    addListener(callback) {
        if (typeof callback === 'function') {
            this.listeners.add(callback);
            return () => this.listeners.delete(callback);
        }
    }

    /**
     * Remove theme change listener
     */
    removeListener(callback) {
        return this.listeners.delete(callback);
    }

    /**
     * Notify all listeners
     */
    notifyListeners(event, data) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('🎨 Theme listener error:', error);
            }
        });
    }

    /* ============================================================================
       THEME IMPORT/EXPORT
       ============================================================================ */

    /**
     * Export theme configuration
     */
    exportTheme(themeName) {
        if (!this.customThemes.has(themeName)) {
            throw new ThemeError(`Theme '${themeName}' not found`);
        }

        const themeConfig = this.customThemes.get(themeName);
        return {
            name: themeName,
            version: '1.0',
            exported: new Date().toISOString(),
            config: themeConfig
        };
    }

    /**
     * Import theme configuration
     */
    importTheme(themeData) {
        if (!themeData || !themeData.config || !themeData.name) {
            throw new ThemeError('Invalid theme data');
        }

        this.registerTheme(themeData.name, themeData.config);
        return themeData.name;
    }

    /**
     * Export all custom themes
     */
    exportAllThemes() {
        const themes = {};
        this.customThemes.forEach((config, name) => {
            themes[name] = config;
        });

        return {
            version: '1.0',
            exported: new Date().toISOString(),
            themes
        };
    }

    /* ============================================================================
       CLEANUP
       ============================================================================ */

    /**
     * Cleanup and remove event listeners
     */
    destroy() {
        if (this.mediaQuery) {
            this.mediaQuery.removeEventListener('change', this.applySystemTheme);
        }

        this.listeners.clear();
        console.log('🎨 Theme service destroyed');
    }
}

/* ============================================================================
   CUSTOM ERROR CLASS
   ============================================================================ */

export class ThemeError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ThemeError';
    }
}

/* ============================================================================
   THEME PRESETS
   ============================================================================ */

export const THEME_PRESETS = {
    sunset: {
        colors: {
            primary: '#ff6b6b',
            secondary: '#ffa07a',
            'bg-primary': '#fff5f5',
            'text-primary': '#2d1b1b'
        }
    },
    ocean: {
        colors: {
            primary: '#4a90e2',
            secondary: '#7bb3f0',
            'bg-primary': '#f0f8ff',
            'text-primary': '#1a365d'
        }
    },
    forest: {
        colors: {
            primary: '#48bb78',
            secondary: '#68d391',
            'bg-primary': '#f0fff4',
            'text-primary': '#1a202c'
        }
    }
};

/* ============================================================================
   EXPORT DEFAULT INSTANCE
   ============================================================================ */

export default new ThemeService();