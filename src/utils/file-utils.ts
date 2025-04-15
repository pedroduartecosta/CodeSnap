import fs from "fs";
import path from "path";
import * as glob from "glob";
import chalk from "chalk";
import ora from "ora";
import ignore from "ignore";
import minimatch from "minimatch";
import { execSync } from "child_process";
import {
  ProgramOptions,
  DefaultPatterns,
  FileStat,
  PrioritizedResult,
  ScoredFile,
} from "../types";

// High value files that should be prioritized
export const HIGH_PRIORITY_FILES: string[] = [
  "package.json",
  "tsconfig.json",
  "next.config.js",
  "webpack.config.js",
  "vite.config.js",
  "rollup.config.js",
  "jest.config.js",
  "babel.config.js",
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.json",
  "docker-compose.yml",
  "Dockerfile",
  "Makefile",
  "go.mod",
  "go.sum",
  "Cargo.toml",
  "pyproject.toml",
  "requirements.txt",
  "setup.py",
  "build.gradle",
  "pom.xml",
  "app.config.ts",
  "project.config.json",
];

// Entry point files that should be prioritized
export const ENTRY_POINT_PATTERNS: string[] = [
  "index.js",
  "index.ts",
  "index.tsx",
  "index.jsx",
  "main.js",
  "main.ts",
  "main.py",
  "app.js",
  "app.ts",
  "app.py",
  "server.js",
  "server.ts",
  "src/index.*",
  "src/main.*",
  "src/app.*",
];

/**
 * Find files that match the given options
 * @param options Program options
 * @param defaults Default patterns
 * @returns Promise resolving to an array of file paths
 */
async function findFiles(
  options: ProgramOptions,
  defaults: DefaultPatterns
): Promise<string[]> {
  const spinner = ora("Finding relevant files...").start();

  try {
    const rootDir = options.directory;

    // Set up ignores
    const ignoreList = [...defaults.DEFAULT_IGNORE_DIRS];
    if (options.ignore) {
      ignoreList.push(...options.ignore);
    }

    // Add file extensions filter
    const extensions = options.extensions || defaults.DEFAULT_INCLUDE_EXTS;

    // Get files to include
    const includeFiles = options.files || defaults.DEFAULT_INCLUDE_FILES;

    // Get files to exclude
    const excludeFiles = options.exclude || defaults.DEFAULT_EXCLUDE_FILES;

    // Check if we should only include recently modified files
    let recentFilter: number | null = null;
    if (options.recent && parseInt(options.recent) > 0) {
      const days = parseInt(options.recent);
      const cutoffTime = new Date();
      cutoffTime.setDate(cutoffTime.getDate() - days);
      recentFilter = cutoffTime.getTime();
    }

    // Use gitignore if present and option is enabled
    let ig = ignore();
    if (options.respectGitignore) {
      try {
        const gitignorePath = path.join(rootDir, ".gitignore");
        if (fs.existsSync(gitignorePath)) {
          const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
          ig = ignore().add(gitignoreContent);
        }
      } catch (error) {
        spinner.info("Could not load .gitignore, continuing without it");
      }
    }

    // Get all files
    const allFiles = glob.sync("**/*", {
      cwd: rootDir,
      nodir: true,
      dot: true,
      ignore: ignoreList,
    });

    // Filter files based on extensions, include files, and exclude files
    const filteredFiles = allFiles.filter((file) => {
      const ext = path.extname(file);
      const basename = path.basename(file);
      const fullPath = path.join(rootDir, file);

      // Skip if explicitly excluded
      if (excludeFiles.includes(basename)) {
        return false;
      }

      // Include if it's in the include files list
      if (includeFiles.includes(basename)) {
        // Still check recent filter if enabled
        if (recentFilter) {
          try {
            const stats = fs.statSync(fullPath);
            return stats.mtimeMs >= recentFilter;
          } catch (e) {
            return false;
          }
        }
        return true;
      }

      // Include if the extension is in the list
      if (extensions.includes(ext)) {
        // Check against gitignore if enabled
        if (options.respectGitignore && ig.ignores(file)) {
          return false;
        }

        // Check recent filter if enabled
        if (recentFilter) {
          try {
            const stats = fs.statSync(fullPath);
            return stats.mtimeMs >= recentFilter;
          } catch (e) {
            return false;
          }
        }

        return true;
      }

      return false;
    });

    spinner.succeed(`Found ${filteredFiles.length} relevant files`);
    return filteredFiles;
  } catch (error) {
    spinner.fail("Error finding files");
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}

/**
 * Get the file tree of a directory
 * @param rootDir Directory to get the file tree for
 * @returns String representation of the file tree
 */
function getFileTree(rootDir: string): string {
  try {
    return execSync("tree --gitignore", { cwd: rootDir, encoding: "utf8" });
  } catch (error) {
    try {
      // Fallback if tree command is not available
      return execSync(
        'find . -type d -not -path "*/\\.*" | sort | sed -e "s/[^-][^\\/]*\\//  |/g" -e "s/|\\([^ ]\\)/|-\\1/"',
        { cwd: rootDir, encoding: "utf8" }
      );
    } catch (innerError) {
      return "Note: Could not generate file tree (tree command not available)";
    }
  }
}

/**
 * Prioritize files based on importance
 * @param files Array of file paths
 * @param fileContents Array of file contents
 * @param fileStats Array of file statistics
 * @param options Program options
 * @returns Object containing prioritized files, contents, and stats
 */
function prioritizeFiles(
  files: string[],
  fileContents: string[],
  fileStats: FileStat[],
  options: ProgramOptions
): PrioritizedResult {
  // Create a score for each file
  const scoredFiles: ScoredFile[] = files.map((file, index) => {
    const basename = path.basename(file);
    const content = fileContents[index];
    const stats = fileStats[index];

    let score = 0;

    // Prioritize config files and entry points
    if (HIGH_PRIORITY_FILES.includes(basename)) {
      score += 100;
    }

    // Prioritize likely entry points
    for (const pattern of ENTRY_POINT_PATTERNS) {
      if (minimatch(file, pattern)) {
        score += 80;
        break;
      }
    }

    // Prioritize files in src/ or app/ directories
    if (file.startsWith("src/") || file.startsWith("app/")) {
      score += 40;
    }

    // Prefer smaller files (inverse proportion to size)
    score += Math.max(0, 30 - Math.floor(stats.size / 1000));

    // Prioritize files with imports/requires (likely more connected)
    const importCount = (content.match(/import\s+|require\s*\(/g) || []).length;
    score += Math.min(20, importCount * 2);

    // Prioritize recently modified files if not already filtering by recency
    if (!options.recent) {
      try {
        const fullPath = path.join(options.directory, file);
        const fStats = fs.statSync(fullPath);
        const ageInDays = (Date.now() - fStats.mtimeMs) / (1000 * 60 * 60 * 24);
        if (ageInDays < 7) {
          score += Math.max(0, 20 - Math.floor(ageInDays * 3));
        }
      } catch (e) {
        // Ignore errors
      }
    }

    return { file, content, stats, score };
  });

  // Sort by score (highest first)
  scoredFiles.sort((a, b) => b.score - a.score);

  // Extract the sorted arrays
  const sortedFiles = scoredFiles.map((item) => item.file);
  const sortedContents = scoredFiles.map((item) => item.content);
  const sortedStats = scoredFiles.map((item) => item.stats);

  return {
    files: sortedFiles,
    fileContents: sortedContents,
    fileStats: sortedStats,
  };
}

export { findFiles, getFileTree, prioritizeFiles };
