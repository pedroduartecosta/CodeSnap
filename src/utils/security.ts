import { CredentialPattern, RedactResult } from '../types';

// Credential patterns to detect and redact
const CREDENTIAL_PATTERNS: CredentialPattern[] = [
    // API keys - common formats and naming patterns
    { regex: /(["']?(?:api[_-]?key|api[_-]?token|app[_-]?key|app[_-]?token|auth[_-]?token|access[_-]?token|secret[_-]?key|client[_-]?secret)["']?\s*(?:=|:)\s*["'])([\w\d_\-\.]{10,})["']/gi, group: 2 },

    // AWS specific credentials
    { regex: /(["']?(?:aws[_-]?access[_-]?key[_-]?id)["']?\s*(?:=|:)\s*["'])([\w\d]{16,})["']/gi, group: 2 },
    { regex: /(["']?(?:aws[_-]?secret[_-]?(?:access[_-]?)?key)["']?\s*(?:=|:)\s*["'])([\w\d\/+]{30,})["']/gi, group: 2 },

    // Database connection strings
    { regex: /(["']?(?:mongodb(?:\+srv)?:\/\/(?:[\w\d]+):))([\w\d@_\-\.\/+%:]+)(['"])/gi, group: 2 },
    { regex: /(["']?(?:postgres:\/\/|mysql:\/\/|jdbc:(?:mysql|postgresql):\/\/)(?:[\w\d]+):)([\w\d@_\-\.\/+%]+)([@\/])/gi, group: 2 },

    // Connection string passwords
    { regex: /(["']?(?:password|passwd|pwd)["']?\s*(?:=|:)\s*["'])([\w\d!@#$%^&*()_+\-=\[\]{}|;':",./<>?]{4,})["']/gi, group: 2 },

    // Private keys in base64/similar format
    { regex: /(-----BEGIN (?:RSA |DSA |EC )?PRIVATE KEY-----[\s\S]+?)(-{5}END)/gi, group: 1 },

    // OAuth tokens
    { regex: /(["']?(?:oauth[_-]?token|bearer[_-]?token|access[_-]?token|refresh[_-]?token)["']?\s*(?:=|:)\s*["'])([\w\d_\-\.]{10,})["']/gi, group: 2 },

    // JWT tokens
    { regex: /(["']?(?:jwt|token)["']?\s*(?:=|:)\s*["'])(eyJ[\w\-\.]+)["']/gi, group: 2 },

    // Firebase config with sensitive data
    { regex: /(firebaseConfig\s*=\s*\{[\s\S]*?apiKey:)\s*["']([\w\d\-_]+)["']/gi, group: 2 },

    // Environment variables in .env files
    { regex: /((?:SECRET|TOKEN|KEY|PASSWORD|CREDENTIAL|AUTH)[\w\d_]*\s*=\s*)([\w\d!@#$%^&*()_+\-=\[\]{}|;':",./<>?]{4,})/gi, group: 2 },

    // Generic secrets and keys
    { regex: /(["']?(?:secret|token|key|password|credential|auth)["']?\s*(?:=|:)\s*["'])([\w\d!@#$%^&*()_+\-=\[\]{}|;':",./<>?]{8,})["']/gi, group: 2 }
];

/**
 * Function to redact credentials from content
 * @param content The file content to check
 * @param filePath The path to the file
 * @returns Object with redacted content and boolean indicating if credentials were found
 */
function redactCredentials(content: string, filePath: string): RedactResult {
    if (!content) return { content, credentialsFound: false };

    let redactedContent = content;
    let credentialsFound = false;

    // Extra protection for .env files and config files
    const isEnvFile = filePath && (
        filePath.includes('.env') ||
        filePath.endsWith('config.js') ||
        filePath.endsWith('settings.json') ||
        filePath.endsWith('secrets.yml') ||
        filePath.endsWith('credentials.json')
    );

    // Apply all credential pattern checks
    CREDENTIAL_PATTERNS.forEach(pattern => {
        const matches = [...redactedContent.matchAll(pattern.regex)];
        if (matches.length > 0) {
            credentialsFound = true;

            // Replace each match with redacted version
            matches.forEach(match => {
                const fullMatch = match[0];
                const sensitiveData = match[pattern.group];
                const replacement = '[REDACTED]';

                // Replace just the sensitive part, preserving the structure
                let replacementText = fullMatch.replace(sensitiveData, replacement);
                redactedContent = redactedContent.replace(fullMatch, replacementText);
            });
        }
    });

    // Extra scrutiny for .env files and known config files
    if (isEnvFile) {
        // Add a warning comment at the top of sensitive files
        redactedContent = `// ⚠️ SENSITIVE FILE - Credentials have been automatically redacted\n${redactedContent}`;
    }

    return {
        content: redactedContent,
        credentialsFound
    };
}

/**
 * Check if a file is likely to contain credentials based on its name/path
 * @param filePath The path to the file
 * @returns Boolean indicating if the file likely contains sensitive information
 */
function isLikelySensitiveFile(filePath: string): boolean {
    const sensitivePatterns = [
        /\.env($|\.)/i,
        /config.*\.(json|js|yml|yaml)$/i,
        /secret.*\.(json|js|yml|yaml)$/i,
        /credential.*\.(json|js|yml|yaml)$/i,
        /key.*\.(json|pem|key)$/i,
        /auth.*\.(json|js|yml|yaml)$/i,
        /password.*\.(json|js|yml|yaml)$/i
    ];

    return sensitivePatterns.some(pattern => pattern.test(filePath));
}

export {
    redactCredentials,
    isLikelySensitiveFile,
    CREDENTIAL_PATTERNS
};