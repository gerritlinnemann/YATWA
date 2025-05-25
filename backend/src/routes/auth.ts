// 🔐 Authentication routes - Hash-based registration and verification
import { Database } from '../services/database';
import { HashService } from '../services/hash';
import { SimpleEmailService as EmailService } from '../services/email-simple';
import { UserModel } from '../models/User';

const hashService = new HashService();
const emailService = new EmailService();

export const authRoutes = {
    register: (db: Database) => async (req: Request, params: Record<string, string>): Promise<Response> => {
        try {
            const userModel = new UserModel(db);

            // Parse request body
            let requestData: { email?: string } = {};

            if (req.method === 'POST') {
                try {
                    const body = await req.text();
                    if (body) {
                        requestData = JSON.parse(body);
                    }
                } catch (error) {
                    // If no body or invalid JSON, continue with empty data
                }
            }

            // Generate unique hash
            const hash = await hashService.generateUniqueHash(async (hash: string) => {
                return await userModel.exists(hash);
            });

            // Create user in database
            const user = await userModel.create({ hash });

            // Prepare response data
            const responseData = {
                success: true,
                hash: user.hash,
                created: user.created_at,
                link: `${process.env.APP_URL || 'http://localhost'}?hash=${user.hash}`,
                message: 'Hash erfolgreich erstellt'
            };

            // Send email if provided
            if (requestData.email && typeof requestData.email === 'string') {
                const emailSent = await emailService.sendHashLink({
                    to: requestData.email,
                    hash: user.hash,
                    appUrl: process.env.APP_URL || 'http://localhost'
                });

                responseData.emailSent = emailSent;
                if (emailSent) {
                    responseData.message += ' und E-Mail versendet';
                } else {
                    responseData.message += ' (E-Mail-Versand nicht verfügbar)';
                }
            }

            return new Response(JSON.stringify(responseData), {
                status: 201,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error('Registration error:', error);

            return new Response(JSON.stringify({
                success: false,
                error: 'Fehler bei der Registrierung',
                message: error instanceof Error ? error.message : 'Unbekannter Fehler'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    },

    verify: (db: Database) => async (req: Request, params: Record<string, string>): Promise<Response> => {
        try {
            // Get hash from query parameters or request body
            const url = new URL(req.url);
            let hash = url.searchParams.get('hash');

            if (!hash && req.method === 'POST') {
                try {
                    const body = await req.json();
                    hash = body.hash;
                } catch (error) {
                    // Continue without body data
                }
            }

            if (!hash) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Hash fehlt',
                    message: 'Bitte geben Sie einen Hash an'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Validate hash format
            if (!hashService.isValidHashFormat(hash)) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Ungültiges Hash-Format',
                    message: 'Der Hash hat ein ungültiges Format'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const userModel = new UserModel(db);

            // Check if user exists and get stats
            const userStats = await userModel.getStats(hash);

            if (!userStats) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Hash nicht gefunden',
                    message: 'Dieser Hash existiert nicht'
                }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Update last accessed timestamp
            await userModel.updateLastAccessed(hash);

            // Return user info and stats
            return new Response(JSON.stringify({
                success: true,
                hash: hash,
                user: {
                    created: userStats.user.created_at,
                    lastAccessed: userStats.user.last_accessed,
                    daysSinceCreated: userStats.daysSinceCreated,
                    eventCount: userStats.eventCount
                },
                message: 'Hash erfolgreich verifiziert'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error('Verification error:', error);

            return new Response(JSON.stringify({
                success: false,
                error: 'Fehler bei der Verifizierung',
                message: error instanceof Error ? error.message : 'Unbekannter Fehler'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    },

    // Additional endpoint to get email service status
    emailStatus: (db: Database) => async (req: Request, params: Record<string, string>): Promise<Response> => {
        const status = emailService.getStatus();

        return new Response(JSON.stringify({
            emailService: status,
            canSendEmails: status.configured
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};