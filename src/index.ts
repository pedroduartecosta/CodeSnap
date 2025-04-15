// src/index.ts - Main improvements for large project handling

import { program } from "commander";
import chalk from "chalk";
import clipboardy from "clipboardy";
import ora from "ora";
import fs from "fs";
import path from "path";
import { filesize } from "filesize";

import { findFiles, getFileTree } from "./utils/file-utils";
import { formatOutput } from "./utils/formatter";
import { redactCredentials } from "./utils/security";
import {
  interactiveFileSelection,
  loadConfig,
  saveConfig,
} from "./utils/interactive";
import { prioritizeFiles } from "./utils/file-utils";
import { ProgramOptions, DefaultPatterns, FileStat } from "./types";

// Default directories to ignore (EXPANDED)
const DEFAULT_IGNORE_DIRS: string[] = [
  // Package directories
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/public/**",
  "**/bin/**",
  "**/binaries/**",

  // Test directories
  "**/test/**",
  "**/tests/**",
  "**/spec/**",
  "**/specs/**",
  "**/fixtures/**",

  // Version control
  "**/.git/**",
  "**/.github/**",
  "**/.svn/**",

  // CI/CD and coverage
  "**/coverage/**",
  "**/.gitlab/**",
  "**/.circleci/**",

  // Documentation
  "**/docs/**",
  "**/doc/**",
  "**/examples/**",

  // Build artifacts and dependencies
  "**/vendor/**",
  "**/third-party/**",
  "**/external/**",
  "**/libs/**", // This might be too aggressive - adjust as needed

  // Assets
  "**/assets/**",
  "**/static/**",
  "**/images/**",
  "**/img/**",
  "**/videos/**",
  "**/audio/**",
  "**/fonts/**",
  "**/locales/**",
  "**/i18n/**",
  "**/l10n/**",

  // Generated files directories
  "**/generated/**",
  "**/auto-generated/**",
  "**/gen/**",

  // Cache directories
  "**/.cache/**",
  "**/cache/**",
];

// Default binary/large file extensions to ignore
const DEFAULT_EXCLUDE_EXTS: string[] = [
  // Images
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".tiff",
  ".ico",
  ".svg",
  ".webp",

  // Audio
  ".mp3",
  ".wav",
  ".ogg",
  ".flac",
  ".aac",
  ".m4a",

  // Video
  ".mp4",
  ".webm",
  ".avi",
  ".mov",
  ".wmv",
  ".flv",
  ".mkv",

  // Compiled
  ".dll",
  ".so",
  ".dylib",
  ".a",
  ".lib",
  ".obj",
  ".o",
  ".class",
  ".pyc",
  ".pyo",

  // Compressed
  ".zip",
  ".tar",
  ".gz",
  ".7z",
  ".rar",
  ".bz2",
  ".xz",

  // Documents
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",

  // Database/data files
  ".db",
  ".sqlite",
  ".sqlite3",
  ".mdb",
  ".csv",
  ".tsv",
  ".dat",
  ".bin",

  // Font files
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
  ".eot",

  // Other binary formats
  ".exe",
  ".dmg",
  ".iso",
  ".img",

  // Large text formats
  ".map",
  ".min.js",
  ".min.css",
];

// Default file extensions to include
const DEFAULT_INCLUDE_EXTS: string[] = [
  // JavaScript/TypeScript
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".vue",

  // Server-side
  ".py",
  ".rb",
  ".go",
  ".java",
  ".php",
  ".rs",
  ".c",
  ".cpp",
  ".h",
  ".cs",
  ".swift",

  // Web
  ".html",
  ".css",
  ".scss",
  ".sass",
  ".less",

  // Config
  ".json",
  ".yml",
  ".yaml",
  ".toml",
  ".xml",
  ".ini",
  ".env.example",

  // Doc/Markdown
  ".md",
  ".markdown",
  ".txt",
];

// Default files to always include
const DEFAULT_INCLUDE_FILES: string[] = [
  // Package files
  "package.json",
  "composer.json",
  "go.mod",
  "Cargo.toml",
  "Gemfile",
  "requirements.txt",
  "pyproject.toml",
  "build.gradle",
  "pom.xml",

  // Config files
  ".gitignore",
  "tsconfig.json",
  "webpack.config.js",
  "rollup.config.js",
  "vite.config.js",
  "jest.config.js",
  "babel.config.js",
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.json",

  // Docker files
  "docker-compose.yml",
  "Dockerfile",

  // Readme and main docs
  "README.md",
  "CONTRIBUTING.md",
  "LICENSE",
];

// Default files to always exclude
const DEFAULT_EXCLUDE_FILES: string[] = [
  // Lock files (large and not useful for context)
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "composer.lock",
  "Cargo.lock",
  "Gemfile.lock",

  // Generated/minified files
  "*.min.js",
  "*.min.css",
  "*.bundle.js",
  "*.bundle.css",

  // Large data files
  "*.pb",
  "*.d.ts", // TypeScript declaration files are often generated
];

// Size thresholds
const MAX_INDIVIDUAL_FILE_SIZE = 500 * 1024; // 500KB max individual file size
const MAX_TOTAL_FILES = 100; // Maximum number of files to process
const SMALL_FILE_PREFERENCE_THRESHOLD = 50 * 1024; // Prefer files smaller than 50KB

// Setup command-line options
function setupProgram(): ProgramOptions {
  program
    .name("llm-context")
    .description("Intelligently collect code from your project for LLM context")
    .version("0.1.1")
    .option("-d, --directory <dir>", "Root directory to scan", process.cwd())
    .option("-i, --ignore <patterns...>", "Additional patterns to ignore")
    .option("-e, --extensions <extensions...>", "File extensions to include")
    .option("-f, --files <files...>", "Specific files to include")
    .option("-x, --exclude <files...>", "Specific files to exclude")
    .option("-l, --limit <size>", "Size limit in KB (default: 50KB)", "50")
    .option(
      "-t, --tokens <num>",
      "Approximate token limit (default: 100000)",
      "100000"
    )
    .option("--no-copy", "Don't copy to clipboard, print to stdout instead")
    .option("--tree", "Include file tree in the output")
    .option(
      "--list-only",
      "Only list files that would be included without content"
    )
    .option("--respect-gitignore", "Respect .gitignore rules", true)
    .option("--dry-run", "Show what would be copied without copying")
    .option("--summary", "Show only summary without copying")
    .option("--interactive", "Interactive mode to select files")
    .option("--smart", "Smart mode to prioritize important files", true) // Enabled by default now
    .option(
      "--strip-comments",
      "Strip comments from code to reduce token usage",
      true // Enabled by default now
    )
    .option(
      "--recent <days>",
      "Only include files modified in the last N days",
      "0"
    )
    .option(
      "--max-file-size <size>",
      "Maximum size for a single file in KB",
      (MAX_INDIVIDUAL_FILE_SIZE / 1024).toString() // Default to 500KB
    )
    .option(
      "--truncate-large-files",
      "Truncate files larger than max-file-size instead of skipping"
    )
    .option("--save-config <name>", "Save current configuration as a profile")
    .option("--load-config <name>", "Load a saved configuration profile")
    .option(
      "--optimize-tokens",
      "Optimize token usage (strips comments, trims whitespace)",
      true // Enabled by default now
    )
    .option(
      "--summarize-large-files",
      "Include auto-generated summaries of large files",
      true // Enabled by default now
    )
    .option(
      "--llm <name>",
      "Optimize output for specific LLM (gpt-4, claude, etc.)",
      "gpt-4"
    )
    .option(
      "--redact-credentials",
      "Automatically redact API keys and credentials",
      true
    )
    .option(
      "--no-redact-credentials",
      "Don't redact credentials (use with caution)"
    )
    .option("--verbose", "Show more detailed output")
    .option(
      "--max-files <num>",
      "Maximum number of files to include",
      MAX_TOTAL_FILES.toString()
    )
    .option("--skip-binary", "Skip binary files", true) // Enabled by default now
    .option(
      "--force-utf8",
      "Force UTF-8 encoding and skip invalid files",
      true
    ); // Enabled by default now

  program.parse(process.argv);
  return program.opts() as ProgramOptions;
}

// Check if a file is likely binary
function isLikelyBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  // Check against binary extensions list
  return DEFAULT_EXCLUDE_EXTS.includes(ext);
}

// Main function
async function main(): Promise<void> {
  let options = setupProgram();

  console.log(chalk.cyan("LLM-Context: Preparing project context..."));

  // Load configuration if specified
  if (options.loadConfig) {
    const loadedOptions = loadConfig(options.loadConfig);
    if (loadedOptions) {
      // Merge with command line options (command line takes precedence)
      options = { ...loadedOptions, ...options };
    }
  }

  // Save configuration if specified
  if (options.saveConfig) {
    saveConfig(options, options.saveConfig);
  }

  // Convert KB to bytes
  options.limitBytes = parseInt(options.limit) * 1024;
  options.tokenLimitChars = Math.floor(parseInt(options.tokens) * 4); // Rough char approximation
  options.maxFileSizeBytes =
    parseInt(
      options.maxFileSize || (MAX_INDIVIDUAL_FILE_SIZE / 1024).toString()
    ) * 1024;
  options.maxFiles = parseInt(
    (typeof options.maxFiles === "number"
      ? options.maxFiles.toString()
      : options.maxFiles) || MAX_TOTAL_FILES.toString()
  );

  // Find files
  const defaultPatterns: DefaultPatterns = {
    DEFAULT_IGNORE_DIRS,
    DEFAULT_INCLUDE_EXTS,
    DEFAULT_INCLUDE_FILES,
    DEFAULT_EXCLUDE_FILES,
  };

  const files = await findFiles(options, defaultPatterns);

  if (files.length === 0) {
    console.log(chalk.yellow("No files found matching the criteria."));
    return;
  }

  console.log(
    chalk.cyan(
      `Found ${files.length} matching files, filtering for most relevant...`
    )
  );

  // Skip binary files if the option is enabled
  let filteredFiles = files;
  if (options.skipBinary) {
    filteredFiles = files.filter((file) => !isLikelyBinaryFile(file));
    if (filteredFiles.length < files.length) {
      console.log(
        chalk.yellow(
          `Filtered out ${
            files.length - filteredFiles.length
          } likely binary files`
        )
      );
    }
  }

  // Apply max file size filter first to avoid loading large files into memory
  const spinner = ora("Reading and filtering files...").start();

  const readableFiles: string[] = [];
  const fileContents: string[] = [];
  const fileStats: FileStat[] = [];

  // First pass: Check sizes without loading full content
  for (const file of filteredFiles) {
    const fullPath = path.join(options.directory, file);

    try {
      const stat = fs.statSync(fullPath);

      // Skip large files
      if (stat.size > options.maxFileSizeBytes) {
        if (options.verbose) {
          spinner.info(`Skipping large file: ${file} (${filesize(stat.size)})`);
        }
        continue;
      }

      // Skip empty files
      if (stat.size === 0) {
        continue;
      }

      readableFiles.push(file);

      // Keep track of stats without reading content yet
      const fileStat: FileStat = {
        path: file,
        size: stat.size,
        tokens: Math.ceil(stat.size / 4), // Rough approximation
      };

      fileStats.push(fileStat);
    } catch (error) {
      // Skip files that can't be read
      if (options.verbose) {
        spinner.info(`Cannot read file stats: ${file}`);
      }
    }
  }

  // Sort by file size (ascending - prefer smaller files) and limit number of files
  const sortedIndices = fileStats
    .map((_, index) => index)
    .sort((a, b) => {
      // Prefer important files
      const fileA = readableFiles[a];
      const fileB = readableFiles[b];

      // Main config files get priority
      const isConfigA = DEFAULT_INCLUDE_FILES.includes(path.basename(fileA));
      const isConfigB = DEFAULT_INCLUDE_FILES.includes(path.basename(fileB));

      if (isConfigA && !isConfigB) return -1;
      if (!isConfigA && isConfigB) return 1;

      // Prefer small files, but treat all files under threshold equally
      const sizeA = fileStats[a].size;
      const sizeB = fileStats[b].size;

      const isSmallA = sizeA < SMALL_FILE_PREFERENCE_THRESHOLD;
      const isSmallB = sizeB < SMALL_FILE_PREFERENCE_THRESHOLD;

      if (isSmallA && !isSmallB) return -1;
      if (!isSmallA && isSmallB) return 1;

      // For otherwise equal priority, sort by size
      return sizeA - sizeB;
    })
    .slice(0, options.maxFiles);

  // Second pass: Read actual file contents for the filtered set
  let totalSize = 0;
  let skippedFiles = 0;

  for (const index of sortedIndices) {
    const file = readableFiles[index];
    const fullPath = path.join(options.directory, file);

    try {
      // Check if adding this file would exceed the size limit
      if (totalSize + fileStats[index].size > options.limitBytes) {
        skippedFiles++;
        continue;
      }

      // Attempt to read the file with UTF-8 encoding
      let content: string;
      try {
        content = fs.readFileSync(fullPath, "utf8");
      } catch (error) {
        if (options.forceUtf8) {
          // Skip files that can't be read as UTF-8
          if (options.verbose) {
            spinner.info(`Skipping non-UTF8 file: ${file}`);
          }
          skippedFiles++;
          continue;
        } else {
          // Try with binary encoding and convert
          const buffer = fs.readFileSync(fullPath);
          // Replace invalid UTF-8 sequences with replacement character
          content = buffer
            .toString("utf8", 0, buffer.length)
            .replace(/[^\x00-\x7F]/g, "?");
        }
      }

      totalSize += content.length;
      fileContents.push(content);

      // Update tokens count based on actual content
      fileStats[index].tokens = Math.ceil(content.length / 4);
    } catch (error) {
      // Skip files that can't be read
      skippedFiles++;
      if (options.verbose) {
        spinner.info(`Cannot read file: ${file}`);
      }
    }
  }

  // Prepare the final lists of files and stats
  const finalFiles: string[] = [];
  const finalContents: string[] = [];
  const finalStats: FileStat[] = [];

  for (let i = 0; i < sortedIndices.length; i++) {
    if (i < fileContents.length) {
      // This check prevents array index errors
      const index = sortedIndices[i];
      finalFiles.push(readableFiles[index]);
      finalStats.push(fileStats[index]);
    }
  }

  // Match up the contents array to final files
  for (let i = 0; i < fileContents.length; i++) {
    finalContents.push(fileContents[i]);
  }

  spinner.succeed(
    `Read ${finalFiles.length} files, total size: ${chalk.bold(
      filesize(totalSize)
    )}`
  );

  if (skippedFiles > 0) {
    console.log(
      chalk.yellow(
        `Skipped ${skippedFiles} files due to size limits or encoding issues`
      )
    );
  }

  // Apply smart prioritization if enabled
  let processedFiles = finalFiles;
  let processedContents = finalContents;
  let processedStats = finalStats;

  if (options.smart) {
    spinner.start("Applying smart prioritization...");
    const result = prioritizeFiles(
      finalFiles,
      finalContents,
      finalStats,
      options
    );
    processedFiles = result.files;
    processedContents = result.fileContents;
    processedStats = result.fileStats;
    spinner.succeed("Smart prioritization applied");
  }

  // Check if size limit is exceeded
  if (totalSize > options.limitBytes) {
    console.log(
      chalk.yellow(
        `Warning: Total size (${filesize(
          totalSize
        )}) exceeds the specified limit (${filesize(options.limitBytes)})`
      )
    );
  }

  // Check if token limit is exceeded
  const approxTokens = Math.ceil(totalSize / 4);
  if (totalSize > options.tokenLimitChars) {
    console.log(
      chalk.yellow(
        `Warning: Approximate token count (~${approxTokens}) exceeds the specified limit (${options.tokens})`
      )
    );
  }

  // Sort files by size for display
  const sortedStats = [...processedStats].sort((a, b) => b.size - a.size);

  // Show summary
  console.log(chalk.cyan("File Summary:"));
  const maxDisplayFiles = Math.min(10, sortedStats.length);
  sortedStats.slice(0, maxDisplayFiles).forEach((stat) => {
    console.log(
      `- ${stat.path}: ${filesize(stat.size)} (~${stat.tokens} tokens)`
    );
  });

  if (sortedStats.length > maxDisplayFiles) {
    console.log(`... and ${sortedStats.length - maxDisplayFiles} more files`);
  }

  console.log(
    chalk.cyan(
      `\nTotal: ${processedFiles.length} files, ${filesize(
        totalSize
      )} (~${approxTokens} tokens)`
    )
  );

  // Stop here if it's a dry run or summary only
  if (options.dryRun || options.summary) {
    return;
  }

  // Interactive mode
  let selectedFiles = processedFiles;
  let selectedContents = processedContents;
  let selectedStats = processedStats;

  if (options.interactive) {
    const selectedIndices = await interactiveFileSelection(
      processedFiles,
      processedStats
    );
    selectedFiles = selectedIndices.map((i) => processedFiles[i]);
    selectedContents = selectedIndices.map((i) => processedContents[i]);
    selectedStats = selectedIndices.map((i) => processedStats[i]);

    console.log(
      chalk.green(`Selected ${selectedFiles.length} files for inclusion`)
    );
  }

  // Format output
  const formattedOutput = formatOutput(
    selectedFiles,
    selectedContents,
    options,
    selectedStats
  );

  // Redact credentials if enabled
  let finalOutput = formattedOutput;
  if (options.redactCredentials) {
    spinner.start("Checking for and redacting credentials...");
    let credentialsFoundCount = 0;

    // Process each file content for credentials
    const redactedContents: string[] = [];
    selectedFiles.forEach((file, index) => {
      const content = selectedContents[index];
      const result = redactCredentials(content, file);
      redactedContents.push(result.content);
      if (result.credentialsFound) {
        credentialsFoundCount++;
      }
    });

    // Regenerate output with redacted content if any credentials were found
    if (credentialsFoundCount > 0) {
      spinner.succeed(`Redacted credentials in ${credentialsFoundCount} files`);
      finalOutput = formatOutput(
        selectedFiles,
        redactedContents,
        options,
        selectedStats
      );
    } else {
      spinner.succeed("No credentials found");
    }
  }

  // Copy to clipboard or print to stdout
  if (options.copy) {
    const copySpinner = ora("Copying to clipboard...").start();
    try {
      await clipboardy.write(finalOutput);
      copySpinner.succeed("Copied to clipboard");
    } catch (error) {
      const err = error as Error;
      copySpinner.fail("Failed to copy to clipboard");
      console.error(chalk.red(err.message));
      console.log(chalk.yellow("Writing to stdout instead:"));
      console.log(finalOutput);
    }
  } else {
    console.log(finalOutput);
  }
}

// Export for use in bin file
export { main };
