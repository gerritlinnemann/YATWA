// 📧 Email Service
import nodemailer from 'nodemailer';

export interface EmailConfig {
    host: string;
    port: number;
    secure: boolean;
    auth: {
        user: string;
        pass: string;
    };
}

export interface SendLinkOptions {
    to: string;
    hash: string;
    appUrl: string;
}

export class EmailService {
    private transporter: nodemailer.Transporter | null = null;
    private config: EmailConfig;
    private isConfigured: boolean = false;

    constructor() {
        this.config = {
            host: process.env.SMTP_HOST || '',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER || '',
                pass: process.env.SMTP_PASS || ''
            }
        };

        this.initializeTransporter();
    }

// 📧 Email Service - Send hash links to users
    import nodemailer from 'nodemailer';

    export interface EmailConfig {
    host: string;
    port: number;
    secure: boolean;
    auth: {
        user: string;
        pass: string;
    };
}

export interface SendLinkOptions {
    to: string;
    hash: string;
    appUrl: string;
}

export class EmailService {
    private transporter: nodemailer.Transporter | null = null;
    private config: EmailConfig;
    private isConfigured: boolean = false;

    constructor() {
        this.config = {
            host: process.env.SMTP_HOST || '',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER || '',
                pass: process.env.SMTP_PASS || ''
            }
        };

        this.initializeTransporter();
    }

    private initializeTransporter(): void {
        // Check if SMTP is configured
        if (!this.config.host || !this.config.auth.user) {
            console.warn('⚠️ SMTP not configured - Email service disabled');
            console.warn('💡 Set SMTP_HOST, SMTP_USER, SMTP_PASS in environment variables');
            return;
        }

        try {
            // Fix: Use nodemailer.createTransport (not createTransporter)
            this.transporter = nodemailer.createTransport({
                host: this.config.host,
                port: this.config.port,
                secure: this.config.secure,
                auth: this.config.auth,
                // Additional options for better compatibility
                tls: {
                    rejectUnauthorized: false // For development - set to true in production
                }
            });

            this.isConfigured = true;
            console.log('✅ Email service configured');
        } catch (error) {
            console.error('❌ Failed to configure email service:', error);
        }
    }

    async sendHashLink(options: SendLinkOptions): Promise<boolean> {
        if (!this.isConfigured || !this.transporter) {
            console.log(`📧 Email service not configured. Hash link would be sent to: ${options.to}`);
            console.log(`🔗 Link: ${options.appUrl}?hash=${options.hash}`);
            return false; // Service not available, but not an error
        }

        const { to, hash, appUrl } = options;
        const link = `${appUrl}?hash=${hash}`;

        const mailOptions = {
            from: {
                name: 'YATWA Calendar',
                address: this.config.auth.user
            },
            to: to,
            subject: '📅 Dein YATWA Kalender-Link',
            html: this.generateEmailTemplate(link, hash),
            text: this.generateTextEmail(link, hash)
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Email sent to ${to}: ${info.messageId}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to send email:', error);
            return false;
        }
    }

    private generateEmailTemplate(link: string, hash: string): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YATWA Kalender-Link</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 2em; margin-bottom: 10px; }
        .button { display: inline-block; background: linear-gradient(45deg, #667eea, #764ba2); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .button:hover { background: linear-gradient(45deg, #764ba2, #667eea); }
        .info-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9em; }
        .hash-code { font-family: monospace; background: #f1f1f1; padding: 5px 8px; border-radius: 4px; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🗓️ YATWA</div>
            <h1>Dein Kalender-Link ist bereit!</h1>
        </div>
        
        <p>Hallo!</p>
        
        <p>Du hast einen neuen YATWA-Kalender erstellt. Mit diesem Link kannst du deine Termine verwalten und mit anderen Kalendern synchronisieren:</p>
        
        <p style="text-align: center;">
            <a href="${link}" class="button">🗓️ Zum Kalender</a>
        </p>
        
        <div class="info-box">
            <h3>📌 Wichtige Informationen:</h3>
            <ul>
                <li><strong>Sicher aufbewahren:</strong> Dieser Link ist dein einziger Zugang zu deinem Kalender</li>
                <li><strong>Teilen:</strong> Du kannst den Link auch als Lesezeichen speichern</li>
                <li><strong>Synchronisation:</strong> iCal-Export für deine Kalender-Apps verfügbar</li>
            </ul>
        </div>
        
        <p><strong>Dein Hash-Code:</strong> <span class="hash-code">${hash}</span></p>
        
        <p>Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:</p>
        <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace;">${link}</p>
        
        <div class="footer">
            <p>YATWA - Yet Another Trash Web App<br>
            Einfache Terminverwaltung ohne Registrierung</p>
        </div>
    </div>
</body>
</html>`;
    }

    private generateTextEmail(link: string, hash: string): string {
        return `
🗓️ YATWA - Dein Kalender-Link ist bereit!

Hallo!

Du hast einen neuen YATWA-Kalender erstellt. 

Dein Kalender-Link: ${link}

Wichtige Informationen:
- Sicher aufbewahren: Dieser Link ist dein einziger Zugang
- Du kannst ihn als Lesezeichen speichern
- iCal-Export für Kalender-Apps verfügbar

Dein Hash-Code: ${hash}

YATWA - Yet Another Trash Web App
Einfache Terminverwaltung ohne Registrierung
`;
    }

    // Test email configuration
    async testConnection(): Promise<boolean> {
        if (!this.transporter) {
            return false;
        }

        try {
            await this.transporter.verify();
            console.log('✅ Email connection test successful');
            return true;
        } catch (error) {
            console.error('❌ Email connection test failed:', error);
            return false;
        }
    }

    // Get service status
    getStatus(): {
        configured: boolean;
        host: string;
        port: number;
        user: string;
    } {
        return {
            configured: this.isConfigured,
            host: this.config.host,
            port: this.config.port,
            user: this.config.auth.user ? this.config.auth.user.replace(/(.{3}).*(@.*)/, '$1***$2') : 'Not set'
        };
    }
}