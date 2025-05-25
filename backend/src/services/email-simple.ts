// 📧 Simple Email Service - Development fallback without nodemailer
export interface SendLinkOptions {
    to: string;
    hash: string;
    appUrl: string;
}

export class SimpleEmailService {
    private isConfigured: boolean = false;

    constructor() {
        // Check if SMTP is configured
        const hasConfig = process.env.SMTP_HOST && process.env.SMTP_USER;
        this.isConfigured = !!hasConfig;

        if (this.isConfigured) {
            console.log('✅ Email service configured (simple mode)');
        } else {
            console.warn('⚠️ SMTP not configured - Email service disabled');
            console.warn('💡 Set SMTP_HOST, SMTP_USER, SMTP_PASS in environment variables');
        }
    }

    async sendHashLink(options: SendLinkOptions): Promise<boolean> {
        const { to, hash, appUrl } = options;
        const link = `${appUrl}?hash=${hash}`;

        // For development - just log the email that would be sent
        console.log(`
📧 EMAIL WOULD BE SENT:
📍 To: ${to}
🔗 Link: ${link}
📝 Hash: ${hash}
📄 Content: Your YATWA calendar link is ready!
    `);

        // In production, you would implement actual email sending here
        // For now, we just simulate success
        return true;
    }

    getStatus(): {
        configured: boolean;
        host: string;
        port: number;
        user: string;
    } {
        return {
            configured: this.isConfigured,
            host: process.env.SMTP_HOST || 'Not set',
            port: parseInt(process.env.SMTP_PORT || '587'),
            user: process.env.SMTP_USER ?
                process.env.SMTP_USER.replace(/(.{3}).*(@.*)/, '$1***$2') :
                'Not set'
        };
    }

    async testConnection(): Promise<boolean> {
        // Always return true for simple service
        return true;
    }
}