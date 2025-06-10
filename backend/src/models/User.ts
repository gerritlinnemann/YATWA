// 👤 User Model - Database operations for users
import { Database } from '../services/database';

export interface User {
    id: number;
    hash: string;
    created_at: Date;
    last_accessed: Date;
}

export interface CreateUserData {
    hash: string;
}

export class UserModel {
    constructor(private db: Database) {}

    /**
     * Create a new user with hash
     */
    async create(userData: CreateUserData): Promise<User> {
        const sql = `
          INSERT INTO users (hash, created_at, last_accessed)
          VALUES (?, NOW(), NOW())
        `;

        const result = await this.db.insert(sql, [userData.hash]);

        // Return the created user
        const createdUser = await this.findByHash(userData.hash);
        if (!createdUser) {
            throw new Error('Failed to create user');
        }

        return createdUser;
    }

    /**
     * Find user by hash
     */
    async findByHash(hash: string): Promise<User | null> {
        const sql = `
          SELECT id, hash, created_at, last_accessed
          FROM users
          WHERE hash = ?
        `;

        return await this.db.queryOne<User>(sql, [hash]);
    }

    /**
     * Check if hash exists
     */
    async exists(hash: string): Promise<boolean> {
        const sql = `
          SELECT COUNT(*) as count
          FROM users
          WHERE hash = ?
        `;

        const result = await this.db.queryOne<{ count: number }>(sql, [hash]);
        return (result?.count || 0) > 0;
    }

    /**
     * Update last accessed timestamp
     */
    async updateLastAccessed(hash: string): Promise<boolean> {
        const sql = `
          UPDATE users
          SET last_accessed = NOW()
          WHERE hash = ?
        `;

        const affectedRows = await this.db.update(sql, [hash]);
        return affectedRows > 0;
    }

    /**
     * Get user statistics
     */
    async getStats(hash: string): Promise<{
        user: User;
        eventCount: number;
        daysSinceCreated: number;
        daysSinceLastAccess: number;
    } | null> {
        const user = await this.findByHash(hash);
        if (!user) return null;

        // Get event count
        const eventCountSql = `
          SELECT COUNT(*) as count
          FROM events
          WHERE user_hash = ?
        `;
        const eventResult = await this.db.queryOne<{ count: number }>(eventCountSql, [hash]);
        const eventCount = eventResult?.count || 0;

        // Calculate days
        const now = new Date();
        const daysSinceCreated = Math.floor((now.getTime() - user.created_at.getTime()) / (1000 * 60 * 60 * 24));
        const daysSinceLastAccess = Math.floor((now.getTime() - user.last_accessed.getTime()) / (1000 * 60 * 60 * 24));

        return {
            user,
            eventCount,
            daysSinceCreated,
            daysSinceLastAccess
        };
    }

    /**
     * Get all users (admin function - be careful with this!)
     */
    async getAll(limit: number = 100): Promise<User[]> {
        const sql = `
          SELECT id, hash, created_at, last_accessed
          FROM users
          ORDER BY created_at DESC
          LIMIT ?
        `;

        return await this.db.query<User>(sql, [limit]);
    }

    /**
     * Delete user and all associated events
     */
    async deleteUser(hash: string): Promise<boolean> {
        return await this.db.transaction(async (connection) => {
            // Delete events first (foreign key constraint)
            const deleteEventsSql = `DELETE FROM events WHERE user_hash = ?`;
            await connection.execute(deleteEventsSql, [hash]);

            // Delete user
            const deleteUserSql = `DELETE FROM users WHERE hash = ?`;
            const [result] = await connection.execute(deleteUserSql, [hash]);

            const deleteResult = result as any;
            return deleteResult.affectedRows > 0;
        });
    }

    /**
     * Cleanup old inactive users (for maintenance).
     * Default 2 years.
     */
    async cleanupInactiveUsers(daysInactive: number = 730): Promise<number> {
        const sql = `
          DELETE FROM users
          WHERE last_accessed < DATE_SUB(NOW(), INTERVAL ? DAY)
        `;

        const affectedRows = await this.db.delete(sql, [daysInactive]);
        console.log(`🧹 Cleaned up ${affectedRows} inactive users (older than ${daysInactive} days)`);

        return affectedRows;
    }

    /**
     * Get user activity summary
     */
    async getActivitySummary(): Promise<{
        totalUsers: number;
        activeToday: number;
        activeThisWeek: number;
        activeThisMonth: number;
    }> {
        const sql = `
          SELECT 
            COUNT(*) as totalUsers,
            COUNT(CASE WHEN last_accessed >= CURDATE() THEN 1 END) as activeToday,
            COUNT(CASE WHEN last_accessed >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as activeThisWeek,
            COUNT(CASE WHEN last_accessed >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as activeThisMonth
          FROM users
        `;

        const result = await this.db.queryOne<{
            totalUsers: number;
            activeToday: number;
            activeThisWeek: number;
            activeThisMonth: number;
        }>(sql);

        return result || {
            totalUsers: 0,
            activeToday: 0,
            activeThisWeek: 0,
            activeThisMonth: 0
        };
    }
}