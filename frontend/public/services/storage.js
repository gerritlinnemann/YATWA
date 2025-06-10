// 💾 YATWA Storage Service - LocalStorage Management
// Handles all client-side data persistence with encryption and validation

export class StorageService {
    constructor() {
        this.prefix = 'yatwa_';
        this.version = '1.0';
        this.encryptionKey = this.generateEncryptionKey();

        // Storage quotas and limits
        this.maxItemSize = 1024 * 1024; // 1MB per item
        this.maxTotalSize = 5 * 1024 * 1024; // 5MB total

        // Initialize storage
        this.init();
    }

    /* ============================================================================
       INITIALIZATION
       ============================================================================ */

    init() {
        try {
            // Check if localStorage is available
            if (!this.isStorageAvailable()) {
                console.warn('💾 LocalStorage not available - using memory fallback');
                this.useMemoryFallback();
                return;
            }

            // Initialize version tracking
            this.initializeVersion();

            // Clean up expired items
            this.cleanupExpired();

            // Check storage quota
            this.checkStorageQuota();

            console.log('💾 Storage service initialized');

        } catch (error) {
            console.error('💾 Storage initialization failed:', error);
            this.useMemoryFallback();
        }
    }

    /**
     * Check if localStorage is available
     */
    isStorageAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Use memory as fallback when localStorage is not available
     */
    useMemoryFallback() {
        this.memoryStorage = new Map();
        this.usingMemoryFallback = true;
        console.warn('💾 Using memory fallback - data will not persist between sessions');
    }

    /**
     * Initialize version tracking for migrations
     */
    initializeVersion() {
        const storedVersion = this.getRaw('version');
        if (!storedVersion) {
            this.setRaw('version', this.version);
        } else if (storedVersion !== this.version) {
            this.migrateData(storedVersion, this.version);
        }
    }

    /* ============================================================================
       CORE STORAGE METHODS
       ============================================================================ */

    /**
     * Set item in storage with options
     */
    set(key, value, options = {}) {
        try {
            const item = {
                value,
                timestamp: Date.now(),
                version: this.version,
                ...options
            };

            // Add expiration if specified
            if (options.ttl) {
                item.expires = Date.now() + (options.ttl * 1000);
            }

            // Validate size
            const serialized = JSON.stringify(item);
            if (serialized.length > this.maxItemSize) {
                throw new StorageError(`Item too large: ${serialized.length} bytes (max: ${this.maxItemSize})`);
            }

            // Store with encryption if sensitive
            const finalValue = options.encrypt ? this.encrypt(serialized) : serialized;

            this.setRaw(this.getKey(key), finalValue);

            return true;

        } catch (error) {
            console.error(`💾 Failed to set ${key}:`, error);
            return false;
        }
    }

    /**
     * Get item from storage
     */
    get(key, defaultValue = null) {
        try {
            const rawValue = this.getRaw(this.getKey(key));
            if (!rawValue) {
                return defaultValue;
            }

            // Try to parse the stored item
            let item;
            try {
                // Check if it's encrypted
                const decrypted = this.isEncrypted(rawValue) ? this.decrypt(rawValue) : rawValue;
                item = JSON.parse(decrypted);
            } catch (error) {
                // Handle legacy data without metadata
                return rawValue;
            }

            // Validate item structure
            if (!item || typeof item !== 'object' || !item.hasOwnProperty('value')) {
                return defaultValue;
            }

            // Check if expired
            if (item.expires && Date.now() > item.expires) {
                this.remove(key);
                return defaultValue;
            }

            return item.value;

        } catch (error) {
            console.error(`💾 Failed to get ${key}:`, error);
            return defaultValue;
        }
    }

    /**
     * Remove item from storage
     */
    remove(key) {
        try {
            this.removeRaw(this.getKey(key));
            return true;
        } catch (error) {
            console.error(`💾 Failed to remove ${key}:`, error);
            return false;
        }
    }

    /**
     * Check if key exists
     */
    has(key) {
        return this.getRaw(this.getKey(key)) !== null;
    }

    /**
     * Clear all YATWA data
     */
    clear() {
        try {
            if (this.usingMemoryFallback) {
                this.memoryStorage.clear();
            } else {
                const keys = Object.keys(localStorage);
                keys
                    .filter(key => key.startsWith(this.prefix))
                    .forEach(key => localStorage.removeItem(key));
            }

            console.log('💾 Storage cleared');
            return true;

        } catch (error) {
            console.error('💾 Failed to clear storage:', error);
            return false;
        }
    }

    /* ============================================================================
       RAW STORAGE METHODS (INTERNAL)
       ============================================================================ */

    setRaw(key, value) {
        if (this.usingMemoryFallback) {
            this.memoryStorage.set(key, value);
        } else {
            localStorage.setItem(key, value);
        }
    }

    getRaw(key) {
        if (this.usingMemoryFallback) {
            return this.memoryStorage.get(key) || null;
        } else {
            return localStorage.getItem(key);
        }
    }

    removeRaw(key) {
        if (this.usingMemoryFallback) {
            this.memoryStorage.delete(key);
        } else {
            localStorage.removeItem(key);
        }
    }

    /* ============================================================================
       SPECIALIZED STORAGE METHODS
       ============================================================================ */

    /**
     * Store user data securely
     */
    setUser(userData) {
        return this.set('user', userData, {
            encrypt: true,
            ttl: 30 * 24 * 60 * 60 // 30 days
        });
    }

    /**
     * Get user data
     */
    getUser() {
        return this.get('user');
    }

    /**
     * Store user hash securely
     */
    setUserHash(hash) {
        return this.set('userHash', hash, {
            encrypt: true,
            ttl: 30 * 24 * 60 * 60 // 30 days
        });
    }

    /**
     * Get user hash
     */
    getUserHash() {
        return this.get('userHash');
    }

    /**
     * Store theme preference
     */
    setTheme(theme) {
        return this.set('theme', theme, {
            ttl: 365 * 24 * 60 * 60 // 1 year
        });
    }

    /**
     * Get theme preference
     */
    getTheme() {
        return this.get('theme');
    }

    /**
     * Store settings
     */
    setSettings(settings) {
        return this.set('settings', settings, {
            ttl: 365 * 24 * 60 * 60 // 1 year
        });
    }

    /**
     * Get settings
     */
    getSettings(defaultSettings = {}) {
        return this.get('settings', defaultSettings);
    }

    /**
     * Cache events temporarily
     */
    cacheEvents(userHash, events) {
        const key = `events_${userHash}`;
        return this.set(key, {
            events,
            cached: Date.now()
        }, {
            ttl: 5 * 60 // 5 minutes
        });
    }

    /**
     * Get cached events
     */
    getCachedEvents(userHash) {
        const key = `events_${userHash}`;
        const cached = this.get(key);
        return cached ? cached.events : null;
    }

    /**
     * Store app state for recovery
     */
    saveAppState(state) {
        return this.set('appState', state, {
            ttl: 24 * 60 * 60 // 24 hours
        });
    }

    /**
     * Get saved app state
     */
    getAppState() {
        return this.get('appState');
    }

    /* ============================================================================
       ENCRYPTION METHODS
       ============================================================================ */

    /**
     * Generate encryption key from browser fingerprint
     */
    generateEncryptionKey() {
        const fingerprint = [
            navigator.userAgent,
            navigator.language,
            screen.width,
            screen.height,
            new Date().getTimezoneOffset()
        ].join('|');

        return this.simpleHash(fingerprint);
    }

    /**
     * Simple hash function for encryption key
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Simple encryption (not cryptographically secure, just obfuscation)
     */
    encrypt(text) {
        try {
            let result = '';
            for (let i = 0; i < text.length; i++) {
                const char = text.charCodeAt(i);
                const keyChar = this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
                result += String.fromCharCode(char ^ keyChar);
            }
            return btoa(result); // Base64 encode
        } catch (error) {
            console.warn('💾 Encryption failed, storing as plain text');
            return text;
        }
    }

    /**
     * Simple decryption
     */
    decrypt(encryptedText) {
        try {
            const encrypted = atob(encryptedText); // Base64 decode
            let result = '';
            for (let i = 0; i < encrypted.length; i++) {
                const char = encrypted.charCodeAt(i);
                const keyChar = this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
                result += String.fromCharCode(char ^ keyChar);
            }
            return result;
        } catch (error) {
            console.warn('💾 Decryption failed, returning as-is');
            return encryptedText;
        }
    }

    /**
     * Check if data is encrypted
     */
    isEncrypted(data) {
        try {
            // Simple check: encrypted data should be base64
            return btoa(atob(data)) === data;
        } catch (error) {
            return false;
        }
    }

    /* ============================================================================
       UTILITY METHODS
       ============================================================================ */

    /**
     * Get prefixed key
     */
    getKey(key) {
        return `${this.prefix}${key}`;
    }

    /**
     * Get all YATWA keys
     */
    getAllKeys() {
        if (this.usingMemoryFallback) {
            return Array.from(this.memoryStorage.keys())
                .filter(key => key.startsWith(this.prefix))
                .map(key => key.substring(this.prefix.length));
        } else {
            return Object.keys(localStorage)
                .filter(key => key.startsWith(this.prefix))
                .map(key => key.substring(this.prefix.length));
        }
    }

    /**
     * Get storage statistics
     */
    getStorageStats() {
        const keys = this.getAllKeys();
        let totalSize = 0;
        const items = {};

        keys.forEach(key => {
            const value = this.getRaw(this.getKey(key));
            const size = value ? value.length : 0;
            totalSize += size;

            items[key] = {
                size,
                exists: !!value
            };
        });

        return {
            totalItems: keys.length,
            totalSize,
            maxTotalSize: this.maxTotalSize,
            usage: (totalSize / this.maxTotalSize) * 100,
            items,
            usingMemoryFallback: this.usingMemoryFallback
        };
    }

    /**
     * Clean up expired items
     */
    cleanupExpired() {
        let cleaned = 0;
        const keys = this.getAllKeys();

        keys.forEach(key => {
            try {
                const rawValue = this.getRaw(this.getKey(key));
                if (!rawValue) return;

                const item = JSON.parse(rawValue);
                if (item.expires && Date.now() > item.expires) {
                    this.remove(key);
                    cleaned++;
                }
            } catch (error) {
                // Skip items that can't be parsed
            }
        });

        if (cleaned > 0) {
            console.log(`💾 Cleaned up ${cleaned} expired items`);
        }
    }

    /**
     * Check storage quota and warn if approaching limit
     */
    checkStorageQuota() {
        const stats = this.getStorageStats();

        if (stats.usage > 80) {
            console.warn(`💾 Storage usage high: ${stats.usage.toFixed(1)}%`);

            if (stats.usage > 95) {
                console.error('💾 Storage almost full! Consider clearing old data.');
                // Auto-cleanup oldest items if critically full
                this.autoCleanup();
            }
        }
    }

    /**
     * Auto cleanup when storage is full
     */
    autoCleanup() {
        console.log('💾 Starting auto-cleanup...');

        // Remove cached events first
        const keys = this.getAllKeys();
        const eventCacheKeys = keys.filter(key => key.startsWith('events_'));

        eventCacheKeys.forEach(key => {
            this.remove(key);
        });

        console.log(`💾 Auto-cleanup completed: removed ${eventCacheKeys.length} cached items`);
    }

    /**
     * Migrate data between versions
     */
    migrateData(fromVersion, toVersion) {
        console.log(`💾 Migrating data from ${fromVersion} to ${toVersion}`);

        // Add migration logic here when needed
        switch (fromVersion) {
            case '0.9':
                // Example migration
                break;
            default:
                console.log('💾 No migration needed');
        }

        this.setRaw('version', toVersion);
    }

    /**
     * Export all data (for backup)
     */
    exportData() {
        const keys = this.getAllKeys();
        const data = {};

        keys.forEach(key => {
            data[key] = this.get(key);
        });

        return {
            version: this.version,
            exported: Date.now(),
            data
        };
    }

    /**
     * Import data (from backup)
     */
    importData(exportedData) {
        if (!exportedData || !exportedData.data) {
            throw new StorageError('Invalid export data');
        }

        let imported = 0;
        Object.entries(exportedData.data).forEach(([key, value]) => {
            if (this.set(key, value)) {
                imported++;
            }
        });

        console.log(`💾 Imported ${imported} items`);
        return imported;
    }
}

/* ============================================================================
   CUSTOM ERROR CLASS
   ============================================================================ */

export class StorageError extends Error {
    constructor(message) {
        super(message);
        this.name = 'StorageError';
    }
}

/* ============================================================================
   EXPORT DEFAULT INSTANCE
   ============================================================================ */

export default new StorageService();