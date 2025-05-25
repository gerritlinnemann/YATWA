// 🗄️ Database Service - MariaDB Connection with Connection Pooling
import mysql from 'mysql2/promise';

export interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    connectionLimit: number;
    acquireTimeout: number;
    timeout: number;
}

export class Database {
    private pool: mysql.Pool | null = null;
    private config: DatabaseConfig;

    constructor() {
        this.config = {
            host: process.env.DATABASE_HOST || 'mariadb',
            port: parseInt(process.env.DATABASE_PORT || '3306'),
            database: process.env.DATABASE_NAME || 'yatwa',
            user: process.env.DATABASE_USER || 'yatwa_user',
            password: process.env.DATABASE_PASSWORD || 'yatwa_secret',
            connectionLimit: 10,
            acquireTimeout: 60000,
            timeout: 60000
        };

        this.connect();
    }

    private async connect(): Promise<void> {
        try {
            this.pool = mysql.createPool({
                host: this.config.host,
                port: this.config.port,
                database: this.config.database,
                user: this.config.user,
                password: this.config.password,
                connectionLimit: this.config.connectionLimit,
                acquireTimeout: this.config.acquireTimeout,
                timeout: this.config.timeout,
                charset: 'utf8mb4',
                timezone: '+00:00',
                dateStrings: false,
                // Reconnection settings
                reconnect: true,
                idleTimeout: 300000, // 5 minutes
                // Security settings
                ssl: false, // Set to true in production with proper certificates
            });

            // Test connection
            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();

            console.log('✅ Database connected successfully');
        } catch (error) {
            console.error('❌ Database connection failed:', error);
            throw error;
        }
    }

    async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
        if (!this.pool) {
            throw new Error('Database nicht verbunden');
        }

        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows as T[];
        } catch (error) {
            console.error('❌ Database query error:', error);
            console.error('SQL:', sql);
            console.error('Params:', params);
            throw error;
        }
    }

    async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
        const results = await this.query<T>(sql, params);
        return results.length > 0 ? results[0] : null;
    }

    async insert(sql: string, params?: any[]): Promise<{ insertId: number; affectedRows: number }> {
        if (!this.pool) {
            throw new Error('Database nicht verbunden');
        }

        try {
            const [result] = await this.pool.execute(sql, params);
            const insertResult = result as mysql.ResultSetHeader;

            return {
                insertId: insertResult.insertId,
                affectedRows: insertResult.affectedRows
            };
        } catch (error) {
            console.error('❌ Database insert error:', error);
            console.error('SQL:', sql);
            console.error('Params:', params);
            throw error;
        }
    }

    async update(sql: string, params?: any[]): Promise<number> {
        if (!this.pool) {
            throw new Error('Database nicht verbunden');
        }

        try {
            const [result] = await this.pool.execute(sql, params);
            const updateResult = result as mysql.ResultSetHeader;
            return updateResult.affectedRows;
        } catch (error) {
            console.error('❌ Database update error:', error);
            console.error('SQL:', sql);
            console.error('Params:', params);
            throw error;
        }
    }

    async delete(sql: string, params?: any[]): Promise<number> {
        return this.update(sql, params); // Same implementation as update
    }

    async transaction<T>(callback: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
        if (!this.pool) {
            throw new Error('Database nicht verbunden');
        }

        const connection = await this.pool.getConnection();
        await connection.beginTransaction();

        try {
            const result = await callback(connection);
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    isConnected(): boolean {
        return this.pool !== null;
    }

    async disconnect(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            console.log('✅ Database disconnected');
        }
    }

    // Utility method for health checks
    async ping(): Promise<boolean> {
        try {
            if (!this.pool) return false;

            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();
            return true;
        } catch (error) {
            console.error('Database ping failed:', error);
            return false;
        }
    }

    // Get database statistics
    async getStats(): Promise<{
        totalConnections: number;
        activeConnections: number;
        idleConnections: number;
    }> {
        if (!this.pool) {
            return { totalConnections: 0, activeConnections: 0, idleConnections: 0 };
        }

        // Note: These are private properties, might not work in all mysql2 versions
        const poolInfo = this.pool as any;

        return {
            totalConnections: poolInfo._allConnections?.length || 0,
            activeConnections: poolInfo._acquiringConnections?.length || 0,
            idleConnections: poolInfo._freeConnections?.length || 0
        };
    }
}