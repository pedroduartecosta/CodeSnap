// src/utils/file-utils.ts - Consolidated file utilities

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
  FileTypeInfo,
  ProjectStats,
  InfrastructureDetection,
} from "../types";

import {
  BINARY_EXTENSIONS,
  HIGH_PRIORITY_FILES,
  ENTRY_POINT_PATTERNS,
  IMPORTANT_FOLDERS,
  FILE_SIZE_LIMITS,
  DEFAULT_INCLUDE_EXTS,
  DEFAULT_INCLUDE_FILES,
  DEFAULT_EXCLUDE_FILES,
  EXPANDED_CODE_EXTENSIONS,
  NO_EXTENSION_IMPORTANT_FILES,
} from "./constants";

/**
 * Check if a file is likely a binary file based on extension
 * @param filePath The path to the file
 * @returns Boolean indicating if the file is likely binary
 */
export function isLikelyBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.includes(ext);
}

/**
 * Auto-detect code files based on content and naming patterns
 * @param filePath File path to check
 * @param content File content (if available)
 * @returns Boolean indicating if file appears to be code
 */
export function isLikelyCodeFile(filePath: string, content?: string): boolean {
  const basename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // Check for known code file extensions (already covered by DEFAULT_INCLUDE_EXTS)

  // Check for common config file patterns regardless of extension
  if (
    basename.includes("config") ||
    basename.includes("conf") ||
    basename.endsWith(".yaml") ||
    basename.endsWith(".yml") ||
    basename.endsWith(".json") ||
    basename.endsWith(".tf") || // Terraform
    basename.endsWith(".tfvars") || // Terraform variables
    basename.endsWith(".hcl") || // HashiCorp Configuration Language
    basename.endsWith(".toml") ||
    basename.endsWith(".ini") ||
    basename.endsWith(".env") ||
    basename === "Dockerfile" ||
    basename === "Makefile" ||
    basename === "docker-compose.yml" ||
    basename === "docker-compose.yaml" ||
    basename.endsWith(".tpl") || // Template files
    basename.endsWith(".tmpl") ||
    basename.endsWith(".j2") || // Jinja2 templates
    basename.endsWith(".template")
  ) {
    return true;
  }

  // If we have content, do basic heuristic checks for code-like patterns
  if (content) {
    // Check for common programming constructs
    const codePatterns = [
      /function\s+\w+\s*\(/, // function declarations
      /class\s+\w+/, // class declarations
      /def\s+\w+\s*\(/, // Python functions
      /^\s*import\s+/m, // import statements
      /^\s*from\s+.+\s+import/m, // Python imports
      /^\s*require\(/m, // Node.js requires
      /^\s*\w+\s*=\s*require\(/m, // Node.js variable requires
      /^\s*module\s+\"/m, // Terraform modules
      /^\s*resource\s+\"/m, // Terraform resources
      /^\s*provider\s+\"/m, // Terraform providers
      /^\s*variable\s+\"/m, // Terraform variables
      /^\s*output\s+\"/m, // Terraform outputs
      /^\s*apiVersion:/m, // Kubernetes manifests
      /^\s*kind:/m, // Kubernetes manifests
      /^\s*metadata:/m, // Kubernetes manifests
      /^\s*spec:/m, // Kubernetes manifests
    ];

    for (const pattern of codePatterns) {
      if (pattern.test(content)) {
        return true;
      }
    }
  }

  // For extensions we don't recognize but might be code
  if (ext && ext.length > 1 && !isLikelyBinaryFile(filePath)) {
    // Check if it looks like a reasonable extension (2-4 chars)
    if (ext.length >= 2 && ext.length <= 5) {
      // Peek at the first few bytes of the file to see if it's text-like
      try {
        if (!content) {
          const sample = fs
            .readFileSync(filePath, { encoding: "utf8", flag: "r" })
            .slice(0, 500);
          // If it contains mostly printable characters, it's likely text/code
          const printableRatio =
            sample.replace(/[^\x20-\x7E]/g, "").length / sample.length;
          if (printableRatio > 0.9) {
            return true;
          }
        } else {
          // Use the content we already have
          const sample = content.slice(0, 500);
          const printableRatio =
            sample.replace(/[^\x20-\x7E]/g, "").length / sample.length;
          if (printableRatio > 0.9) {
            return true;
          }
        }
      } catch (error) {
        // If we can't read the file, assume it's not code
        return false;
      }
    }
  }

  return false;
}

/**
 * Get detailed file type information
 * @param filePath The path to the file
 * @param fileSize The size of the file in bytes
 * @returns Object with file type information
 */
export function getFileTypeInfo(
  filePath: string,
  fileSize: number
): FileTypeInfo {
  const basename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // Check if it's a binary file
  const isBinary = isLikelyBinaryFile(filePath);

  // Check if it's a large file
  const isLarge = fileSize > FILE_SIZE_LIMITS.MAX_INDIVIDUAL_FILE_SIZE;

  // Check if it's a config file
  const isConfig =
    HIGH_PRIORITY_FILES.includes(basename) ||
    HIGH_PRIORITY_FILES.some((pattern) => minimatch(basename, pattern));

  // Check if it's an entry point
  const isEntry = ENTRY_POINT_PATTERNS.some((pattern) =>
    minimatch(filePath, pattern)
  );

  // Check if it's in a priority folder
  const isPriority =
    IMPORTANT_FOLDERS.some((folder) => filePath.startsWith(folder)) ||
    isConfig ||
    isEntry;

  // Estimate tokens (roughly 4 characters per token)
  const estimatedTokens = Math.ceil(fileSize / 4);

  return {
    isBinary,
    isLarge,
    isConfig,
    isPriority,
    isEntry,
    estimatedTokens,
  };
}

/**
 * Detect if a project is likely an infrastructure-as-code project
 * @param rootDir Root directory of the project
 * @returns Object with detected infrastructure types
 */
export function detectInfrastructureProject(
  rootDir: string
): InfrastructureDetection {
  const result = {
    isTerraform: false,
    isKubernetes: false,
    isAnsible: false,
    isDocker: false,
    isPacker: false,
  };

  try {
    // Check for Terraform files
    if (
      glob.sync("**/*.tf", { cwd: rootDir }).length > 0 ||
      glob.sync("**/*.tfvars", { cwd: rootDir }).length > 0
    ) {
      result.isTerraform = true;
    }

    // Check for Kubernetes manifests
    const k8sPatterns = [
      "**/deployment.yaml",
      "**/service.yaml",
      "**/ingress.yaml",
      "**/configmap.yaml",
      "**/secret.yaml",
      "**/Chart.yaml", // Helm charts
      "**/*.helmignore",
    ];

    for (const pattern of k8sPatterns) {
      if (glob.sync(pattern, { cwd: rootDir }).length > 0) {
        result.isKubernetes = true;
        break;
      }
    }

    // Check for Ansible files
    if (
      glob.sync("**/playbook.yml", { cwd: rootDir }).length > 0 ||
      glob.sync("**/ansible.cfg", { cwd: rootDir }).length > 0 ||
      glob.sync("**/inventory", { cwd: rootDir }).length > 0
    ) {
      result.isAnsible = true;
    }

    // Check for Docker files
    if (
      glob.sync("**/Dockerfile", { cwd: rootDir }).length > 0 ||
      glob.sync("**/docker-compose.yml", { cwd: rootDir }).length > 0 ||
      glob.sync("**/docker-compose.yaml", { cwd: rootDir }).length > 0
    ) {
      result.isDocker = true;
    }

    // Check for Packer files
    if (
      glob.sync("**/*.pkr.hcl", { cwd: rootDir }).length > 0 ||
      glob
        .sync("**/*.json", {
          cwd: rootDir,
          ignore: ["**/package.json", "**/package-lock.json"],
        })
        .some((file) => {
          try {
            const content = fs.readFileSync(path.join(rootDir, file), "utf8");
            return (
              content.includes('"builders"') &&
              content.includes('"provisioners"')
            );
          } catch {
            return false;
          }
        })
    ) {
      result.isPacker = true;
    }

    return result;
  } catch (error) {
    // In case of any error, return the default result
    return result;
  }
}

/**
 * Adjust file priorities based on detected project type
 * @param options Program options
 * @param rootDir Root directory
 */
export function adjustPrioritiesForProjectType(
  options: ProgramOptions,
  rootDir: string
): void {
  if (options.infrastructure || options.mode === "infra") {
    // Explicitly set to prioritize infrastructure code
    options.extensions = [
      ...(options.extensions || []),
      ".tf",
      ".tfvars",
      ".hcl",
      ".yaml",
      ".yml",
      ".json",
      ".tpl",
      ".j2",
      "Dockerfile",
    ];
    return;
  }

  // Auto-detect project type if auto-detect is enabled
  if (options.autoDetect) {
    const infraDetection = detectInfrastructureProject(rootDir);

    // If this is an infrastructure project, adjust priorities
    if (
      infraDetection.isTerraform ||
      infraDetection.isKubernetes ||
      infraDetection.isAnsible ||
      infraDetection.isDocker ||
      infraDetection.isPacker
    ) {
      console.log(
        chalk.blue(
          "Detected infrastructure-as-code project. Adjusting file priorities..."
        )
      );

      // Add relevant extensions to the list
      if (!options.extensions) {
        options.extensions = [...DEFAULT_INCLUDE_EXTS];
      }

      if (infraDetection.isTerraform) {
        console.log(chalk.blue("- Terraform project detected"));
        options.extensions.push(".tf", ".tfvars", ".hcl");
      }

      if (infraDetection.isKubernetes) {
        console.log(chalk.blue("- Kubernetes manifests detected"));
        // Ensure yaml is included
        if (
          !options.extensions.includes(".yaml") &&
          !options.extensions.includes(".yml")
        ) {
          options.extensions.push(".yaml", ".yml");
        }
      }

      if (infraDetection.isAnsible) {
        console.log(chalk.blue("- Ansible project detected"));
        if (!options.extensions.includes(".yml")) {
          options.extensions.push(".yml");
        }
      }

      if (infraDetection.isDocker) {
        console.log(chalk.blue("- Docker configuration detected"));
        // Ensure Dockerfile and compose files are included
        options.files = [
          ...(options.files || []),
          "Dockerfile",
          "docker-compose.yml",
          "docker-compose.yaml",
        ];
      }

      if (infraDetection.isPacker) {
        console.log(chalk.blue("- Packer template detected"));
        options.extensions.push(".pkr.hcl");
      }
    }
  }
}

/**
 * Find files that match the given options with improved performance for large projects
 * @param options Program options
 * @param defaults Default patterns
 * @returns Promise resolving to an array of file paths
 */
export async function findFiles(
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

    // Performance optimization: limit maximum directory depth to prevent excessive recursion
    const maxDepth = 10; // Reasonable depth for most projects

    // Get all files with depth limit
    const globOptions = {
      cwd: rootDir,
      nodir: true,
      dot: true,
      ignore: ignoreList,
      depth: maxDepth, // Add depth limit
      follow: false, // Don't follow symlinks
      stats: false, // Don't need stats yet
    };

    // Use glob pattern with limited depth
    const allFiles = glob.sync("**/*", globOptions);

    // Check if we should only include recently modified files
    let recentFilter: number | null = null;
    if (options.recent && parseInt(options.recent) > 0) {
      const days = parseInt(options.recent);
      const cutoffTime = new Date();
      cutoffTime.setDate(cutoffTime.getDate() - days);
      recentFilter = cutoffTime.getTime();
    }

    // Create sets for faster lookups
    const extensionsSet = new Set(
      options.extensions || [
        ...defaults.DEFAULT_INCLUDE_EXTS,
        ...EXPANDED_CODE_EXTENSIONS,
      ]
    );
    const includeFilesSet = new Set([
      ...includeFiles,
      ...NO_EXTENSION_IMPORTANT_FILES,
    ]);
    const excludeFilesSet = new Set(excludeFiles);

    // Filter files based on extensions, include files, and exclude files
    // Use batch processing to handle large arrays efficiently
    const BATCH_SIZE = 1000;
    let filteredFiles: string[] = [];

    for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
      const batch = allFiles.slice(i, i + BATCH_SIZE);

      const batchResults = batch.filter((file) => {
        const ext = path.extname(file);
        const basename = path.basename(file);

        // Skip if explicitly excluded
        if (excludeFilesSet.has(basename)) {
          return false;
        }

        // Skip if matches a wildcard exclude pattern
        if (
          excludeFiles.some((pattern) => {
            if (pattern.includes("*")) {
              return minimatch(basename, pattern);
            }
            return false;
          })
        ) {
          return false;
        }

        // Include if it's in the include files list
        if (includeFilesSet.has(basename)) {
          if (recentFilter) {
            try {
              const fullPath = path.join(rootDir, file);
              const stats = fs.statSync(fullPath);
              return stats.mtimeMs >= recentFilter;
            } catch (e) {
              return false;
            }
          }
          return true;
        }

        // Check for special files without extensions
        if (
          NO_EXTENSION_IMPORTANT_FILES.some((name) => basename.includes(name))
        ) {
          return true;
        }

        // Check for priority files and special patterns
        for (const pattern of HIGH_PRIORITY_FILES) {
          if (minimatch(basename, pattern)) {
            return true;
          }
        }

        for (const pattern of ENTRY_POINT_PATTERNS) {
          if (minimatch(file, pattern)) {
            return true;
          }
        }

        // Check for important folders
        for (const folder of IMPORTANT_FOLDERS) {
          if (file.startsWith(folder)) {
            // Still check extension for these
            if (extensionsSet.has(ext)) {
              return true;
            }
          }
        }

        // Include if the extension is in the list
        if (extensionsSet.has(ext)) {
          // Check against gitignore if enabled
          if (options.respectGitignore && ig.ignores(file)) {
            return false;
          }

          // Check recent filter if enabled
          if (recentFilter) {
            try {
              const fullPath = path.join(rootDir, file);
              const stats = fs.statSync(fullPath);
              return stats.mtimeMs >= recentFilter;
            } catch (e) {
              return false;
            }
          }

          return true;
        }

        // As a fallback, do a quick content check to see if this looks like code
        // Only do this for a reasonable number of files to avoid performance issues
        if (
          (options.scanAll || filteredFiles.length < 100) &&
          !isLikelyBinaryFile(file)
        ) {
          try {
            const fullPath = path.join(rootDir, file);
            const stats = fs.statSync(fullPath);

            // Skip very large files for content-based detection
            if (stats.size > 100 * 1024) {
              // 100 KB
              return false;
            }

            // Get a sample of the file content
            const content = fs
              .readFileSync(fullPath, { encoding: "utf8", flag: "r" })
              .slice(0, 500);
            return isLikelyCodeFile(file, content);
          } catch (e) {
            return false;
          }
        }

        return false;
      });

      filteredFiles.push(...batchResults);
    }

    // Add a sanity check for maximum number of files
    const MAX_FILES_TO_PROCESS =
      options.maxFiles || FILE_SIZE_LIMITS.MAX_TOTAL_FILES;
    if (filteredFiles.length > MAX_FILES_TO_PROCESS) {
      // If we have too many files, prioritize
      spinner.info(
        `Found ${filteredFiles.length} files, limiting to ${MAX_FILES_TO_PROCESS}`
      );

      // First, keep all high-priority files
      const highPriorityMatches = filteredFiles.filter((file) => {
        const basename = path.basename(file);
        return (
          HIGH_PRIORITY_FILES.includes(basename) ||
          ENTRY_POINT_PATTERNS.some((pattern) => minimatch(file, pattern))
        );
      });

      // Then add regular files up to the limit
      const remainingFiles = filteredFiles
        .filter((file) => !highPriorityMatches.includes(file))
        .slice(0, MAX_FILES_TO_PROCESS - highPriorityMatches.length);

      filteredFiles = [...highPriorityMatches, ...remainingFiles];
    }

    spinner.succeed(`Found ${filteredFiles.length} relevant files`);
    return filteredFiles;
  } catch (error) {
    spinner.fail("Error finding files");
    console.error(chalk.red((error as Error).message));

    // Return empty array instead of exiting to allow the program to continue
    return [];
  }
}

/**
 * Get the file tree of a directory
 * @param rootDir Directory to get the file tree for
 * @returns String representation of the file tree
 */
export function getFileTree(rootDir: string): string {
  try {
    // Try the tree command first
    return execSync("tree --gitignore -L 3", {
      cwd: rootDir,
      encoding: "utf8",
    });
  } catch (error) {
    try {
      // Fallback if tree command is not available - try a more compatible version
      return execSync("tree -L 3", { cwd: rootDir, encoding: "utf8" });
    } catch (innerError) {
      try {
        // Another fallback using find
        return execSync(
          'find . -type d -not -path "*/\\.*" | sort | sed -e "s/[^-][^\\/]*\\//  |/g" -e "s/|\\([^ ]\\)/|-\\1/"',
          { cwd: rootDir, encoding: "utf8" }
        );
      } catch (finalError) {
        // Manual fallback - create a simple representation
        let result = "Project Directory Structure:\n";
        result += rootDir + "\n";

        try {
          // Get top-level directories
          const entries = fs.readdirSync(rootDir, { withFileTypes: true });
          const dirs = entries.filter((entry) => entry.isDirectory());
          dirs.forEach((dir) => {
            if (dir.name.startsWith(".")) return; // Skip hidden dirs
            result += `  |- ${dir.name}/\n`;

            // Try to get second-level directories
            try {
              const subEntries = fs.readdirSync(path.join(rootDir, dir.name), {
                withFileTypes: true,
              });
              const subDirs = subEntries.filter((entry) => entry.isDirectory());
              subDirs.slice(0, 5).forEach((subDir) => {
                // Limit to 5 subdirectories
                if (subDir.name.startsWith(".")) return; // Skip hidden dirs
                result += `  |   |- ${subDir.name}/\n`;
              });
              if (subDirs.length > 5) {
                result += `  |   |- ... ${
                  subDirs.length - 5
                } more directories\n`;
              }
            } catch (e) {
              // Ignore errors reading subdirectories
            }
          });
        } catch (e) {
          // Ignore errors
        }

        return result;
      }
    }
  }
}

/**
 * Check if a file is too large for processing
 * @param filePath Path to the file
 * @param options Program options
 * @returns Boolean indicating if the file should be skipped due to size
 */
export function isFileTooLarge(
  filePath: string,
  options: ProgramOptions
): boolean {
  try {
    const stats = fs.statSync(filePath);
    const maxSize =
      options.maxFileSizeBytes || parseInt(options.maxFileSize || "500") * 1024;
    return stats.size > maxSize;
  } catch (error) {
    // If we can't check size, assume it's not too large
    return false;
  }
}

/**
 * Safely read a file with proper error handling and UTF-8 validation
 * @param filePath Path to the file
 * @param options Program options
 * @returns Object with file content and success flag
 */
export function safeReadFile(
  filePath: string,
  options: ProgramOptions
): { content: string; success: boolean } {
  try {
    // Skip binary files if option enabled
    if (options.skipBinary && isLikelyBinaryFile(filePath)) {
      return { content: "", success: false };
    }

    // Skip large files without trying to read them
    if (isFileTooLarge(filePath, options)) {
      return { content: "", success: false };
    }

    // Try to read with UTF-8 encoding
    try {
      const content = fs.readFileSync(filePath, "utf8");
      return { content, success: true };
    } catch (error) {
      // If UTF-8 reading fails and forceUtf8 is false, try binary reading
      if (!options.forceUtf8) {
        const buffer = fs.readFileSync(filePath);
        // Replace invalid UTF-8 sequences with replacement character
        const content = buffer
          .toString("utf8", 0, buffer.length)
          .replace(/[^\x00-\x7F]/g, "?");
        return { content, success: true };
      }

      // Otherwise, report failure
      return { content: "", success: false };
    }
  } catch (error) {
    return { content: "", success: false };
  }
}

/**
 * Prioritize files based on importance with improved algorithm for large projects
 * @param files Array of file paths
 * @param fileContents Array of file contents
 * @param fileStats Array of file statistics
 * @param options Program options
 * @returns Object containing prioritized files, contents, and stats
 */
export function prioritizeFiles(
  files: string[],
  fileContents: string[],
  fileStats: FileStat[],
  options: ProgramOptions
): PrioritizedResult {
  // Safety check for array length mismatches
  if (
    files.length !== fileContents.length ||
    files.length !== fileStats.length
  ) {
    console.warn(
      chalk.yellow(
        `Warning: Mismatch in array lengths - files: ${files.length}, contents: ${fileContents.length}, stats: ${fileStats.length}`
      )
    );

    // Truncate to the shortest length
    const minLength = Math.min(
      files.length,
      fileContents.length,
      fileStats.length
    );
    files = files.slice(0, minLength);
    fileContents = fileContents.slice(0, minLength);
    fileStats = fileStats.slice(0, minLength);
  }

  // Create a score for each file
  let scoredFiles: ScoredFile[] = files.map((file, index) => {
    const basename = path.basename(file);
    const content = fileContents[index] || ""; // Safeguard against undefined
    const stats = fileStats[index];
    const ext = path.extname(file).toLowerCase();

    let score = 0;

    // Prioritize README and setup instructions first
    if (
      basename.toLowerCase() === "readme.md" ||
      basename.toLowerCase() === "contributing.md" ||
      basename.toLowerCase() === "setup.md"
    ) {
      score += 200;
    }

    // Prioritize config files and entry points
    if (
      HIGH_PRIORITY_FILES.includes(basename) ||
      HIGH_PRIORITY_FILES.some((pattern) => minimatch(basename, pattern))
    ) {
      score += 150;
    }

    // Prioritize likely entry points
    for (const pattern of ENTRY_POINT_PATTERNS) {
      if (minimatch(file, pattern)) {
        score += 100;
        break;
      }
    }

    // Prioritize important directories
    for (const folder of IMPORTANT_FOLDERS) {
      if (file.startsWith(folder)) {
        score += 50;
        break;
      }
    }

    // Give extra points for specific extensions that are likely important
    const importantExtensions: { [key: string]: number } = {
      ".md": 30, // Documentation
      ".json": 25, // Configuration
      ".yml": 25, // Configuration
      ".yaml": 25, // Configuration
      ".js": 20, // JavaScript
      ".ts": 25, // TypeScript (slightly higher than JS)
      ".jsx": 20, // React
      ".tsx": 25, // React with TypeScript
      ".py": 20, // Python
      ".go": 20, // Go
      ".java": 20, // Java
      ".rb": 20, // Ruby
      ".tf": 30, // Terraform
      ".tfvars": 25, // Terraform variables
      ".hcl": 25, // HCL files
      ".tpl": 20, // Template files
    };

    if (importantExtensions[ext]) {
      score += importantExtensions[ext];
    }

    // Prefer smaller files (inverse proportion to size)
    const sizeScore = Math.max(0, 50 - Math.floor(stats.size / 1000));
    score += sizeScore;

    // Heavily penalize very large files
    if (stats.size > 100 * 1024) {
      // > 100KB
      score -= 50;
    }

    // Penalize extremely small files (might be stubs or not informative)
    if (stats.size < 100) {
      // < 100 bytes
      score -= 20;
    }

    // Bonus points for files with significant but reasonable content
    if (stats.size > 500 && stats.size < 10 * 1024) {
      // 500B - 10KB (good size)
      score += 20;
    }

    // Prioritize files with imports/requires and definitions (likely more connected)
    let codeQualityScore = 0;

    // Count imports/requires
    const importCount = (content.match(/import\s+|require\s*\(/g) || []).length;
    codeQualityScore += Math.min(20, importCount * 2);

    // Count function definitions
    const functionCount = (
      content.match(/function\s+|=>|def\s+|class\s+|interface\s+/g) || []
    ).length;
    codeQualityScore += Math.min(20, functionCount);

    // Detect code that's likely to be meaningful architecture
    if (
      content.includes("export default") ||
      content.includes("module.exports") ||
      content.includes("@Component") ||
      content.includes("extends React") ||
      content.includes("createSlice") ||
      content.includes("@Injectable")
    ) {
      codeQualityScore += 15;
    }

    score += codeQualityScore;

    // Prioritize recently modified files if not already filtering by recency
    if (!options.recent) {
      try {
        const fullPath = path.join(options.directory, file);
        const fStats = fs.statSync(fullPath);
        const ageInDays = (Date.now() - fStats.mtimeMs) / (1000 * 60 * 60 * 24);
        if (ageInDays < 14) {
          // Increase to 2 weeks
          score += Math.max(0, 30 - Math.floor(ageInDays * 2));
        }
      } catch (e) {
        // Ignore errors
      }
    }

    // Special handling for infrastructure files if this mode is enabled
    if (options.mode === "infra" || options.infrastructure) {
      if (ext === ".tf" || ext === ".tfvars" || ext === ".hcl") {
        score += 100; // Boost Terraform files
      } else if (ext === ".yaml" || ext === ".yml") {
        // Check for Kubernetes patterns
        if (
          content.includes("apiVersion:") ||
          content.includes("kind:") ||
          content.includes("metadata:") ||
          content.includes("spec:")
        ) {
          score += 80; // Boost K8s manifests
        }
      } else if (
        basename === "Dockerfile" ||
        basename.includes("docker-compose")
      ) {
        score += 70; // Boost Docker files
      } else if (ext === ".tpl" || ext === ".tmpl" || ext === ".j2") {
        score += 60; // Boost templates often used with infrastructure
      }
    }

    // Deprioritize generated files
    if (
      basename.includes(".generated.") ||
      basename.includes(".gen.") ||
      file.includes("/generated/") ||
      file.includes("/dist/") ||
      file.includes("/build/")
    ) {
      score -= 80;
    }

    // Deprioritize minified files
    if (basename.includes(".min.")) {
      score -= 100;
    }

    // Deprioritize test files
    if (
      basename.includes(".test.") ||
      basename.includes(".spec.") ||
      file.includes("/__tests__/") ||
      file.includes("/__mocks__/")
    ) {
      score -= 40;
    }

    return { file, content, stats, score };
  });

  // Sort by score (highest first)
  scoredFiles.sort((a, b) => b.score - a.score);

  // Apply token budget constraints if specified
  if (options.tokens && options.tokenLimitChars) {
    let totalChars = 0;
    const filteredScoredFiles: ScoredFile[] = [];

    // First add the top 10 highest scored files regardless of size
    // This ensures we always include the most important files
    const criticalFiles = scoredFiles.slice(0, 10);
    filteredScoredFiles.push(...criticalFiles);
    totalChars = criticalFiles.reduce((sum, item) => sum + item.stats.size, 0);

    // Then add more files until we reach the token limit
    for (let i = 10; i < scoredFiles.length; i++) {
      const file = scoredFiles[i];
      if (totalChars + file.stats.size <= options.tokenLimitChars) {
        filteredScoredFiles.push(file);
        totalChars += file.stats.size;
      } else if (options.summarizeLargeFiles || options.truncateLargeFiles) {
        // If we can summarize/truncate, accept it with approximate reduced size
        const estimatedSize = Math.min(file.stats.size, 1500); // Rough estimate for summary
        if (totalChars + estimatedSize <= options.tokenLimitChars) {
          filteredScoredFiles.push(file);
          totalChars += estimatedSize;
        }
      }
    }

    // If we filtered files, use the filtered list
    if (filteredScoredFiles.length < scoredFiles.length) {
      console.log(
        chalk.cyan(
          `Limiting to ${filteredScoredFiles.length} files to stay within token budget`
        )
      );
      scoredFiles = filteredScoredFiles;
    }
  }

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

/**
 * Get project statistics
 * @param rootDir Project root directory
 * @param files Array of included files
 * @param stats Array of file statistics
 * @returns Project statistics object
 */
export function getProjectStats(
  rootDir: string,
  files: string[],
  stats: FileStat[]
): ProjectStats {
  return {
    totalFiles: files.length,
    includedFiles: files.length,
    totalSize: stats.reduce((sum, stat) => sum + stat.size, 0),
    totalTokens: stats.reduce((sum, stat) => sum + stat.tokens, 0),
    skippedBinaryFiles: 0,
    skippedLargeFiles: 0,
    skippedEncodingIssues: 0,
  };
}

/**
 * Check if a file should be skipped based on various criteria
 * @param filePath File path to check
 * @param options Program options
 * @returns Boolean indicating if file should be skipped
 */
export function shouldSkipFile(
  filePath: string,
  options: ProgramOptions
): boolean {
  // Skip binary files if that option is enabled
  if (options.skipBinary && isLikelyBinaryFile(filePath)) {
    return true;
  }

  // Skip files that exceed size limit
  if (isFileTooLarge(filePath, options)) {
    return true;
  }

  return false;
}

/**
 * Categorize files by directory for better organization
 * @param files Array of file paths
 * @param fileContents Array of file contents
 * @param fileStats Array of file statistics
 * @returns Object with files grouped by directory
 */
export function categorizeFilesByDirectory(
  files: string[],
  fileContents: string[],
  fileStats: FileStat[]
): { [key: string]: { file: string; content: string; stat: FileStat }[] } {
  const filesByDirectory: {
    [key: string]: { file: string; content: string; stat: FileStat }[];
  } = {};

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const dir = path.dirname(file);

    if (!filesByDirectory[dir]) {
      filesByDirectory[dir] = [];
    }

    filesByDirectory[dir].push({
      file: file,
      content: fileContents[i],
      stat: fileStats[i],
    });
  }

  return filesByDirectory;
}
