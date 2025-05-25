// 📊 iCal routes - Calendar feed generation for subscription
import { Database } from '../services/database';
import { EventModel } from '../models/Event';
import { UserModel } from '../models/User';
import { ICalService } from '../services/ical';
import { ValidationService } from '../utils/validation';

export const icalRoutes = {
    generateFeed: (db: Database) => async (req: Request, params: Record<string, string>): Promise<Response> => {
        try {
            const { hash } = params;
            const url = new URL(req.url);

            // Validate hash
            if (!ValidationService.isValidHash(hash)) {
                return new Response('Invalid hash format', {
                    status: 400,
                    headers: { 'Content-Type': 'text/plain' }
                });
            }

            // Check if user exists
            const userModel = new UserModel(db);
            const userExists = await userModel.exists(hash);
            if (!userExists) {
                return new Response('Calendar not found', {
                    status: 404,
                    headers: { 'Content-Type': 'text/plain' }
                });
            }

            // Update last accessed
            await userModel.updateLastAccessed(hash);

            // Get events
            const eventModel = new EventModel(db);
            const events = await eventModel.findByUserHash(hash, {
                limit: 1000 // Reasonable limit for calendar feeds
            });

            // Parse query parameters for customization
            const calName = url.searchParams.get('name') || undefined;
            const timezone = url.searchParams.get('tz') || undefined;

            // Initialize iCal service with custom config
            const icalService = new ICalService({
                calName: calName ? `YATWA - ${calName}` : undefined,
                timezone: timezone || undefined,
                url: process.env.APP_URL || 'http://localhost'
            });

            // Generate iCal content
            const icalContent = icalService.generateCalendar(events, hash);

            // Validate generated content
            const validation = icalService.validateCalendar(icalContent);
            if (!validation.isValid) {
                console.error('iCal validation failed:', validation.errors);
                return new Response('Calendar generation failed', {
                    status: 500,
                    headers: { 'Content-Type': 'text/plain' }
                });
            }

            // Log warnings if any
            if (validation.warnings.length > 0) {
                console.warn('iCal warnings:', validation.warnings);
            }

            // Generate filename
            const shortHash = hash.substring(0, 8);
            const filename = `yatwa-calendar-${shortHash}.ics`;

            // Return iCal content
            return new Response(icalContent, {
                status: 200,
                headers: {
                    'Content-Type': 'text/calendar; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                    'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
                    'ETag': `"${hash}-${events.length}-${Date.now()}"`,
                    'Last-Modified': new Date().toUTCString(),
                    // Calendar-specific headers
                    'X-Published-TTL': 'PT1H', // Refresh every hour
                    'Refresh-Interval': '3600',
                    // CORS headers for web access
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET',
                    'Access-Control-Max-Age': '86400'
                }
            });

        } catch (error) {
            console.error('iCal generation error:', error);
            return new Response('Internal server error', {
                status: 500,
                headers: { 'Content-Type': 'text/plain' }
            });
        }
    },

    getCalendarInfo: (db: Database) => async (req: Request, params: Record<string, string>): Promise<Response> => {
        try {
            const { hash } = params;

            // Validate hash
            if (!ValidationService.isValidHash(hash)) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Invalid hash format'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Check if user exists
            const userModel = new UserModel(db);
            const userExists = await userModel.exists(hash);
            if (!userExists) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Calendar not found'
                }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Get events
            const eventModel = new EventModel(db);
            const events = await eventModel.findByUserHash(hash);

            // Generate statistics
            const icalService = new ICalService();
            const stats = icalService.generateStats(events);

            // Calendar URLs
            const baseUrl = process.env.APP_URL || 'http://localhost:3000';
            const icalUrl = `${baseUrl}/api/ical/${hash}`;
            const webcalUrl = icalUrl.replace(/^https?:/, 'webcal:');

            return new Response(JSON.stringify({
                success: true,
                calendar: {
                    hash: hash,
                    name: `YATWA Calendar - ${hash.substring(0, 8)}`,
                    description: 'Personal calendar from YATWA',
                    urls: {
                        ical: icalUrl,
                        webcal: webcalUrl,
                        download: `${icalUrl}?download=1`
                    },
                    stats,
                    instructions: {
                        apple: `Add to iOS/macOS: Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar → ${webcalUrl}`,
                        google: `Add to Google Calendar: Settings → Add calendar → From URL → ${icalUrl}`,
                        outlook: `Add to Outlook: File → Account Settings → Internet Calendars → New → ${icalUrl}`,
                        thunderbird: `Add to Thunderbird: Events and Tasks → New Calendar → On the Network → ${icalUrl}`
                    }
                }
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error('Calendar info error:', error);
            return new Response(JSON.stringify({
                success: false,
                error: 'Internal server error'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    },

    validateFeed: (db: Database) => async (req: Request, params: Record<string, string>): Promise<Response> => {
        try {
            const { hash } = params;

            // Validate hash
            if (!ValidationService.isValidHash(hash)) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Invalid hash format'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Get events
            const eventModel = new EventModel(db);
            const events = await eventModel.findByUserHash(hash);

            // Generate and validate iCal
            const icalService = new ICalService();
            const icalContent = icalService.generateCalendar(events, hash);
            const validation = icalService.validateCalendar(icalContent);

            return new Response(JSON.stringify({
                success: true,
                validation: {
                    isValid: validation.isValid,
                    errors: validation.errors,
                    warnings: validation.warnings,
                    eventCount: events.length,
                    calendarSize: icalContent.length,
                    lineCount: icalContent.split('\n').length
                }
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error('Feed validation error:', error);
            return new Response(JSON.stringify({
                success: false,
                error: 'Internal server error'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
};