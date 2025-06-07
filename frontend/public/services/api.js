// 🌐 YATWA API Service - Backend Communication
// Handles all HTTP requests to the YATWA backend

export class ApiService {
    constructor() {
        this.baseUrl = '/api'; // Nginx proxy handles this
        this.timeout = 10000; // 10 seconds
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 second
    }

    /* ============================================================================
       HTTP UTILITY METHODS
       ============================================================================ */

    /**
     * Make HTTP request with error handling and retries
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        let lastError;

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                console.log(`🌐 API ${options.method || 'GET'} ${endpoint} (attempt ${attempt})`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);

                const response = await fetch(url, {
                    ...defaultOptions,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                // Check if response is ok
                if (!response.ok) {
                    const errorData = await this.parseErrorResponse(response);
                    throw new ApiError(
                        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
                        response.status,
                        errorData
                    );
                }

                // Parse response
                const data = await this.parseResponse(response);

                console.log(`✅ API ${options.method || 'GET'} ${endpoint} - Success`);
                return data;

            } catch (error) {
                lastError = error;

                console.warn(`⚠️ API ${options.method || 'GET'} ${endpoint} - Attempt ${attempt} failed:`, error.message);

                // Don't retry for certain errors
                if (error instanceof ApiError && !this.shouldRetry(error.status)) {
                    throw error;
                }

                // Don't retry on last attempt
                if (attempt === this.retryAttempts) {
                    break;
                }

                // Wait before retry
                await this.sleep(this.retryDelay * attempt);
            }
        }

        console.error(`❌ API ${options.method || 'GET'} ${endpoint} - All attempts failed`);
        throw lastError;
    }

    /**
     * Parse response based on content type
     */
    async parseResponse(response) {
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
            return await response.json();
        } else if (contentType?.includes('text/')) {
            return await response.text();
        } else {
            return await response.blob();
        }
    }

    /**
     * Parse error response
     */
    async parseErrorResponse(response) {
        try {
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                return await response.json();
            } else {
                return { message: await response.text() };
            }
        } catch (error) {
            return { message: `HTTP ${response.status}: ${response.statusText}` };
        }
    }

    /**
     * Check if we should retry the request
     */
    shouldRetry(status) {
        // Don't retry client errors (400-499) except for specific cases
        if (status >= 400 && status < 500) {
            return [408, 429].includes(status); // Timeout, Rate limit
        }

        // Retry server errors (500-599)
        return status >= 500;
    }

    /**
     * Sleep utility for retries
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /* ============================================================================
       AUTHENTICATION ENDPOINTS
       ============================================================================ */

    /**
     * Register new user and get hash
     */
    async register(email = null) {
        const response = await this.request('/register', {
            method: 'POST',
            body: JSON.stringify({ email })
        });

        if (!response.success) {
            throw new ApiError(response.error || 'Registration failed');
        }

        return {
            success: true,
            hash: response.hash,
            user: {
                hash: response.hash,
                created: response.created,
                link: response.link
            },
            emailSent: response.emailSent || false
        };
    }

    /**
     * Verify hash and get user info
     */
    async verifyHash(hash) {
        if (!hash || typeof hash !== 'string') {
            throw new ApiError('Invalid hash format');
        }

        const response = await this.request(`/verify?hash=${encodeURIComponent(hash)}`);

        if (!response.success) {
            throw new ApiError(response.error || 'Hash verification failed');
        }

        return {
            success: true,
            user: response.user
        };
    }

    /**
     * Get email service status
     */
    async getEmailStatus() {
        const response = await this.request('/email-status');
        return response;
    }

    /* ============================================================================
       EVENT ENDPOINTS
       ============================================================================ */

    /**
     * Get all events for a user
     */
    async getEvents(userHash, options = {}) {
        if (!userHash) {
            throw new ApiError('User hash is required');
        }

        const queryParams = new URLSearchParams();

        if (options.start) queryParams.append('start', options.start);
        if (options.end) queryParams.append('end', options.end);
        if (options.limit) queryParams.append('limit', options.limit.toString());
        if (options.offset) queryParams.append('offset', options.offset.toString());
        if (options.search) queryParams.append('search', options.search);

        const queryString = queryParams.toString();
        const endpoint = `/events/${encodeURIComponent(userHash)}${queryString ? '?' + queryString : ''}`;

        const response = await this.request(endpoint);

        if (!response.success) {
            throw new ApiError(response.error || 'Failed to load events');
        }

        return response.events || [];
    }

    /**
     * Create new event
     */
    async createEvent(userHash, eventData) {
        if (!userHash) {
            throw new ApiError('User hash is required');
        }

        if (!eventData.title || !eventData.event_date) {
            throw new ApiError('Title and date are required');
        }

        const response = await this.request(`/events/${encodeURIComponent(userHash)}`, {
            method: 'POST',
            body: JSON.stringify(eventData)
        });

        if (!response.success) {
            throw new ApiError(response.error || response.errors?.join(', ') || 'Failed to create event');
        }

        return response.event;
    }

    /**
     * Update existing event
     */
    async updateEvent(userHash, eventId, eventData) {
        if (!userHash || !eventId) {
            throw new ApiError('User hash and event ID are required');
        }

        const response = await this.request(`/events/${encodeURIComponent(userHash)}/${eventId}`, {
            method: 'PUT',
            body: JSON.stringify(eventData)
        });

        if (!response.success) {
            throw new ApiError(response.error || response.errors?.join(', ') || 'Failed to update event');
        }

        return response.event;
    }

    /**
     * Delete event
     */
    async deleteEvent(userHash, eventId) {
        if (!userHash || !eventId) {
            throw new ApiError('User hash and event ID are required');
        }

        const response = await this.request(`/events/${encodeURIComponent(userHash)}/${eventId}`, {
            method: 'DELETE'
        });

        if (!response.success) {
            throw new ApiError(response.error || 'Failed to delete event');
        }

        return { success: true };
    }

    /**
     * Get upcoming events
     */
    async getUpcomingEvents(userHash, days = 30) {
        if (!userHash) {
            throw new ApiError('User hash is required');
        }

        const response = await this.request(`/events/${encodeURIComponent(userHash)}/upcoming?days=${days}`);

        if (!response.success) {
            throw new ApiError(response.error || 'Failed to load upcoming events');
        }

        return response.events || [];
    }

    /**
     * Get events grouped by month
     */
    async getEventsByMonth(userHash, year = null) {
        if (!userHash) {
            throw new ApiError('User hash is required');
        }

        const queryString = year ? `?year=${year}` : '';
        const response = await this.request(`/events/${encodeURIComponent(userHash)}/by-month${queryString}`);

        if (!response.success) {
            throw new ApiError(response.error || 'Failed to load events by month');
        }

        return response.eventsByMonth || [];
    }

    /* ============================================================================
       ICAL ENDPOINTS
       ============================================================================ */

    /**
     * Get iCal feed URL
     */
    getICalUrl(userHash, options = {}) {
        if (!userHash) {
            throw new ApiError('User hash is required');
        }

        const queryParams = new URLSearchParams();
        if (options.name) queryParams.append('name', options.name);
        if (options.timezone) queryParams.append('tz', options.timezone);

        const queryString = queryParams.toString();
        return `${window.location.origin}/api/ical/${encodeURIComponent(userHash)}${queryString ? '?' + queryString : ''}`;
    }

    /**
     * Get calendar information and URLs
     */
    async getCalendarInfo(userHash) {
        if (!userHash) {
            throw new ApiError('User hash is required');
        }

        const response = await this.request(`/ical/${encodeURIComponent(userHash)}/info`);

        if (!response.success) {
            throw new ApiError(response.error || 'Failed to get calendar info');
        }

        return response.calendar;
    }

    /**
     * Validate iCal feed
     */
    async validateICalFeed(userHash) {
        if (!userHash) {
            throw new ApiError('User hash is required');
        }

        const response = await this.request(`/ical/${encodeURIComponent(userHash)}/validate`);

        if (!response.success) {
            throw new ApiError(response.error || 'Failed to validate iCal feed');
        }

        return response.validation;
    }

    /* ============================================================================
       UTILITY ENDPOINTS
       ============================================================================ */

    /**
     * Get available icons
     */
    async getAvailableIcons() {
        const response = await this.request('/icons');

        if (!response.success) {
            throw new ApiError(response.error || 'Failed to load icons');
        }

        return response.icons || [];
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            const response = await this.request('/health');
            return {
                status: response.status || 'OK',
                database: response.database || 'Unknown',
                timestamp: response.timestamp
            };
        } catch (error) {
            return {
                status: 'ERROR',
                error: error.message
            };
        }
    }

    /* ============================================================================
       BATCH OPERATIONS
       ============================================================================ */

    /**
     * Create multiple events in batch
     */
    async createEventsBatch(userHash, eventsData) {
        if (!userHash || !Array.isArray(eventsData)) {
            throw new ApiError('User hash and events array are required');
        }

        const results = [];
        const errors = [];

        for (let i = 0; i < eventsData.length; i++) {
            try {
                const event = await this.createEvent(userHash, eventsData[i]);
                results.push(event);
            } catch (error) {
                errors.push({ index: i, error: error.message });
            }
        }

        return {
            success: errors.length === 0,
            results,
            errors,
            created: results.length,
            failed: errors.length
        };
    }

    /* ============================================================================
       CONNECTION UTILITIES
       ============================================================================ */

    /**
     * Test API connection
     */
    async testConnection() {
        try {
            const start = Date.now();
            await this.healthCheck();
            const duration = Date.now() - start;

            return {
                connected: true,
                responseTime: duration
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message
            };
        }
    }

    /**
     * Get connection info
     */
    getConnectionInfo() {
        return {
            baseUrl: this.baseUrl,
            timeout: this.timeout,
            retryAttempts: this.retryAttempts,
            online: navigator.onLine
        };
    }
}

/* ============================================================================
   CUSTOM ERROR CLASS
   ============================================================================ */

export class ApiError extends Error {
    constructor(message, status = null, data = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }

    toString() {
        return `ApiError: ${this.message}${this.status ? ` (${this.status})` : ''}`;
    }
}

/* ============================================================================
   EXPORT DEFAULT INSTANCE
   ============================================================================ */

export default new ApiService();