// 📅 Event routes - Full CRUD operations for calendar events
import { Database } from '../services/database';
import { EventModel, CreateEventData, UpdateEventData } from '../models/Event';
import { ValidationService } from '../utils/validation';
import { UserModel } from '../models/User';

export const eventRoutes = {
    getEvents: (db: Database) => async (req: Request, params: Record<string, string>): Promise<Response> => {
        try {
            const { hash } = params;
            const url = new URL(req.url);

            // Validate hash
            if (!ValidationService.isValidHash(hash)) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Ungültiger Hash'
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
                    error: 'Benutzer nicht gefunden'
                }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Update last accessed
            await userModel.updateLastAccessed(hash);

            // Parse query parameters
            const startDate = url.searchParams.get('start');
            const endDate = url.searchParams.get('end');
            const limit = url.searchParams.get('limit');
            const offset = url.searchParams.get('offset');
            const search = url.searchParams.get('search');

            const eventModel = new EventModel(db);
            let events;

            // Handle search
            if (search) {
                events = await eventModel.searchEvents(hash, search);
            }
            // Handle date range
            else if (startDate && endDate) {
                const dateValidation = ValidationService.validateDateRange(startDate, endDate);
                if (!dateValidation.isValid) {
                    return new Response(JSON.stringify({
                        success: false,
                        errors: dateValidation.errors
                    }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                events = await eventModel.getEventsByDateRange(hash, startDate, endDate);
            }
            // Handle pagination
            else {
                const pagination = ValidationService.validatePagination(limit || undefined, offset || undefined);
                if (pagination.errors.length > 0) {
                    return new Response(JSON.stringify({
                        success: false,
                        errors: pagination.errors
                    }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                events = await eventModel.findByUserHash(hash, {
                    limit: pagination.limit,
                    offset: pagination.offset
                });
            }

            // Get total count for pagination info
            const totalCount = await eventModel.getCountByUserHash(hash);

            return new Response(JSON.stringify({
                success: true,
                events,
                pagination: {
                    total: totalCount,
                    limit: parseInt(limit || '50'),
                    offset: parseInt(offset || '0')
                }
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error('Get events error:', error);
            return new Response(JSON.stringify({
                success: false,
                error: 'Fehler beim Laden der Termine'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    },

    createEvent: (db: Database) => async (req: Request, params: Record<string, string>): Promise<Response> => {
        try {
            const { hash } = params;

            // Validate hash
            if (!ValidationService.isValidHash(hash)) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Ungültiger Hash'
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
                    error: 'Benutzer nicht gefunden'
                }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Parse request body
            let eventData;
            try {
                eventData = await req.json();
            } catch (error) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Ungültige JSON-Daten'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Validate event data
            const validation = ValidationService.validateCreateEvent(eventData);
            if (!validation.isValid) {
                return new Response(JSON.stringify({
                    success: false,
                    errors: validation.errors
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Prepare create data
            const createData: CreateEventData = {
                user_hash: hash,
                title: ValidationService.sanitizeString(eventData.title),
                event_date: eventData.event_date,
                event_time: eventData.event_time ? ValidationService.formatTimeString(eventData.event_time) : null,
                icon: eventData.icon || '📅',
                description: eventData.description ? ValidationService.sanitizeString(eventData.description) : null
            };

            // Create event
            const eventModel = new EventModel(db);
            const createdEvent = await eventModel.create(createData);

            return new Response(JSON.stringify({
                success: true,
                event: createdEvent,
                message: 'Termin erfolgreich erstellt'
            }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error('Create event error:', error);
            return new Response(JSON.stringify({
                success: false,
                error: 'Fehler beim Erstellen des Termins'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    },

    updateEvent: (db: Database) => async (req: Request, params: Record<string, string>): Promise<Response> => {
        try {
            const { hash, id } = params;
            const eventId = parseInt(id);

            // Validate parameters
            if (!ValidationService.isValidHash(hash)) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Ungültiger Hash'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            if (isNaN(eventId) || eventId < 1) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Ungültige Event-ID'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Parse request body
            let updateData;
            try {
                updateData = await req.json();
            } catch (error) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Ungültige JSON-Daten'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Validate update data
            const validation = ValidationService.validateUpdateEvent(updateData);
            if (!validation.isValid) {
                return new Response(JSON.stringify({
                    success: false,
                    errors: validation.errors
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Prepare update data
            const eventUpdateData: UpdateEventData = {};
            if (updateData.title !== undefined) {
                eventUpdateData.title = ValidationService.sanitizeString(updateData.title);
            }
            if (updateData.event_date !== undefined) {
                eventUpdateData.event_date = updateData.event_date;
            }
            if (updateData.event_time !== undefined) {
                eventUpdateData.event_time = updateData.event_time ?
                    ValidationService.formatTimeString(updateData.event_time) : null;
            }
            if (updateData.icon !== undefined) {
                eventUpdateData.icon = updateData.icon;
            }
            if (updateData.description !== undefined) {
                eventUpdateData.description = updateData.description ?
                    ValidationService.sanitizeString(updateData.description) : null;
            }

            // Update event
            const eventModel = new EventModel(db);
            const updatedEvent = await eventModel.update(eventId, hash, eventUpdateData);

            if (!updatedEvent) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Termin nicht gefunden oder nicht berechtigt'
                }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            return new Response(JSON.stringify({
                success: true,
                event: updatedEvent,
                message: 'Termin erfolgreich aktualisiert'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error('Update event error:', error);
            return new Response(JSON.stringify({
                success: false,
                error: 'Fehler beim Aktualisieren des Termins'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    },

    deleteEvent: (db: Database) => async (req: Request, params: Record<string, string>): Promise<Response> => {
        try {
            const { hash, id } = params;
            const eventId = parseInt(id);

            // Validate parameters
            if (!ValidationService.isValidHash(hash)) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Ungültiger Hash'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            if (isNaN(eventId) || eventId < 1) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Ungültige Event-ID'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Delete event
            const eventModel = new EventModel(db);
            const deleted = await eventModel.delete(eventId, hash);

            if (!deleted) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Termin nicht gefunden oder nicht berechtigt'
                }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            return new Response(JSON.stringify({
                success: true,
                message: 'Termin erfolgreich gelöscht'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error('Delete event error:', error);
            return new Response(JSON.stringify({
                success: false,
                error: 'Fehler beim Löschen des Termins'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    },

    getUpcomingEvents: (db: Database) => async (req: Request, params: Record<string, string>): Promise<Response> => {
        try {
            const { hash } = params;
            const url = new URL(req.url);
            const days = parseInt(url.searchParams.get('days') || '30');

            if (!ValidationService.isValidHash(hash)) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Ungültiger Hash'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const eventModel = new EventModel(db);
            const events = await eventModel.getUpcomingEvents(hash, days);

            return new Response(JSON.stringify({
                success: true,
                events,
                days,
                count: events.length
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error('Get upcoming events error:', error);
            return new Response(JSON.stringify({
                success: false,
                error: 'Fehler beim Laden der anstehenden Termine'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    },

    getEventsByMonth: (db: Database) => async (req: Request, params: Record<string, string>): Promise<Response> => {
        try {
            const { hash } = params;
            const url = new URL(req.url);
            const year = url.searchParams.get('year') ? parseInt(url.searchParams.get('year')!) : undefined;

            if (!ValidationService.isValidHash(hash)) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Ungültiger Hash'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const eventModel = new EventModel(db);
            const eventsByMonth = await eventModel.getEventsByMonth(hash, year);

            return new Response(JSON.stringify({
                success: true,
                eventsByMonth,
                year: year || 'all'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error('Get events by month error:', error);
            return new Response(JSON.stringify({
                success: false,
                error: 'Fehler beim Laden der monatlichen Termine'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    },

    getAvailableIcons: (db: Database) => async (req: Request, params: Record<string, string>): Promise<Response> => {
        const icons = [
            '📅', '🗓️', '⏰', '🔔', '📝', '💼', '🏠', '🚗', '✈️', '🎉',
            '🍽️', '💊', '🏥', '🎓', '💪', '🛒', '📞', '💻', '🎵', '📚',
            '🧹', '🗑️', '♻️', '🚮', '🏃', '🎯', '💡', '⭐', '❤️', '🎁'
        ];

        return new Response(JSON.stringify({
            success: true,
            icons
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};