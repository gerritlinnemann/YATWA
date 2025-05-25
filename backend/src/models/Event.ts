// 📅 Event Model - Database operations for calendar events
import { Database } from '../services/database';

export interface Event {
    id: number;
    user_hash: string;
    title: string;
    event_date: string; // YYYY-MM-DD format
    event_time: string | null; // HH:MM:SS format or null for all-day
    icon: string;
    description: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateEventData {
    user_hash: string;
    title: string;
    event_date: string;
    event_time?: string | null;
    icon?: string;
    description?: string | null;
}

export interface UpdateEventData {
    title?: string;
    event_date?: string;
    event_time?: string | null;
    icon?: string;
    description?: string | null;
}

export interface EventFilter {
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
}

export class EventModel {
    constructor(private db: Database) {}

    /**
     * Create a new event
     */
    async create(eventData: CreateEventData): Promise<Event> {
        const sql = `
      INSERT INTO events (user_hash, title, event_date, event_time, icon, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

        const params = [
            eventData.user_hash,
            eventData.title,
            eventData.event_date,
            eventData.event_time || null,
            eventData.icon || 'calendar',
            eventData.description || null
        ];

        const result = await this.db.insert(sql, params);

        // Return the created event
        const createdEvent = await this.findById(result.insertId);
        if (!createdEvent) {
            throw new Error('Failed to create event');
        }

        return createdEvent;
    }

    /**
     * Find event by ID and user hash (security check)
     */
    async findById(id: number, userHash?: string): Promise<Event | null> {
        let sql = `
      SELECT id, user_hash, title, event_date, event_time, icon, description, created_at, updated_at
      FROM events
      WHERE id = ?
    `;

        const params = [id];

        if (userHash) {
            sql += ` AND user_hash = ?`;
            params.push(userHash);
        }

        return await this.db.queryOne<Event>(sql, params);
    }

    /**
     * Get all events for a user with optional filtering
     */
    async findByUserHash(userHash: string, filter: EventFilter = {}): Promise<Event[]> {
        let sql = `
      SELECT id, user_hash, title, event_date, event_time, icon, description, created_at, updated_at
      FROM events
      WHERE user_hash = ?
    `;

        const params: any[] = [userHash];

        // Add date filtering
        if (filter.startDate) {
            sql += ` AND event_date >= ?`;
            params.push(filter.startDate);
        }

        if (filter.endDate) {
            sql += ` AND event_date <= ?`;
            params.push(filter.endDate);
        }

        // Order by date and time
        sql += ` ORDER BY event_date ASC, event_time ASC`;

        // Add pagination
        if (filter.limit) {
            sql += ` LIMIT ?`;
            params.push(filter.limit);

            if (filter.offset) {
                sql += ` OFFSET ?`;
                params.push(filter.offset);
            }
        }

        return await this.db.query<Event>(sql, params);
    }

    /**
     * Update an event
     */
    async update(id: number, userHash: string, updateData: UpdateEventData): Promise<Event | null> {
        const setClauses: string[] = [];
        const params: any[] = [];

        // Build dynamic update query
        if (updateData.title !== undefined) {
            setClauses.push('title = ?');
            params.push(updateData.title);
        }

        if (updateData.event_date !== undefined) {
            setClauses.push('event_date = ?');
            params.push(updateData.event_date);
        }

        if (updateData.event_time !== undefined) {
            setClauses.push('event_time = ?');
            params.push(updateData.event_time);
        }

        if (updateData.icon !== undefined) {
            setClauses.push('icon = ?');
            params.push(updateData.icon);
        }

        if (updateData.description !== undefined) {
            setClauses.push('description = ?');
            params.push(updateData.description);
        }

        if (setClauses.length === 0) {
            throw new Error('No update data provided');
        }

        // Always update the updated_at timestamp
        setClauses.push('updated_at = NOW()');

        const sql = `
      UPDATE events
      SET ${setClauses.join(', ')}
      WHERE id = ? AND user_hash = ?
    `;

        params.push(id, userHash);

        const affectedRows = await this.db.update(sql, params);

        if (affectedRows === 0) {
            return null; // Event not found or not owned by user
        }

        // Return updated event
        return await this.findById(id, userHash);
    }

    /**
     * Delete an event
     */
    async delete(id: number, userHash: string): Promise<boolean> {
        const sql = `
      DELETE FROM events
      WHERE id = ? AND user_hash = ?
    `;

        const affectedRows = await this.db.delete(sql, [id, userHash]);
        return affectedRows > 0;
    }

    /**
     * Get events count for a user
     */
    async getCountByUserHash(userHash: string): Promise<number> {
        const sql = `
      SELECT COUNT(*) as count
      FROM events
      WHERE user_hash = ?
    `;

        const result = await this.db.queryOne<{ count: number }>(sql, [userHash]);
        return result?.count || 0;
    }

    /**
     * Get upcoming events for a user (next 30 days)
     */
    async getUpcomingEvents(userHash: string, days: number = 30): Promise<Event[]> {
        const sql = `
      SELECT id, user_hash, title, event_date, event_time, icon, description, created_at, updated_at
      FROM events
      WHERE user_hash = ?
        AND event_date >= CURDATE()
        AND event_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY event_date ASC, event_time ASC
    `;

        return await this.db.query<Event>(sql, [userHash, days]);
    }

    /**
     * Get events by date range (for calendar view)
     */
    async getEventsByDateRange(userHash: string, startDate: string, endDate: string): Promise<Event[]> {
        const sql = `
      SELECT id, user_hash, title, event_date, event_time, icon, description, created_at, updated_at
      FROM events
      WHERE user_hash = ?
        AND event_date >= ?
        AND event_date <= ?
      ORDER BY event_date ASC, event_time ASC
    `;

        return await this.db.query<Event>(sql, [userHash, startDate, endDate]);
    }

    /**
     * Search events by title or description
     */
    async searchEvents(userHash: string, searchTerm: string): Promise<Event[]> {
        const sql = `
      SELECT id, user_hash, title, event_date, event_time, icon, description, created_at, updated_at
      FROM events
      WHERE user_hash = ?
        AND (title LIKE ? OR description LIKE ?)
      ORDER BY event_date ASC, event_time ASC
    `;

        const searchPattern = `%${searchTerm}%`;
        return await this.db.query<Event>(sql, [userHash, searchPattern, searchPattern]);
    }

    /**
     * Get events grouped by month (for statistics)
     */
    async getEventsByMonth(userHash: string, year?: number): Promise<Array<{
        year: number;
        month: number;
        count: number;
        events: Event[];
    }>> {
        let sql = `
      SELECT id, user_hash, title, event_date, event_time, icon, description, created_at, updated_at,
             YEAR(event_date) as year, MONTH(event_date) as month
      FROM events
      WHERE user_hash = ?
    `;

        const params: any[] = [userHash];

        if (year) {
            sql += ` AND YEAR(event_date) = ?`;
            params.push(year);
        }

        sql += ` ORDER BY event_date ASC`;

        const events = await this.db.query<Event & { year: number; month: number }>(sql, params);

        // Group by year and month
        const grouped = new Map<string, { year: number; month: number; count: number; events: Event[] }>();

        events.forEach(event => {
            const key = `${event.year}-${event.month}`;
            if (!grouped.has(key)) {
                grouped.set(key, {
                    year: event.year,
                    month: event.month,
                    count: 0,
                    events: []
                });
            }

            const group = grouped.get(key)!;
            group.count++;
            group.events.push({
                id: event.id,
                user_hash: event.user_hash,
                title: event.title,
                event_date: event.event_date,
                event_time: event.event_time,
                icon: event.icon,
                description: event.description,
                created_at: event.created_at,
                updated_at: event.updated_at
            });
        });

        return Array.from(grouped.values()).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
        });
    }

    /**
     * Delete all events for a user (cleanup function)
     */
    async deleteAllByUserHash(userHash: string): Promise<number> {
        const sql = `DELETE FROM events WHERE user_hash = ?`;
        return await this.db.delete(sql, [userHash]);
    }
}