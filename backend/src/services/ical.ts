// 📊 iCal Service - RFC 5545 compliant calendar feed generation
import { Event } from '../models/Event';

export interface ICalConfig {
    prodId: string;
    calName: string;
    calDescription: string;
    timezone: string;
    url: string;
}

export class ICalService {
    private config: ICalConfig;

    constructor(customConfig?: Partial<ICalConfig>) {
        this.config = {
            prodId: '-//YATWA//Yet Another Trash Web App//EN',
            calName: 'YATWA Calendar',
            calDescription: 'Personal calendar from YATWA - Yet Another Trash Web App',
            timezone: 'Europe/Berlin',
            url: process.env.APP_URL || 'http://localhost',
            ...customConfig
        };
    }

    /**
     * Generate complete iCal feed from events
     */
    generateCalendar(events: Event[], userHash: string): string {
        const now = new Date();
        const calendarLines: string[] = [];

        // Calendar header
        calendarLines.push('BEGIN:VCALENDAR');
        calendarLines.push('VERSION:2.0');
        calendarLines.push(`PRODID:${this.config.prodId}`);
        calendarLines.push('CALSCALE:GREGORIAN');
        calendarLines.push('METHOD:PUBLISH');

        // Calendar metadata
        calendarLines.push(`X-WR-CALNAME:${this.config.calName} - ${userHash.substring(0, 8)}`);
        calendarLines.push(`X-WR-CALDESC:${this.config.calDescription}`);
        calendarLines.push(`X-WR-TIMEZONE:${this.config.timezone}`);
        calendarLines.push(`X-PUBLISHED-TTL:PT1H`); // Refresh every hour

        // Calendar URL for updates
        calendarLines.push(`URL:${this.config.url}/api/ical/${userHash}`);
        calendarLines.push(`REFRESH-INTERVAL;VALUE=DURATION:PT1H`);
        calendarLines.push(`X-WR-RELCALID:${userHash}`);

        // Timezone definition
        calendarLines.push(...this.generateTimezone());

        // Events
        events.forEach(event => {
            calendarLines.push(...this.generateEvent(event, userHash));
        });

        // Calendar footer
        calendarLines.push('END:VCALENDAR');

        return calendarLines.join('\r\n') + '\r\n';
    }

    /**
     * Generate timezone definition (Europe/Berlin)
     */
    private generateTimezone(): string[] {
        return [
            'BEGIN:VTIMEZONE',
            'TZID:Europe/Berlin',
            'BEGIN:DAYLIGHT',
            'TZOFFSETFROM:+0100',
            'TZOFFSETTO:+0200',
            'TZNAME:CEST',
            'DTSTART:19700329T020000',
            'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
            'END:DAYLIGHT',
            'BEGIN:STANDARD',
            'TZOFFSETFROM:+0200',
            'TZOFFSETTO:+0100',
            'TZNAME:CET',
            'DTSTART:19701025T030000',
            'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
            'END:STANDARD',
            'END:VTIMEZONE'
        ];
    }

    /**
     * Generate single event in iCal format
     */
    private generateEvent(event: Event, userHash: string): string[] {
        const eventLines: string[] = [];
        const now = new Date();

        // Event start
        eventLines.push('BEGIN:VEVENT');

        // Unique ID for the event
        const uid = `${event.id}-${userHash}@yatwa.app`;
        eventLines.push(`UID:${uid}`);

        // Timestamps
        eventLines.push(`DTSTAMP:${this.formatDateTime(now)}`);
        eventLines.push(`CREATED:${this.formatDateTime(event.created_at)}`);
        eventLines.push(`LAST-MODIFIED:${this.formatDateTime(event.updated_at)}`);

        // Event date and time
        if (event.event_time) {
            // Timed event
            const eventDateTime = this.combineDateTime(event.event_date, event.event_time);
            eventLines.push(`DTSTART;TZID=Europe/Berlin:${this.formatDateTime(eventDateTime, false)}`);

            // Default duration: 1 hour
            const endDateTime = new Date(eventDateTime.getTime() + 60 * 60 * 1000);
            eventLines.push(`DTEND;TZID=Europe/Berlin:${this.formatDateTime(endDateTime, false)}`);
        } else {
            // All-day event
            eventLines.push(`DTSTART;VALUE=DATE:${this.formatDate(event.event_date)}`);

            // Calculate next day for all-day events
            let nextDayDate: Date;
            if (event.event_date instanceof Date) {
                nextDayDate = new Date(event.event_date);
                nextDayDate.setDate(nextDayDate.getDate() + 1);
            } else {
                nextDayDate = new Date(event.event_date + 'T00:00:00.000Z');
                nextDayDate.setUTCDate(nextDayDate.getUTCDate() + 1);
            }

            eventLines.push(`DTEND;VALUE=DATE:${this.formatDate(nextDayDate)}`);
        }

        // Event details
        eventLines.push(`SUMMARY:${this.escapeText(event.title)}`);

        if (event.description) {
            eventLines.push(`DESCRIPTION:${this.escapeText(event.description)}`);
        }

        // Categories based on icon
        const category = this.iconToCategory(event.icon);
        if (category) {
            eventLines.push(`CATEGORIES:${category}`);
        }

        // Priority based on icon
        const priority = this.iconToPriority(event.icon);
        eventLines.push(`PRIORITY:${priority}`);

        // Status
        eventLines.push('STATUS:CONFIRMED');

        // Transparency (show as busy)
        eventLines.push('TRANSP:OPAQUE');

        // Classification
        eventLines.push('CLASS:PRIVATE');

        // Sequence (for updates)
        eventLines.push('SEQUENCE:0');

        // URL back to the calendar
        eventLines.push(`URL:${this.config.url}?hash=${userHash}`);

        // Custom properties
        eventLines.push(`X-YATWA-ICON:${event.icon}`);
        eventLines.push(`X-YATWA-ID:${event.id}`);

        // Event end
        eventLines.push('END:VEVENT');

        return eventLines;
    }

    /**
     * Format date for iCal (YYYYMMDD) - handles both Date objects and strings
     */
    private formatDate(dateInput: string | Date): string {
        let dateString: string;

        if (dateInput instanceof Date) {
            // If it's a Date object, convert to YYYY-MM-DD format
            const year = dateInput.getFullYear();
            const month = String(dateInput.getMonth() + 1).padStart(2, '0');
            const day = String(dateInput.getDate()).padStart(2, '0');
            dateString = `${year}-${month}-${day}`;
        } else if (typeof dateInput === 'string') {
            dateString = dateInput;
        } else {
            // Fallback for unexpected types
            console.warn('Unexpected date type:', typeof dateInput, dateInput);
            dateString = String(dateInput);
        }

        return dateString.replace(/-/g, '');
    }

    /**
     * Format datetime for iCal (YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS)
     */
    private formatDateTime(date: Date, utc: boolean = true): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        const formatted = `${year}${month}${day}T${hours}${minutes}${seconds}`;
        return utc ? formatted + 'Z' : formatted;
    }

    /**
     * Combine date and time strings into Date object - handles both Date objects and strings
     */
    private combineDateTime(dateInput: string | Date, timeString: string): Date {
        let dateString: string;

        if (dateInput instanceof Date) {
            // If it's a Date object, convert to YYYY-MM-DD format
            const year = dateInput.getFullYear();
            const month = String(dateInput.getMonth() + 1).padStart(2, '0');
            const day = String(dateInput.getDate()).padStart(2, '0');
            dateString = `${year}-${month}-${day}`;
        } else {
            dateString = String(dateInput);
        }

        return new Date(`${dateString}T${timeString}`);
    }

    /**
     * Escape text for iCal format
     */
    private escapeText(text: string): string {
        return text
            .replace(/\\/g, '\\\\')  // Escape backslashes
            .replace(/;/g, '\\;')    // Escape semicolons
            .replace(/,/g, '\\,')    // Escape commas
            .replace(/\n/g, '\\n')   // Escape newlines
            .replace(/\r/g, '')      // Remove carriage returns
            .substring(0, 1000);     // Limit length
    }

    /**
     * Convert icon to calendar category
     */
    private iconToCategory(icon: string): string {
        const categoryMap: Record<string, string> = {
            'work': 'BUSINESS',
            'meeting': 'MEETING',
            'birthday': 'PERSONAL',
            'anniversary': 'PERSONAL',
            'personal': 'PERSONAL',
            'family': 'PERSONAL',
            'friends': 'PERSONAL',
            'health': 'PERSONAL',
            'travel': 'VACATION',
            'vacation': 'VACATION',
            'education': 'EDUCATION',
            'sports': 'PERSONAL',
            'entertainment': 'PERSONAL',
            'shopping': 'PERSONAL',
            'project': 'BUSINESS',
            'task': 'BUSINESS',
            'deadline': 'BUSINESS',
            'conference': 'MEETING',
            'appointment': 'APPOINTMENT',
            'reminder': 'PERSONAL',
            'important': 'BUSINESS',
            'party': 'PERSONAL',
            'event': 'PERSONAL'
        };

        return categoryMap[icon] || 'PERSONAL';
    }

    /**
     * Convert icon to priority (1=high, 5=normal, 9=low)
     */
    private iconToPriority(icon: string): number {
        const highPriority = ['important', 'deadline', 'work', 'meeting', 'appointment'];
        const lowPriority = ['entertainment', 'shopping', 'party'];

        if (highPriority.includes(icon)) return 1;
        if (lowPriority.includes(icon)) return 9;
        return 5; // Normal priority
    }

    /**
     * Generate calendar statistics
     */
    generateStats(events: Event[]): {
        totalEvents: number;
        upcomingEvents: number;
        eventsByCategory: Record<string, number>;
        nextEvent: Event | null;
    } {
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        const upcomingEvents = events.filter(event => {
            const eventDate = event.event_date instanceof Date ?
                event.event_date.toISOString().split('T')[0] :
                String(event.event_date);
            return eventDate >= today;
        });

        const eventsByCategory: Record<string, number> = {};

        events.forEach(event => {
            const category = this.iconToCategory(event.icon);
            eventsByCategory[category] = (eventsByCategory[category] || 0) + 1;
        });

        // Find next event
        const sortedUpcoming = upcomingEvents
            .sort((a, b) => {
                // Convert dates to strings for comparison
                const dateA = a.event_date instanceof Date ?
                    a.event_date.toISOString().split('T')[0] :
                    String(a.event_date);
                const dateB = b.event_date instanceof Date ?
                    b.event_date.toISOString().split('T')[0] :
                    String(b.event_date);

                const dateCompare = dateA.localeCompare(dateB);
                if (dateCompare !== 0) return dateCompare;

                const timeA = a.event_time || '00:00:00';
                const timeB = b.event_time || '00:00:00';
                return timeA.localeCompare(timeB);
            });

        return {
            totalEvents: events.length,
            upcomingEvents: upcomingEvents.length,
            eventsByCategory,
            nextEvent: sortedUpcoming[0] || null
        };
    }

    /**
     * Validate iCal output
     */
    validateCalendar(icalContent: string): {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Basic structure validation
        if (!icalContent.includes('BEGIN:VCALENDAR')) {
            errors.push('Missing VCALENDAR begin');
        }

        if (!icalContent.includes('END:VCALENDAR')) {
            errors.push('Missing VCALENDAR end');
        }

        if (!icalContent.includes('VERSION:2.0')) {
            errors.push('Missing or invalid VERSION');
        }

        if (!icalContent.includes('PRODID:')) {
            errors.push('Missing PRODID');
        }

        // Event validation
        const eventBegins = (icalContent.match(/BEGIN:VEVENT/g) || []).length;
        const eventEnds = (icalContent.match(/END:VEVENT/g) || []).length;

        if (eventBegins !== eventEnds) {
            errors.push(`Mismatched VEVENT tags: ${eventBegins} begin, ${eventEnds} end`);
        }

        // Line length warnings (soft limit)
        const lines = icalContent.split('\n');
        lines.forEach((line, index) => {
            if (line.length > 75) {
                warnings.push(`Line ${index + 1} exceeds 75 characters (${line.length})`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
}