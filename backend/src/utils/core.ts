// 🌍 Secure CORS Configuration for YATWA API

interface CorsConfig {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    maxAge: string;
    credentials: boolean;
}

// Development CORS - weniger restriktiv für lokale Entwicklung
const developmentConfig: CorsConfig = {
    allowedOrigins: ['*'], // Wildcard nur in Development
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: '86400',
    credentials: false
};

// Production CORS - strenge Origin-Validierung
const productionConfig: CorsConfig = {
    allowedOrigins: [
        process.env.FRONTEND_URL || '',
        process.env.FRONTEND_URL_WWW || '',
        //'https://yourdomain.com',
        //'https://www.yourdomain.com'
    ].filter(Boolean), // Entfernt leere Strings
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: '86400',
    credentials: true
};

// Sichere CORS-Validierung
export function validateCorsOrigin(request: Request): string | null {
    const isProduction = process.env.NODE_ENV === 'production';
    const origin = request.headers.get('Origin');

    // Development: Alle Origins erlaubt
    if (!isProduction) {
        return origin || '*';
    }

    // Production: Strenge Validierung
    if (!origin) {
        // Requests ohne Origin (z.B. same-origin) erlauben
        return null;
    }

    const config = productionConfig;

    // Exakte Origin-Prüfung
    if (config.allowedOrigins.includes(origin)) {
        return origin;
    }

    // Subdomain-Validierung (optional)
    const allowSubdomains = process.env.ALLOW_SUBDOMAINS === 'true';
    if (allowSubdomains) {
        const mainDomains = config.allowedOrigins
            .filter(o => o.startsWith('https://'))
            .map(o => o.replace('https://www.', '').replace('https://', ''));

        const requestDomain = origin.replace('https://www.', '').replace('https://', '');

        if (mainDomains.some(domain => requestDomain.endsWith(`.${domain}`) || requestDomain === domain)) {
            return origin;
        }
    }

    // Origin nicht erlaubt
    console.warn(`🚫 CORS blocked: ${origin} not in allowed origins:`, config.allowedOrigins);
    return false as any; // Explizit blockiert
}

// Sichere CORS-Header generieren
export function getCorsHeaders(request: Request): Record<string, string> {
    const isProduction = process.env.NODE_ENV === 'production';
    const config = isProduction ? productionConfig : developmentConfig;
    const validOrigin = validateCorsOrigin(request);

    // Origin blockiert
    if (validOrigin === false) {
        return {};
    }

    const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': config.allowedMethods.join(', '),
        'Access-Control-Allow-Headers': config.allowedHeaders.join(', '),
        'Access-Control-Max-Age': config.maxAge,
        'Vary': 'Origin'
    };

    // Origin setzen
    if (validOrigin === '*') {
        headers['Access-Control-Allow-Origin'] = '*';
    } else if (validOrigin) {
        headers['Access-Control-Allow-Origin'] = validOrigin;
    }

    // Credentials nur in Production mit spezifischer Origin
    if (config.credentials && validOrigin && validOrigin !== '*') {
        headers['Access-Control-Allow-Credentials'] = 'true';
    }

    return headers;
}

// Sichere CORS-Response für Preflight
export function handleCors(request: Request): Response {
    const validOrigin = validateCorsOrigin(request);

    // Origin explizit blockiert
    if (validOrigin === false) {
        return new Response('CORS policy violation', {
            status: 403,
            headers: {
                'Content-Type': 'text/plain'
            }
        });
    }

    const headers = getCorsHeaders(request);

    return new Response(null, {
        status: 204,
        headers
    });
}

// Utility: Sichere CORS-Headers zu Response hinzufügen
export function addCorsHeaders(response: Response, request: Request): Response {
    const validOrigin = validateCorsOrigin(request);

    // Origin blockiert - Response nicht modifizieren
    if (validOrigin === false) {
        return response;
    }

    const corsHeaders = getCorsHeaders(request);
    const headers = new Headers(response.headers);

    Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
    });

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}

// Security Middleware für alle API-Requests
export function securityMiddleware(request: Request, handler: (req: Request) => Response | Promise<Response>) {
    return async (): Promise<Response> => {
        try {
            // 1. CORS Preflight Check
            if (request.method === 'OPTIONS') {
                return handleCors(request);
            }

            // 2. Origin Validation für alle Requests
            const validOrigin = validateCorsOrigin(request);
            if (validOrigin === false) {
                return new Response('Forbidden: Invalid origin', {
                    status: 403,
                    headers: { 'Content-Type': 'text/plain' }
                });
            }

            // 3. Rate Limiting Check (optional)
            const rateLimitResult = checkRateLimit(request);
            if (!rateLimitResult.allowed) {
                return new Response('Too Many Requests', {
                    status: 429,
                    headers: {
                        'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
                        'Content-Type': 'text/plain'
                    }
                });
            }

            // 4. Request verarbeiten
            const response = await handler(request);

            // 5. Sichere CORS-Headers hinzufügen
            return addCorsHeaders(response, request);

        } catch (error) {
            console.error('🚨 Security middleware error:', error);
            return new Response('Internal Server Error', {
                status: 500,
                headers: { 'Content-Type': 'text/plain' }
            });
        }
    };
}

// Rate Limiting (einfache Implementation)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(request: Request): { allowed: boolean; retryAfter?: number } {
    const isProduction = process.env.NODE_ENV === 'production';

    // Rate limiting nur in Production
    if (!isProduction) {
        return { allowed: true };
    }

    const ip = request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Forwarded-For') ||
        'unknown';

    const now = Date.now();
    const windowMs = 60 * 1000; // 1 Minute
    const maxRequests = 100; // 100 Requests pro Minute

    const key = `rate_limit:${ip}`;
    const current = rateLimitStore.get(key);

    if (!current || now > current.resetTime) {
        // Neues Fenster
        rateLimitStore.set(key, {
            count: 1,
            resetTime: now + windowMs
        });
        return { allowed: true };
    }

    if (current.count >= maxRequests) {
        const retryAfter = Math.ceil((current.resetTime - now) / 1000);
        return { allowed: false, retryAfter };
    }

    // Request count erhöhen
    current.count++;
    rateLimitStore.set(key, current);

    return { allowed: true };
}

// Debug & Monitoring
export function debugCorsConfig(request?: Request) {
    const config = {
        environment: process.env.NODE_ENV || 'development',
        isProduction: process.env.NODE_ENV === 'production',
        frontendUrl: process.env.FRONTEND_URL,
        allowSubdomains: process.env.ALLOW_SUBDOMAINS === 'true'
    };

    if (request) {
        const origin = request.headers.get('Origin');
        const validOrigin = validateCorsOrigin(request);

        console.log('🔧 CORS Debug:', {
            ...config,
            requestOrigin: origin,
            validOrigin,
            corsHeaders: getCorsHeaders(request)
        });
    } else {
        console.log('🔧 CORS Configuration:', config);
    }
}