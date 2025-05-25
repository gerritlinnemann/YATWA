// 🌍 CORS Configuration for YATWA API
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Vary': 'Origin'
};

export function handleCors(): Response {
    return new Response(null, {
        status: 204,
        headers: corsHeaders
    });
}

// For production, you might want to restrict origins:
export const productionCorsHeaders = {
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:80',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
};