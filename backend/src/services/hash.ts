// 🔐 Hash Service - Secure user hash generation and validation
import { randomBytes, createHash } from 'crypto';

export interface HashResult {
    hash: string;
    isNew: boolean;
    created: Date;
}

export class HashService {
    private readonly HASH_LENGTH = 32; // 32 bytes = 256 bits
    private readonly SALT_LENGTH = 16; // 16 bytes = 128 bits

    /**
     * Generate a cryptographically secure hash for new users
     */
    generateUserHash(): string {
        // Generate random bytes
        const randomData = randomBytes(this.HASH_LENGTH);

        // Add timestamp for uniqueness
        const timestamp = Date.now().toString();

        // Create salt
        const salt = randomBytes(this.SALT_LENGTH);

        // Combine everything
        const combined = Buffer.concat([
            randomData,
            Buffer.from(timestamp, 'utf8'),
            salt
        ]);

        // Hash with SHA-256
        const hash = createHash('sha256')
            .update(combined)
            .digest('hex');

        // Make it URL-safe and shorter (40 chars)
        return hash.substring(0, 40);
    }

    /**
     * Validate hash format (basic check)
     */
    isValidHashFormat(hash: string): boolean {
        // Must be 40 characters, hexadecimal
        const hashRegex = /^[a-f0-9]{40}$/i;
        return hashRegex.test(hash);
    }

    /**
     * Generate a shorter hash for demo/development
     * @param prefix Optional prefix for easier identification
     */
    generateDemoHash(prefix: string = 'demo'): string {
        const randomPart = randomBytes(8).toString('hex');
        const timestamp = Date.now().toString(36); // Base36 for shorter string
        return `${prefix}-${timestamp}-${randomPart}`;
    }

    /**
     * Create hash with collision detection
     * This would be used with database to ensure uniqueness
     */
    async generateUniqueHash(checkExistence: (hash: string) => Promise<boolean>): Promise<string> {
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            const hash = this.generateUserHash();

            // Check if hash already exists
            const exists = await checkExistence(hash);
            if (!exists) {
                return hash;
            }

            attempts++;
        }

        throw new Error('Failed to generate unique hash after maximum attempts');
    }

    /**
     * Generate hash with metadata
     */
    generateHashWithMetadata(): {
        hash: string;
        created: Date;
        entropy: number;
    } {
        const hash = this.generateUserHash();
        const created = new Date();

        // Calculate entropy (bits of randomness)
        const entropy = this.HASH_LENGTH * 8 + this.SALT_LENGTH * 8;

        return {
            hash,
            created,
            entropy
        };
    }

    /**
     * Validate hash strength (for security auditing)
     */
    validateHashSecurity(hash: string): {
        isValid: boolean;
        strength: 'weak' | 'medium' | 'strong';
        issues: string[];
    } {
        const issues: string[] = [];
        let strength: 'weak' | 'medium' | 'strong' = 'strong';

        // Check length
        if (hash.length < 32) {
            issues.push('Hash too short (minimum 32 characters)');
            strength = 'weak';
        }

        // Check character set
        if (!/^[a-f0-9]+$/i.test(hash)) {
            issues.push('Hash contains non-hexadecimal characters');
            strength = 'weak';
        }

        // Check for patterns (very basic)
        if (/(.)\1{4,}/.test(hash)) {
            issues.push('Hash contains repeating patterns');
            strength = 'medium';
        }

        // Check for common weak hashes
        const weakHashes = ['0', '1', 'a', 'f'].map(c => c.repeat(hash.length));
        if (weakHashes.includes(hash.toLowerCase())) {
            issues.push('Hash appears to be a weak test value');
            strength = 'weak';
        }

        return {
            isValid: issues.length === 0,
            strength,
            issues
        };
    }

    /**
     * Generate hash for specific use cases
     */
    generateHashForEnvironment(env: 'development' | 'staging' | 'production'): string {
        switch (env) {
            case 'development':
                return this.generateDemoHash('dev');
            case 'staging':
                return this.generateDemoHash('stage');
            case 'production':
                return this.generateUserHash();
            default:
                return this.generateUserHash();
        }
    }

    /**
     * Create a backup hash (for recovery purposes)
     */
    generateBackupHash(originalHash: string): string {
        const backupSeed = createHash('sha256')
            .update(originalHash + 'backup-seed')
            .digest('hex');

        return 'backup-' + backupSeed.substring(0, 32);
    }
}