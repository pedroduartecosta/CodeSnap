#!/usr/bin/env node

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
import {
  ProgramOptions,
  DefaultPatterns,
  FileStat,
  RedactedCredential,
} from "./types";
import {
  DEFAULT_IGNORE_DIRS,
  DEFAULT_INCLUDE_EXTS,
  DEFAULT_INCLUDE_FILES,
  DEFAULT_EXCLUDE_FILES,
  MAX_INDIVIDUAL_FILE_SIZE,
  MAX_TOTAL_FILES,
  SMALL_FILE_PREFERENCE_THRESHOLD,
  DEFAULT_EXCLUDE_EXTS,
} from "./utils/constants";

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
    .option("--smart", "Smart mode to prioritize important files", true)
    .option(
      "--strip-comments",
      "Strip comments from code to reduce token usage",
      true
    )
    .option(
      "--recent <days>",
      "Only include files modified in the last N days",
      "0"
    )
    .option(
      "--max-file-size <size>",
      "Maximum size for a single file in KB",
      (MAX_INDIVIDUAL_FILE_SIZE / 1024).toString()
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
      true
    )
    .option(
      "--summarize-large-files",
      "Include auto-generated summaries of large files",
      true
    )
    .option(
      "--llm <name>",
      "Optimize output for specific LLM (gpt-4, claude, etc.)",
      "gpt-4"
    )
    // Change the default to true and invert the negative flag
    .option(
      "--redact-credentials",
      "Automatically redact API keys and credentials (default)",
      true
    )
    .option(
      "--no-redact-credentials",
      "Don't redact credentials (use with caution)"
    )
    // Make show-redacted work independently with a description that indicates redaction is default
    .option(
      "--show-redacted",
      "Show information about redacted credentials in the output"
    )
    .option("--verbose", "Show more detailed output")
    .option(
      "--max-files <num>",
      "Maximum number of files to include",
      MAX_TOTAL_FILES.toString()
    )
    .option("--skip-binary", "Skip binary files", true)
    .option(
      "--force-utf8",
      "Force UTF-8 encoding and skip invalid files",
      true
    );

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

  // Process redaction and collect redacted credentials
  let finalOutput = "";
  const allRedactedCredentials: RedactedCredential[] = [];

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

        // Collect redacted credentials if show-redacted is enabled
        if (options.showRedacted && result.redactedCredentials) {
          allRedactedCredentials.push(...result.redactedCredentials);
        }
      }
    });

    // Generate output with redacted contents
    spinner.succeed(
      credentialsFoundCount > 0
        ? `Redacted credentials in ${credentialsFoundCount} files`
        : "No credentials found"
    );

    finalOutput = formatOutput(
      selectedFiles,
      redactedContents,
      options,
      selectedStats
    );
  } else {
    // Format without redaction if explicitly disabled
    finalOutput = formatOutput(
      selectedFiles,
      selectedContents,
      options,
      selectedStats
    );
  }

  // Display redacted credentials in CLI if requested
  if (
    options.redactCredentials &&
    options.showRedacted &&
    allRedactedCredentials.length > 0
  ) {
    showRedactedCredentialsSummary(allRedactedCredentials, options.directory);
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

/**
 * Display a summary of redacted credentials in the console
 * @param redactedCredentials Array of redacted credential information
 * @param baseDir Base directory for relative path display
 */
function showRedactedCredentialsSummary(
  redactedCredentials: RedactedCredential[],
  baseDir: string
) {
  if (redactedCredentials.length === 0) return;

  console.log(chalk.yellow("\nRedacted Credentials Summary:"));
  console.log(chalk.yellow("---------------------------"));

  // Group by file
  const byFile: { [key: string]: RedactedCredential[] } = {};
  redactedCredentials.forEach((cred) => {
    const relativePath = path.relative(baseDir, cred.file);
    if (!byFile[relativePath]) byFile[relativePath] = [];
    byFile[relativePath].push(cred);
  });

  // Display by file
  Object.keys(byFile)
    .sort()
    .forEach((file) => {
      console.log(chalk.cyan(`\nFile: ${file}`));
      byFile[file].forEach((cred) => {
        console.log(
          `  - ${chalk.green(cred.type)} at line ${chalk.yellow(
            cred.line.toString()
          )}:${chalk.yellow(cred.column.toString())}: ${chalk.red(
            cred.partialValue
          )}`
        );
      });
    });

  console.log(
    chalk.yellow(`\nTotal credentials redacted: ${redactedCredentials.length}`)
  );
  console.log(chalk.yellow("---------------------------\n"));
}

// Export for use in bin file
export { main };
