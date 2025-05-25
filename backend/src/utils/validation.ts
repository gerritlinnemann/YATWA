// ✅ Validation utilities for YATWA API
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

export interface EventValidationData {
    title?: string;
    event_date?: string;
    event_time?: string | null;
    icon?: string;
    description?: string | null;
}

// Available icons for events
export const VALID_ICONS = [
    'calendar', 'meeting', 'birthday', 'reminder', 'work', 'personal',
    'travel', 'health', 'shopping', 'sports', 'education', 'entertainment',
    'family', 'friends', 'important', 'deadline', 'appointment', 'event',
    'conference', 'party', 'vacation', 'anniversary', 'project', 'task'
];

export class ValidationService {

    /**
     * Validate event data for creation
     */
    static validateCreateEvent(data: EventValidationData): ValidationResult {
        const errors: string[] = [];

        // Title validation
        if (!data.title || typeof data.title !== 'string') {
            errors.push('Titel ist erforderlich');
        } else if (data.title.trim().length === 0) {
            errors.push('Titel darf nicht leer sein');
        } else if (data.title.length > 255) {
            errors.push('Titel ist zu lang (max. 255 Zeichen)');
        }

        // Date validation
        if (!data.event_date || typeof data.event_date !== 'string') {
            errors.push('Datum ist erforderlich');
        } else if (!this.isValidDate(data.event_date)) {
            errors.push('Ungültiges Datumsformat (erwwartet: YYYY-MM-DD)');
        }

        // Time validation (optional)
        if (data.event_time !== undefined && data.event_time !== null) {
            if (typeof data.event_time !== 'string' || !this.isValidTime(data.event_time)) {
                errors.push('Ungültiges Zeitformat (erwartet: HH:MM oder HH:MM:SS)');
            }
        }

        // Icon validation
        if (data.icon && !VALID_ICONS.includes(data.icon)) {
            errors.push(`Ungültiges Icon. Erlaubte Icons: ${VALID_ICONS.join(', ')}`);
        }

        // Description validation
        if (data.description && typeof data.description === 'string' && data.description.length > 1000) {
            errors.push('Beschreibung ist zu lang (max. 1000 Zeichen)');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate event data for update (all fields optional)
     */
    static validateUpdateEvent(data: EventValidationData): ValidationResult {
        const errors: string[] = [];

        // Title validation (if provided)
        if (data.title !== undefined) {
            if (typeof data.title !== 'string') {
                errors.push('Titel muss ein String sein');
            } else if (data.title.trim().length === 0) {
                errors.push('Titel darf nicht leer sein');
            } else if (data.title.length > 255) {
                errors.push('Titel ist zu lang (max. 255 Zeichen)');
            }
        }

        // Date validation (if provided)
        if (data.event_date !== undefined) {
            if (typeof data.event_date !== 'string' || !this.isValidDate(data.event_date)) {
                errors.push('Ungültiges Datumsformat (erwartet: YYYY-MM-DD)');
            }
        }

        // Time validation (if provided)
        if (data.event_time !== undefined && data.event_time !== null) {
            if (typeof data.event_time !== 'string' || !this.isValidTime(data.event_time)) {
                errors.push('Ungültiges Zeitformat (erwartet: HH:MM oder HH:MM:SS)');
            }
        }

        // Icon validation (if provided)
        if (data.icon !== undefined && data.icon && !VALID_ICONS.includes(data.icon)) {
            errors.push(`Ungültiges Icon. Erlaubte Icons: ${VALID_ICONS.join(', ')}`);
        }

        // Description validation (if provided)
        if (data.description !== undefined && data.description &&
            typeof data.description === 'string' && data.description.length > 1000) {
            errors.push('Beschreibung ist zu lang (max. 1000 Zeichen)');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate date string (YYYY-MM-DD format)
     */
    static isValidDate(dateString: string): boolean {
        // Check format with regex
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateString)) {
            return false;
        }

        // Check if it's a valid date
        const date = new Date(dateString + 'T00:00:00.000Z');
        const [year, month, day] = dateString.split('-').map(Number);

        return date.getUTCFullYear() === year &&
            date.getUTCMonth() === month - 1 &&
            date.getUTCDate() === day;
    }

    /**
     * Validate time string (HH:MM or HH:MM:SS format)
     */
    static isValidTime(timeString: string): boolean {
        // Check format with regex (HH:MM or HH:MM:SS)
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
        return timeRegex.test(timeString);
    }

    /**
     * Validate hash format
     */
    static isValidHash(hash: string): boolean {
        if (!hash || typeof hash !== 'string') {
            return false;
        }

        // Should be hexadecimal and reasonable length
        const hashRegex = /^[a-f0-9]{16,}$/i;
        return hashRegex.test(hash);
    }

    /**
     * Validate pagination parameters
     */
    static validatePagination(limit?: string, offset?: string): {
        limit: number;
        offset: number;
        errors: string[];
    } {
        const errors: string[] = [];
        let validLimit = 50; // default
        let validOffset = 0; // default

        if (limit !== undefined) {
            const parsedLimit = parseInt(limit);
            if (isNaN(parsedLimit) || parsedLimit < 1) {
                errors.push('Limit muss eine positive Zahl sein');
            } else if (parsedLimit > 1000) {
                errors.push('Limit ist zu groß (max. 1000)');
            } else {
                validLimit = parsedLimit;
            }
        }

        if (offset !== undefined) {
            const parsedOffset = parseInt(offset);
            if (isNaN(parsedOffset) || parsedOffset < 0) {
                errors.push('Offset muss eine nicht-negative Zahl sein');
            } else {
                validOffset = parsedOffset;
            }
        }

        return {
            limit: validLimit,
            offset: validOffset,
            errors
        };
    }

    /**
     * Validate date range
     */
    static validateDateRange(startDate?: string, endDate?: string): ValidationResult {
        const errors: string[] = [];

        if (startDate && !this.isValidDate(startDate)) {
            errors.push('Ungültiges Startdatum (erwartet: YYYY-MM-DD)');
        }

        if (endDate && !this.isValidDate(endDate)) {
            errors.push('Ungültiges Enddatum (erwartet: YYYY-MM-DD)');
        }

        if (startDate && endDate && this.isValidDate(startDate) && this.isValidDate(endDate)) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            if (start > end) {
                errors.push('Startdatum muss vor dem Enddatum liegen');
            }

            // Check for reasonable range (max 2 years)
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > 730) { // 2 years
                errors.push('Datumsbereich ist zu groß (max. 2 Jahre)');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Sanitize string input
     */
    static sanitizeString(input: string): string {
        return input.trim().replace(/\s+/g, ' '); // Remove extra whitespace
    }

    /**
     * Format time string to HH:MM:SS
     */
    static formatTimeString(timeString: string): string {
        // If it's already HH:MM:SS, return as is
        if (/^\d{2}:\d{2}:\d{2}$/.test(timeString)) {
            return timeString;
        }

        // If it's HH:MM, add :00
        if (/^\d{1,2}:\d{2}$/.test(timeString)) {
            const [hours, minutes] = timeString.split(':');
            return `${hours.padStart(2, '0')}:${minutes}:00`;
        }

        return timeString;
    }
}