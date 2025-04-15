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

// Default directories to ignore
const DEFAULT_IGNORE_DIRS: string[] = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/public/**",
  "**/bin/**",
  "**/binaries/**",
  "**/test/**",
  "**/tests/**",
  "**/.git/**",
  "**/.github/**",
  "**/coverage/**",
];

// Default file extensions to include
const DEFAULT_INCLUDE_EXTS: string[] = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".vue",
  ".py",
  ".rb",
  ".go",
  ".java",
  ".php",
  ".c",
  ".cpp",
  ".h",
  ".rs",
  ".swift",
];

// Default files to always include
const DEFAULT_INCLUDE_FILES: string[] = [
  "package.json",
  "composer.json",
  "go.mod",
  "Cargo.toml",
  "Gemfile",
  "requirements.txt",
  "pyproject.toml",
  "build.gradle",
  "pom.xml",
  ".gitignore",
  "README.md",
];

// Default files to always exclude
const DEFAULT_EXCLUDE_FILES: string[] = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "composer.lock",
  "Cargo.lock",
  "Gemfile.lock",
];

// Setup command-line options
function setupProgram(): ProgramOptions {
  program
    .name("llm-context")
    .description("Intelligently collect code from your project for LLM context")
    .version("0.1.0")
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
    .option("--smart", "Smart mode to prioritize important files")
    .option(
      "--strip-comments",
      "Strip comments from code to reduce token usage"
    )
    .option(
      "--recent <days>",
      "Only include files modified in the last N days",
      "0"
    )
    .option(
      "--max-file-size <size>",
      "Maximum size for a single file in KB",
      "10"
    )
    .option(
      "--truncate-large-files",
      "Truncate files larger than max-file-size instead of skipping"
    )
    .option("--save-config <name>", "Save current configuration as a profile")
    .option("--load-config <name>", "Load a saved configuration profile")
    .option(
      "--optimize-tokens",
      "Optimize token usage (strips comments, trims whitespace)"
    )
    .option(
      "--summarize-large-files",
      "Include auto-generated summaries of large files"
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
    .option("--verbose", "Show more detailed output");

  program.parse(process.argv);
  return program.opts() as ProgramOptions;
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

  // List files if list-only option is provided
  if (options.listOnly) {
    console.log(chalk.cyan("Files that would be included:"));
    files.forEach((file) => {
      console.log(`- ${file}`);
    });
    return;
  }

  // Calculate total size and read file contents
  const spinner = ora("Reading file contents...").start();
  let totalSize = 0;
  const fileContents: string[] = [];
  const fileStats: FileStat[] = [];

  for (const file of files) {
    const fullPath = path.join(options.directory, file);
    try {
      const content = fs.readFileSync(fullPath, "utf8");
      const stats: FileStat = {
        path: file,
        size: content.length,
        tokens: Math.ceil(content.length / 4), // Very rough approximation
      };

      totalSize += content.length;
      fileContents.push(content);
      fileStats.push(stats);
    } catch (error) {
      spinner.warn(`Could not read file: ${file}`);
    }
  }

  spinner.succeed(
    `Read ${files.length} files, total size: ${chalk.bold(filesize(totalSize))}`
  );

  // Apply smart prioritization if enabled
  let processedFiles = files;
  let processedContents = fileContents;
  let processedStats = fileStats;

  if (options.smart) {
    spinner.start("Applying smart prioritization...");
    const result = prioritizeFiles(files, fileContents, fileStats, options);
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
  const sortedStats = [...fileStats].sort((a, b) => b.size - a.size);

  // Show summary
  console.log(chalk.cyan("File Summary:"));
  sortedStats.slice(0, 10).forEach((stat) => {
    console.log(
      `- ${stat.path}: ${filesize(stat.size)} (~${stat.tokens} tokens)`
    );
  });

  if (sortedStats.length > 10) {
    console.log(`... and ${sortedStats.length - 10} more files`);
  }

  console.log(
    chalk.cyan(
      `\nTotal: ${files.length} files, ${filesize(
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
