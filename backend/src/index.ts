// 🚀 YATWA Backend - Complete Server with Secure CORS & Hash System
import { Database } from './services/database';
import { createRouter } from './routes';
import { securityMiddleware, debugCorsConfig } from './utils/core';

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize database and router
const db = new Database();
const router = createRouter(db);

// Debug CORS configuration on startup
debugCorsConfig();

// 🎯 Bun server with Security Middleware
const server = Bun.serve({
    port: PORT,
    async fetch(req: Request): Promise<Response> {
        const url = new URL(req.url);

        // Security Middleware handles everything: CORS, Rate Limiting, Origin Validation
        return securityMiddleware(req, async (request) => {
            try {
                // Route the request
                const response = await router.handle(request, url);
                return response;

            } catch (error) {
                console.error('❌ Server error:', error);

                return new Response(JSON.stringify({
                    error: 'Interner Serverfehler',
                    message: NODE_ENV === 'development' ? error.message : undefined
                }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        })();
    },
});

console.log(`
🚀 YATWA Backend started!
📍 Port: ${server.port}
🌍 Environment: ${NODE_ENV}
🔒 CORS Mode: ${NODE_ENV === 'production' ? 'Production (Secure)' : 'Development (Open)'}
🗄️ Database: ${db.isConnected() ? '✅ Connected' : '❌ Disconnected'}
🎯 Health Check: http://localhost:${server.port}/api/health
📋 Registration: http://localhost:${server.port}/api/register
🔐 Verification: http://localhost:${server.port}/api/verify?hash={HASH}
`);

// Development: Zeige CORS-Info
if (NODE_ENV === 'development') {
    console.log(`
📋 CORS Configuration:
   • Origin: * (alle erlaubt)
   • Credentials: false
   • Methods: GET, POST, PUT, DELETE, OPTIONS
   
🔒 Production wird strenge Origin-Validierung verwenden
`);
} else {
    console.log(`
🔒 Production CORS Configuration:
   • Allowed Origins: ${process.env.FRONTEND_URL || 'ENV not set'}
   • Credentials: true
   • Rate Limiting: Active (100 req/min)
`);
}

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