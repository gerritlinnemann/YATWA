// 🚀 YATWA Backend - Complete Server with Hash System
import { Database } from './services/database';
import { createRouter } from './routes';
import { corsHeaders } from './utils/core';

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize database and router
const db = new Database();
const router = createRouter(db);

// 🎯 Bun server
const server = Bun.serve({
    port: PORT,
    async fetch(req: Request): Promise<Response> {
        const url = new URL(req.url);

        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        try {
            // Route the request
            const response = await router.handle(req, url);

            // Add CORS headers
            const headers = new Headers(response.headers);
            Object.entries(corsHeaders).forEach(([key, value]) => {
                headers.set(key, value);
            });

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers
            });

        } catch (error) {
            console.error('❌ Server error:', error);

            return new Response(JSON.stringify({
                error: 'Interner Serverfehler',
                message: NODE_ENV === 'development' ? error.message : undefined
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    },
});

console.log(`
🚀 YATWA Backend started!
📍 Port: ${server.port}
🌍 Environment: ${NODE_ENV}
🗄️  Database: ${db.isConnected() ? '✅ Connected' : '❌ Disconnected'}
🎯 Health Check: http://localhost:${server.port}/api/health
📋 Registration: http://localhost:${server.port}/api/register
🔐 Verification: http://localhost:${server.port}/api/verify
`);

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down YATWA Backend...');
    await db.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    await db.disconnect();
    process.exit(0);
});