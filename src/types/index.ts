// src/types/index.ts - Expanded types for improved large project handling

// Program options interface with additional options
export interface ProgramOptions {
  directory: string;
  ignore?: string[];
  extensions?: string[];
  files?: string[];
  exclude?: string[];
  limit: string;
  limitBytes: number;
  tokens: string;
  tokenLimitChars: number;
  copy: boolean;
  tree: boolean;
  listOnly: boolean;
  respectGitignore: boolean;
  dryRun: boolean;
  summary: boolean;
  interactive: boolean;
  smart: boolean;
  stripComments: boolean;
  recent: string;
  maxFileSize: string;
  maxFileSizeBytes: number; // Added for clarity
  truncateLargeFiles: boolean;
  saveConfig?: string;
  loadConfig?: string;
  optimizeTokens: boolean;
  summarizeLargeFiles: boolean;
  llm: string;
  redactCredentials: boolean;
  verbose: boolean;
  maxFiles?: number; // New: Maximum number of files to include
  skipBinary?: boolean; // New: Skip binary files
  forceUtf8?: boolean; // New: Force UTF-8 encoding
  showRedacted: boolean;
}

// Default file patterns
export interface DefaultPatterns {
  DEFAULT_IGNORE_DIRS: string[];
  DEFAULT_INCLUDE_EXTS: string[];
  DEFAULT_INCLUDE_FILES: string[];
  DEFAULT_EXCLUDE_FILES: string[];
}

// File statistics
export interface FileStat {
  path: string;
  size: number;
  tokens: number;
}

// Prioritized files result
export interface PrioritizedResult {
  files: string[];
  fileContents: string[];
  fileStats: FileStat[];
}

// Credential pattern
export interface CredentialPattern {
  regex: RegExp;
  group: number;
}

export interface RedactedCredential {
  file: string;
  line: number;
  column: number;
  type: string; // E.g., "API Key", "Password", etc.
  partialValue?: string; // First few chars for identification
}

export interface RedactResult {
  content: string;
  credentialsFound: boolean;
  redactedCredentials: RedactedCredential[]; // Add this
}

// File with score for prioritization
export interface ScoredFile {
  file: string;
  content: string;
  stats: FileStat;
  score: number;
}

// Project summary stats
export interface ProjectStats {
  totalFiles: number;
  includedFiles: number;
  totalSize: number;
  totalTokens: number;
  skippedBinaryFiles: number;
  skippedLargeFiles: number;
  skippedEncodingIssues: number;
}

// Configuration profile
export interface ConfigProfile {
  name: string;
  options: ProgramOptions;
  lastUsed: Date;
  description?: string;
}

// File type identification result
export interface FileTypeInfo {
  isBinary: boolean;
  isLarge: boolean;
  isConfig: boolean;
  isPriority: boolean;
  isEntry: boolean;
  estimatedTokens: number;
}
