import { CredentialPattern, RedactResult, RedactedCredential } from "../types";

/**
 * Predefined patterns for detecting various types of credentials in code
 */
const CREDENTIAL_PATTERNS: CredentialPattern[] = [
  // API Keys, tokens, etc.
  {
    regex:
      /(["']?(?:api[_-]?key|api[_-]?token|app[_-]?key|app[_-]?token|auth[_-]?token|access[_-]?token|secret[_-]?key|client[_-]?secret)["']?\s*(?:=|:)\s*["'])([\w\d_\-\.]{10,})["']/gi,
    group: 2,
  },

  // AWS
  {
    regex:
      /(["']?(?:aws[_-]?access[_-]?key[_-]?id)["']?\s*(?:=|:)\s*["'])([\w\d]{16,})["']/gi,
    group: 2,
  },
  {
    regex:
      /(["']?(?:aws[_-]?secret[_-]?(?:access[_-]?)?key)["']?\s*(?:=|:)\s*["'])([\w\d\/+]{30,})["']/gi,
    group: 2,
  },

  // Database connection strings
  {
    regex:
      /(["']?(?:mongodb(?:\+srv)?:\/\/(?:[\w\d]+):))([\w\d@_\-\.\/+%:]+)(['"])/gi,
    group: 2,
  },
  {
    regex:
      /(["']?(?:postgres:\/\/|mysql:\/\/|jdbc:(?:mysql|postgresql):\/\/)(?:[\w\d]+):)([\w\d@_\-\.\/+%]+)([@\/])/gi,
    group: 2,
  },

  // Passwords
  {
    regex:
      /(["']?(?:password|passwd|pwd)["']?\s*(?:=|:)\s*["'])([\w\d!@#$%^&*()_+\-=\[\]{}|;':",./<>?]{4,})["']/gi,
    group: 2,
  },

  // Private keys
  {
    regex: /(-----BEGIN (?:RSA |DSA |EC )?PRIVATE KEY-----[\s\S]+?)(-{5}END)/gi,
    group: 1,
  },

  // OAuth tokens
  {
    regex:
      /(["']?(?:oauth[_-]?token|bearer[_-]?token|access[_-]?token|refresh[_-]?token)["']?\s*(?:=|:)\s*["'])([\w\d_\-\.]{10,})["']/gi,
    group: 2,
  },

  // JWT tokens
  {
    regex: /(["']?(?:jwt|token)["']?\s*(?:=|:)\s*["'])(eyJ[\w\-\.]+)["']/gi,
    group: 2,
  },

  // Firebase config
  {
    regex: /(firebaseConfig\s*=\s*\{[\s\S]*?apiKey:)\s*["']([\w\d\-_]+)["']/gi,
    group: 2,
  },

  // Environment variables
  {
    regex:
      /((?:SECRET|TOKEN|KEY|PASSWORD|CREDENTIAL|AUTH)[\w\d_]*\s*=\s*)([\w\d!@#$%^&*()_+\-=\[\]{}|;':",./<>?]{4,})/gi,
    group: 2,
  },

  // Generic secrets
  {
    regex:
      /(["']?(?:secret|token|key|password|credential|auth)["']?\s*(?:=|:)\s*["'])([\w\d!@#$%^&*()_+\-=\[\]{}|;':",./<>?]{8,})["']/gi,
    group: 2,
  },
];

/**
 * Helper function to determine credential type based on the match
 * @param match The text containing credential information
 * @returns The type of credential as a string
 */
function determineCredentialType(match: string): string {
  const lowerMatch = match.toLowerCase();

  if (lowerMatch.includes("api_key") || lowerMatch.includes("apikey")) {
    return "API Key";
  } else if (lowerMatch.includes("password") || lowerMatch.includes("pwd")) {
    return "Password";
  } else if (lowerMatch.includes("token")) {
    return "Token";
  } else if (lowerMatch.includes("access")) {
    return "Access Token";
  } else if (lowerMatch.includes("aws")) {
    return "AWS Key";
  } else if (lowerMatch.includes("private key")) {
    return "Private Key";
  } else if (lowerMatch.includes("mongo")) {
    return "MongoDB Credentials";
  } else if (lowerMatch.includes("postgres") || lowerMatch.includes("mysql")) {
    return "Database Credentials";
  } else if (lowerMatch.includes("firebase")) {
    return "Firebase Config";
  } else if (lowerMatch.includes("secret")) {
    return "Secret";
  } else {
    return "Sensitive Data";
  }
}

/**
 * Function to redact credentials from content
 * @param content The file content to check
 * @param filePath The path to the file
 * @returns Object with redacted content and information about redacted credentials
 */
function redactCredentials(content: string, filePath: string): RedactResult {
  if (!content)
    return { content, credentialsFound: false, redactedCredentials: [] };

  let redactedContent = content;
  let credentialsFound = false;
  const redactedCredentials: RedactedCredential[] = [];

  // Determine if the file is likely to contain credentials
  const isEnvFile =
    filePath &&
    (filePath.includes(".env") ||
      filePath.endsWith("config.js") ||
      filePath.endsWith("settings.json") ||
      filePath.endsWith("secrets.yml") ||
      filePath.endsWith("credentials.json"));

  // Process each pattern
  CREDENTIAL_PATTERNS.forEach((pattern) => {
    const matches = [...redactedContent.matchAll(pattern.regex)];
    if (matches.length > 0) {
      credentialsFound = true;

      // Process each match
      matches.forEach((match) => {
        const fullMatch = match[0];
        const sensitiveData = match[pattern.group];
        const replacement = "[REDACTED]";

        // Get line and column information
        const index = match.index || 0;
        const contentUpToMatch = redactedContent.substring(0, index);
        const lines = contentUpToMatch.split("\n");
        const lineNumber = lines.length;
        const columnNumber = lines[lines.length - 1].length + 1;

        // Determine credential type
        const credType = determineCredentialType(fullMatch);

        // Add to redacted credentials list with only partial info for safety
        redactedCredentials.push({
          file: filePath,
          line: lineNumber,
          column: columnNumber,
          type: credType,
          partialValue: sensitiveData.substring(0, 3) + "...", // Only keep first 3 chars for safety
        });

        // Replace sensitive data with [REDACTED]
        let replacementText = fullMatch.replace(sensitiveData, replacement);
        redactedContent = redactedContent.replace(fullMatch, replacementText);
      });
    }
  });

  // Special handling for .env files, config files, or other files likely to contain credentials
  if (isEnvFile) {
    // For .env files, we can apply additional redaction rules
    // This could include scanning for environment variable patterns
    const envVarRegex = /^([A-Za-z0-9_]+)=(.+)$/gm;
    const envMatches = [...redactedContent.matchAll(envVarRegex)];

    envMatches.forEach((match) => {
      const varName = match[1];
      const varValue = match[2];

      // Check if this variable name suggests it contains sensitive information
      if (isSensitiveEnvVarName(varName) && !isAlreadyRedacted(varValue)) {
        credentialsFound = true;

        // Get line information
        const index = match.index || 0;
        const contentUpToMatch = redactedContent.substring(0, index);
        const lines = contentUpToMatch.split("\n");
        const lineNumber = lines.length;
        const columnNumber =
          lines[lines.length - 1].length + varName.length + 1; // After the '='

        // Add to redacted credentials list
        redactedCredentials.push({
          file: filePath,
          line: lineNumber,
          column: columnNumber,
          type: "Environment Variable",
          partialValue: varValue.substring(0, 3) + "...",
        });

        // Replace the value with [REDACTED]
        redactedContent = redactedContent.replace(
          `${varName}=${varValue}`,
          `${varName}=[REDACTED]`
        );
      }
    });
  }

  return {
    content: redactedContent,
    credentialsFound,
    redactedCredentials,
  };
}

/**
 * Helper function to check if an environment variable name suggests sensitive content
 * @param varName Environment variable name
 * @returns Whether the variable likely contains sensitive info
 */
function isSensitiveEnvVarName(varName: string): boolean {
  const sensitiveNamePatterns = [
    /key/i,
    /token/i,
    /secret/i,
    /pass/i,
    /pwd/i,
    /auth/i,
    /cred/i,
    /login/i,
    /access/i,
    /private/i,
    /sensitive/i,
  ];

  return sensitiveNamePatterns.some((pattern) => pattern.test(varName));
}

/**
 * Helper function to check if a value is already redacted
 * @param value String value to check
 * @returns Whether the value appears to be already redacted
 */
function isAlreadyRedacted(value: string): boolean {
  return value === "[REDACTED]" || value.includes("REDACTED");
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
    /password.*\.(json|js|yml|yaml)$/i,
  ];

  return sensitivePatterns.some((pattern) => pattern.test(filePath));
}

export { redactCredentials, isLikelySensitiveFile, CREDENTIAL_PATTERNS };
