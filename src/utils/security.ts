// Improved version of security.ts with more precise credential detection

import { CredentialPattern, RedactResult, RedactedCredential } from "../types";

// More precise credential patterns with additional context requirements
const CREDENTIAL_PATTERNS: CredentialPattern[] = [
  // API keys and tokens - more specific matching to avoid false positives
  {
    regex:
      /(["']?(?:api[_-]?key|api[_-]?token|app[_-]?key|app[_-]?token|auth[_-]?token|access[_-]?token|secret[_-]?key|client[_-]?secret)["']?\s*(?:=|:)\s*["'])([A-Za-z0-9_\-\.]{16,})["']/gi,
    group: 2,
  },

  // AWS access keys - more specific format matching
  {
    regex:
      /(["']?(?:aws[_-]?access[_-]?key[_-]?id)["']?\s*(?:=|:)\s*["'])([A-Z0-9]{20})["']/gi,
    group: 2,
  },
  {
    regex:
      /(["']?(?:aws[_-]?secret[_-]?(?:access[_-]?)?key)["']?\s*(?:=|:)\s*["'])([A-Za-z0-9\/+]{40})["']/gi,
    group: 2,
  },

  // Database connection strings - improved pattern to match actual connection strings
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

  // Passwords - more specific to avoid false positives with common words
  {
    regex:
      /(["']?(?:password|passwd|pwd)["']?\s*(?:=|:)\s*["'])([A-Za-z0-9!@#$%^&*()_+\-=\[\]{}|;':",./<>?]{8,})["']/gi,
    group: 2,
  },

  // Private keys - kept as is since it's specific enough
  {
    regex: /(-----BEGIN (?:RSA |DSA |EC )?PRIVATE KEY-----[\s\S]+?)(-{5}END)/gi,
    group: 1,
  },

  // OAuth tokens - made more specific with longer length requirements
  {
    regex:
      /(["']?(?:oauth[_-]?token|bearer[_-]?token|access[_-]?token|refresh[_-]?token)["']?\s*(?:=|:)\s*["'])([A-Za-z0-9_\-\.]{16,})["']/gi,
    group: 2,
  },

  // JWT tokens - more specific pattern for JWT format
  {
    regex:
      /(["']?(?:jwt|token)["']?\s*(?:=|:)\s*["'])(eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)["']/gi,
    group: 2,
  },

  // Firebase config - more specific pattern
  {
    regex:
      /(firebaseConfig\s*=\s*\{[\s\S]*?apiKey:)\s*["']([A-Za-z0-9\-_]{39})["']/gi,
    group: 2,
  },

  // Environment variables - more specific pattern to avoid code identifiers
  {
    regex:
      /((?:SECRET|TOKEN|KEY|PASSWORD|CREDENTIAL|AUTH)[\w\d_]*\s*=\s*['""])([A-Za-z0-9!@#$%^&*()_+\-=\[\]{}|;':",./<>?]{8,})['"']/gi,
    group: 2,
  },

  // Generic secrets - more specific pattern with longer length and special formatting
  {
    regex:
      /(["']?(?:secret|token|key|password|credential|auth)["']?\s*(?:=|:)\s*["'])([A-Za-z0-9!@#$%^&*()_+\-=\[\]{}|;':",./<>?]{12,})["']/gi,
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

  // Check if this is a likely config/env file to be more aggressive
  const isEnvFile =
    filePath &&
    (filePath.includes(".env") ||
      filePath.endsWith("config.js") ||
      filePath.endsWith("settings.json") ||
      filePath.endsWith("secrets.yml") ||
      filePath.endsWith("credentials.json"));

  // Process all credential patterns
  CREDENTIAL_PATTERNS.forEach((pattern) => {
    const matches = [...redactedContent.matchAll(pattern.regex)];
    if (matches.length > 0) {
      credentialsFound = true;

      // Process each match
      matches.forEach((match) => {
        const fullMatch = match[0];
        const sensitiveData = match[pattern.group];
        const replacement = "[REDACTED]";

        // Skip common false positives
        if (isCommonFalsePositive(sensitiveData)) {
          return;
        }

        // Get line and column information
        const index = match.index || 0;
        const contentUpToMatch = redactedContent.substring(0, index);
        const lines = contentUpToMatch.split("\n");
        const lineNumber = lines.length;
        const columnNumber = lines[lines.length - 1].length + 1;

        // Determine credential type
        const credType = determineCredentialType(fullMatch);

        // Add to the list of redacted credentials
        redactedCredentials.push({
          file: filePath,
          line: lineNumber,
          column: columnNumber,
          type: credType,
          partialValue: sensitiveData.substring(0, 3) + "...",
        });

        // Replace the sensitive data in the content
        let replacementText = fullMatch.replace(sensitiveData, replacement);
        redactedContent = redactedContent.replace(fullMatch, replacementText);
      });
    }
  });

  // Additional handling for environment variables in env files
  if (isEnvFile) {
    // Use a more specific regex to match env vars with values
    const envVarRegex = /^([A-Za-z0-9_]+)=(['"](.*?)['"]|(.*))$/gm;
    const envMatches = [...redactedContent.matchAll(envVarRegex)];

    envMatches.forEach((match) => {
      const varName = match[1];
      const varValue = match[3] || match[4]; // Get the value, whether quoted or not

      // Only redact if it's likely a sensitive variable name and not a common false positive
      if (
        isSensitiveEnvVarName(varName) &&
        !isCommonFalsePositive(varValue) &&
        !isAlreadyRedacted(varValue)
      ) {
        credentialsFound = true;

        // Get line and column information
        const index = match.index || 0;
        const contentUpToMatch = redactedContent.substring(0, index);
        const lines = contentUpToMatch.split("\n");
        const lineNumber = lines.length;
        const columnNumber =
          lines[lines.length - 1].length + varName.length + 1; // After the = sign

        // Add to the list of redacted credentials
        redactedCredentials.push({
          file: filePath,
          line: lineNumber,
          column: columnNumber,
          type: "Environment Variable",
          partialValue: varValue.substring(0, 3) + "...",
        });

        // Replace the value with a redacted version
        const fullMatch = match[0];
        const redactedMatch = `${varName}=[REDACTED]`;
        redactedContent = redactedContent.replace(fullMatch, redactedMatch);
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
 * Helper function to check if a value is likely a false positive
 * @param value String value to check
 * @returns Whether the value is likely a false positive
 */
function isCommonFalsePositive(value: string): boolean {
  // Common JavaScript/TypeScript values that might be flagged
  const commonFalsePositives = [
    "true",
    "false",
    "null",
    "undefined",
    "Object",
    "Array",
    "String",
    "Number",
    "Boolean",
    "Function",
    "Math",
    "Date",
    "RegExp",
    "match",
    "matches",
    "pattern",
    "index",
    "object",
    "length",
  ];

  return (
    commonFalsePositives.includes(value) ||
    (/^[A-Za-z]+$/.test(value) && value.length < 8)
  ); // Single word with no numbers/symbols and short
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
