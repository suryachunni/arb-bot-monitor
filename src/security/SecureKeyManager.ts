import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ethers } from 'ethers';
import * as readline from 'readline';

/**
 * SECURE KEY MANAGEMENT SYSTEM
 * 
 * Features:
 * - AES-256-GCM encryption for private keys
 * - Password-based key derivation (PBKDF2)
 * - Encrypted storage with salt and IV
 * - Runtime decryption only
 * - No plaintext keys in memory longer than necessary
 */

export interface EncryptedKeystore {
    version: string;
    crypto: {
        cipher: string;
        ciphertext: string;
        iv: string;
        salt: string;
        kdf: string;
        kdfparams: {
            iterations: number;
            keylen: number;
            digest: string;
        };
    };
}

export class SecureKeyManager {
    private static readonly ALGORITHM = 'aes-256-gcm';
    private static readonly KDF_ITERATIONS = 100000;
    private static readonly KEY_LENGTH = 32;
    private static readonly IV_LENGTH = 16;
    private static readonly SALT_LENGTH = 32;
    private static readonly AUTH_TAG_LENGTH = 16;

    /**
     * Encrypt a private key with a password
     */
    static encrypt(privateKey: string, password: string): EncryptedKeystore {
        // Generate salt for key derivation
        const salt = crypto.randomBytes(SecureKeyManager.SALT_LENGTH);
        
        // Derive encryption key from password
        const key = crypto.pbkdf2Sync(
            password,
            salt,
            SecureKeyManager.KDF_ITERATIONS,
            SecureKeyManager.KEY_LENGTH,
            'sha256'
        );

        // Generate random IV
        const iv = crypto.randomBytes(SecureKeyManager.IV_LENGTH);

        // Create cipher
        const cipher = crypto.createCipheriv(SecureKeyManager.ALGORITHM, key, iv);

        // Encrypt private key
        let encrypted = cipher.update(privateKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Get auth tag
        const authTag = cipher.getAuthTag();

        // Combine encrypted data with auth tag
        const ciphertext = encrypted + authTag.toString('hex');

        // Return encrypted keystore
        return {
            version: '1.0.0',
            crypto: {
                cipher: SecureKeyManager.ALGORITHM,
                ciphertext: ciphertext,
                iv: iv.toString('hex'),
                salt: salt.toString('hex'),
                kdf: 'pbkdf2',
                kdfparams: {
                    iterations: SecureKeyManager.KDF_ITERATIONS,
                    keylen: SecureKeyManager.KEY_LENGTH,
                    digest: 'sha256'
                }
            }
        };
    }

    /**
     * Decrypt a private key with a password
     */
    static decrypt(keystore: EncryptedKeystore, password: string): string {
        // Extract components
        const salt = Buffer.from(keystore.crypto.salt, 'hex');
        const iv = Buffer.from(keystore.crypto.iv, 'hex');
        const ciphertext = keystore.crypto.ciphertext;

        // Derive decryption key
        const key = crypto.pbkdf2Sync(
            password,
            salt,
            keystore.crypto.kdfparams.iterations,
            keystore.crypto.kdfparams.keylen,
            keystore.crypto.kdfparams.digest
        );

        // Split ciphertext and auth tag
        const authTag = Buffer.from(
            ciphertext.slice(-SecureKeyManager.AUTH_TAG_LENGTH * 2),
            'hex'
        );
        const encryptedData = ciphertext.slice(0, -SecureKeyManager.AUTH_TAG_LENGTH * 2);

        // Create decipher
        const decipher = crypto.createDecipheriv(SecureKeyManager.ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        // Decrypt
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Save encrypted keystore to file
     */
    static async saveKeystore(keystore: EncryptedKeystore, filepath: string): Promise<void> {
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filepath, JSON.stringify(keystore, null, 2), { mode: 0o600 });
        console.log(`✅ Encrypted keystore saved to: ${filepath}`);
    }

    /**
     * Load encrypted keystore from file
     */
    static async loadKeystore(filepath: string): Promise<EncryptedKeystore> {
        if (!fs.existsSync(filepath)) {
            throw new Error(`Keystore file not found: ${filepath}`);
        }

        const data = fs.readFileSync(filepath, 'utf8');
        return JSON.parse(data);
    }

    /**
     * Prompt for password securely (no echo)
     */
    static async promptPassword(prompt: string = 'Enter password: '): Promise<string> {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            // Disable echo
            const stdin = process.stdin;
            (stdin as any).setRawMode(true);

            process.stdout.write(prompt);
            
            let password = '';
            stdin.on('data', (char) => {
                const charStr = char.toString('utf8');

                if (charStr === '\n' || charStr === '\r' || charStr === '\u0004') {
                    // Enter pressed
                    (stdin as any).setRawMode(false);
                    stdin.pause();
                    rl.close();
                    process.stdout.write('\n');
                    resolve(password);
                } else if (charStr === '\u0003') {
                    // Ctrl+C
                    (stdin as any).setRawMode(false);
                    stdin.pause();
                    rl.close();
                    process.stdout.write('\n');
                    process.exit(0);
                } else if (charStr === '\u007f' || charStr === '\b') {
                    // Backspace
                    if (password.length > 0) {
                        password = password.slice(0, -1);
                        process.stdout.write('\b \b');
                    }
                } else {
                    // Regular character
                    password += charStr;
                    process.stdout.write('*');
                }
            });
        });
    }

    /**
     * Create a signer from encrypted keystore
     */
    static async createSecureSigner(
        keystorePath: string,
        provider: ethers.providers.Provider
    ): Promise<ethers.Wallet> {
        console.log('🔐 Loading encrypted keystore...');
        
        const keystore = await SecureKeyManager.loadKeystore(keystorePath);
        const password = await SecureKeyManager.promptPassword('🔑 Enter keystore password: ');

        console.log('🔓 Decrypting private key...');
        const privateKey = SecureKeyManager.decrypt(keystore, password);

        // Validate private key
        try {
            const wallet = new ethers.Wallet(privateKey, provider);
            console.log(`✅ Wallet loaded: ${wallet.address}`);
            return wallet;
        } catch (error) {
            throw new Error('Invalid private key or wrong password');
        }
    }

    /**
     * Migrate from plaintext .env to encrypted keystore
     */
    static async migrateFromEnv(envPath: string = '.env'): Promise<void> {
        console.log('🔄 Migrating from .env to encrypted keystore...');

        // Read .env file
        if (!fs.existsSync(envPath)) {
            throw new Error(`.env file not found: ${envPath}`);
        }

        const envContent = fs.readFileSync(envPath, 'utf8');
        const privateKeyMatch = envContent.match(/PRIVATE_KEY=(.+)/);

        if (!privateKeyMatch) {
            throw new Error('PRIVATE_KEY not found in .env');
        }

        const privateKey = privateKeyMatch[1].trim();

        // Validate private key
        try {
            new ethers.Wallet(privateKey);
        } catch (error) {
            throw new Error('Invalid private key format in .env');
        }

        // Prompt for encryption password
        const password = await SecureKeyManager.promptPassword('🔑 Enter new encryption password: ');
        const confirmPassword = await SecureKeyManager.promptPassword('🔑 Confirm password: ');

        if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
        }

        if (password.length < 12) {
            throw new Error('Password must be at least 12 characters');
        }

        // Encrypt private key
        const keystore = SecureKeyManager.encrypt(privateKey, password);

        // Save encrypted keystore
        const keystorePath = path.join('.', 'keystore', 'encrypted-key.json');
        await SecureKeyManager.saveKeystore(keystore, keystorePath);

        console.log('\n✅ Migration complete!');
        console.log(`   Encrypted keystore: ${keystorePath}`);
        console.log(`\n⚠️  IMPORTANT: Backup your keystore file and remember your password!`);
        console.log(`⚠️  You can now remove PRIVATE_KEY from .env (keep a backup elsewhere)`);
    }
}

// ═══════════════════════════════════════════════════════════════
// CLI COMMANDS
// ═══════════════════════════════════════════════════════════════

/**
 * Command-line interface for key management
 */
export async function keyManagerCLI() {
    const args = process.argv.slice(2);
    const command = args[0];

    try {
        switch (command) {
            case 'encrypt':
                await encryptCommand(args[1], args[2]);
                break;
            
            case 'migrate':
                await SecureKeyManager.migrateFromEnv(args[1] || '.env');
                break;
            
            case 'verify':
                await verifyCommand(args[1]);
                break;
            
            default:
                printHelp();
        }
    } catch (error: any) {
        console.error(`\n❌ Error: ${error.message}\n`);
        process.exit(1);
    }
}

async function encryptCommand(privateKey?: string, outputPath?: string) {
    if (!privateKey) {
        console.error('Usage: npm run key-manager encrypt <private-key> [output-path]');
        process.exit(1);
    }

    const password = await SecureKeyManager.promptPassword('🔑 Enter encryption password: ');
    const confirmPassword = await SecureKeyManager.promptPassword('🔑 Confirm password: ');

    if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
    }

    const keystore = SecureKeyManager.encrypt(privateKey, password);
    const filepath = outputPath || path.join('.', 'keystore', 'encrypted-key.json');
    
    await SecureKeyManager.saveKeystore(keystore, filepath);
}

async function verifyCommand(keystorePath?: string) {
    if (!keystorePath) {
        keystorePath = path.join('.', 'keystore', 'encrypted-key.json');
    }

    const keystore = await SecureKeyManager.loadKeystore(keystorePath);
    const password = await SecureKeyManager.promptPassword('🔑 Enter password to verify: ');

    const privateKey = SecureKeyManager.decrypt(keystore, password);
    const wallet = new ethers.Wallet(privateKey);

    console.log(`\n✅ Keystore verified successfully!`);
    console.log(`   Address: ${wallet.address}`);
}

function printHelp() {
    console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                 SECURE KEY MANAGER - HELP                         ║
╚═══════════════════════════════════════════════════════════════════╝

Commands:

  migrate [env-path]           Migrate from .env to encrypted keystore
                              Default: .env

  encrypt <key> [output]       Encrypt a private key
                              Requires: private key
                              Optional: output path

  verify [keystore-path]       Verify encrypted keystore
                              Default: ./keystore/encrypted-key.json

Examples:

  npm run key-manager migrate
  npm run key-manager encrypt 0x123...abc ./keystore/my-key.json
  npm run key-manager verify ./keystore/encrypted-key.json

Security Features:

  ✅ AES-256-GCM encryption
  ✅ PBKDF2 key derivation (100,000 iterations)
  ✅ Random IV and salt
  ✅ Password-protected
  ✅ No plaintext keys stored

═══════════════════════════════════════════════════════════════════
`);
}

// Run CLI if executed directly
if (require.main === module) {
    keyManagerCLI();
}
