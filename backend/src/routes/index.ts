// 🛣️ YATWA Router - Modern request routing system
import { Database } from '../services/database';
import { authRoutes } from './auth';
import { eventRoutes } from './events';
import { icalRoutes } from './ical';

export interface Route {
    method: string;
    path: string;
    handler: (req: Request, params: Record<string, string>) => Promise<Response>;
}

export class Router {
    private routes: Route[] = [];

    constructor(private db: Database) {
        this.setupRoutes();
    }

    private setupRoutes() {
        // 🔐 Authentication routes
        this.addRoute('POST', '/api/register', authRoutes.register(this.db));
        this.addRoute('POST', '/api/verify', authRoutes.verify(this.db));
        this.addRoute('GET', '/api/verify', authRoutes.verify(this.db)); // Also allow GET for verification
        this.addRoute('GET', '/api/email-status', authRoutes.emailStatus(this.db));

        // 📅 Event routes - Main CRUD
        this.addRoute('GET', '/api/events/:hash', eventRoutes.getEvents(this.db));
        this.addRoute('POST', '/api/events/:hash', eventRoutes.createEvent(this.db));
        this.addRoute('PUT', '/api/events/:hash/:id', eventRoutes.updateEvent(this.db));
        this.addRoute('DELETE', '/api/events/:hash/:id', eventRoutes.deleteEvent(this.db));

        // 📅 Additional event endpoints
        this.addRoute('GET', '/api/events/:hash/upcoming', eventRoutes.getUpcomingEvents(this.db));
        this.addRoute('GET', '/api/events/:hash/by-month', eventRoutes.getEventsByMonth(this.db));
        this.addRoute('GET', '/api/icons', eventRoutes.getAvailableIcons(this.db));

        // 📊 iCal routes
        this.addRoute('GET', '/api/ical/:hash', icalRoutes.generateFeed(this.db));
        this.addRoute('GET', '/api/ical/:hash/info', icalRoutes.getCalendarInfo(this.db));
        this.addRoute('GET', '/api/ical/:hash/validate', icalRoutes.validateFeed(this.db));

        // 🏥 Health check
        this.addRoute('GET', '/api/health', this.healthCheck.bind(this));

        // 📋 API info
        this.addRoute('GET', '/api', this.apiInfo.bind(this));
    }

    private addRoute(method: string, path: string, handler: Route['handler']) {
        this.routes.push({ method, path, handler });
    }

    async handle(req: Request, url: URL): Promise<Response> {
        const method = req.method;
        const pathname = url.pathname;

        // Find matching route
        for (const route of this.routes) {
            if (route.method !== method) continue;

            const params = this.matchPath(route.path, pathname);
            if (params !== null) {
                return await route.handler(req, params);
            }
        }

        // 404 - Route not found
        return new Response(
            JSON.stringify({
                error: 'Route nicht gefunden',
                path: pathname,
                method: method,
                available: this.getAvailableRoutes()
            }),
            {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }

    private matchPath(routePath: string, requestPath: string): Record<string, string> | null {
        const routeParts = routePath.split('/');
        const requestParts = requestPath.split('/');

        if (routeParts.length !== requestParts.length) {
            return null;
        }

        const params: Record<string, string> = {};

        for (let i = 0; i < routeParts.length; i++) {
            const routePart = routeParts[i];
            const requestPart = requestParts[i];

            if (routePart.startsWith(':')) {
                // Parameter (e.g., :hash, :id)
                const paramName = routePart.slice(1);
                params[paramName] = requestPart;
            } else if (routePart !== requestPart) {
                // Static path doesn't match
                return null;
            }
        }

        return params;
    }

    private async healthCheck(): Promise<Response> {
        const isDbConnected = this.db.isConnected();
        const status = isDbConnected ? 200 : 503;

        return new Response(
            JSON.stringify({
                status: isDbConnected ? 'OK' : 'ERROR',
                message: 'YATWA Backend API',
                timestamp: new Date().toISOString(),
                database: isDbConnected ? 'Connected' : 'Disconnected',
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'development'
            }),
            {
                status,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }

    private async apiInfo(): Promise<Response> {
        return new Response(
            JSON.stringify({
                name: 'YATWA API',
                description: 'Yet Another Trash Web App - Calendar API',
                version: '1.0.0',
                endpoints: this.getAvailableRoutes(),
                documentation: {
                    auth: {
                        register: 'POST /api/register - Create new user hash',
                        verify: 'GET/POST /api/verify - Verify user hash',
                        emailStatus: 'GET /api/email-status - Check email service status'
                    },
                    events: {
                        list: 'GET /api/events/:hash - Get all events (with filtering)',
                        create: 'POST /api/events/:hash - Create new event',
                        update: 'PUT /api/events/:hash/:id - Update event',
                        delete: 'DELETE /api/events/:hash/:id - Delete event',
                        upcoming: 'GET /api/events/:hash/upcoming - Get upcoming events',
                        byMonth: 'GET /api/events/:hash/by-month - Get events grouped by month',
                        search: 'GET /api/events/:hash?search=term - Search events'
                    },
                    ical: {
                        feed: 'GET /api/ical/:hash - Generate iCal feed for calendar subscription'
                    },
                    misc: {
                        icons: 'GET /api/icons - Get available event icons',
                        health: 'GET /api/health - Health check',
                        info: 'GET /api - This endpoint'
                    }
                }
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }

    private getAvailableRoutes(): Array<{method: string, path: string}> {
        return this.routes.map(route => ({
            method: route.method,
            path: route.path
        }));
    }
}

// Factory function to create router
export function createRouter(db: Database): Router {
    return new Router(db);
}