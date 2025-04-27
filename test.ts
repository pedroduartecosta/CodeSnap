import path from "path";
import { filesize } from "filesize";
import chalk from "chalk";
import { ProgramOptions, FileStat } from "../types";
import {
  getFileTree,
  isLikelyBinaryFile,
  categorizeFilesByDirectory,
} from "./file-utils";
import { BINARY_EXTENSIONS } from "./constants";

/**
 * Creates a summary of code content with improved intelligence
 * @param content File content to summarize
 * @param fileExt File extension
 * @param maxLines Maximum number of lines to include
 * @returns Summarized content
 */
export function createCodeSummary(
  content: string,
  fileExt: string,
  maxLines = 20
): string {
  if (!content) return "// Empty file";

  const lines = content.split("\n");
  if (lines.length <= maxLines) return content;

  // Get first ~10 lines, but intelligently search for imports section end
  let headerEndIndex = 10;

  // For JavaScript/TypeScript files, try to include the full import section
  if ([".js", ".jsx", ".ts", ".tsx"].includes(fileExt)) {
    // Find where imports likely end (first line that doesn't have import/require)
    let lastImportLine = 0;
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
      if (lines[i].includes("import ") || lines[i].includes("require(")) {
        lastImportLine = i;
      } else if (i > 15 && lastImportLine < i - 5) {
        // Consider imports done if we've gone 5+ lines without an import
        break;
      }
    }

    // Include a few lines after imports to capture initial setup code
    headerEndIndex = Math.min(lastImportLine + 3, 20);
  }

  // Get header - first part of the file
  const headerLines = lines.slice(0, headerEndIndex);

  // Get major code definitions with advanced language-specific patterns
  const defRegexes: { [key: string]: RegExp[] } = {
    ".js": [
      /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      /^\s*(?:export\s+)?const\s+(\w+)\s*=/,
      /^\s*(?:export\s+)?class\s+(\w+)/,
      /^\s*(?:export\s+)?interface\s+(\w+)/,
    ],
    ".ts": [
      /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      /^\s*(?:export\s+)?const\s+(\w+)\s*:/,
      /^\s*(?:export\s+)?class\s+(\w+)/,
      /^\s*(?:export\s+)?interface\s+(\w+)/,
      /^\s*(?:export\s+)?type\s+(\w+)/,
      /^\s*(?:export\s+)?enum\s+(\w+)/,
    ],
    ".py": [
      /^\s*def\s+(\w+)\s*\(/,
      /^\s*class\s+(\w+)/,
      /^\s*@\w+/, // Decorators often indicate important function
    ],
    ".go": [
      /^\s*func\s+(\w+)/,
      /^\s*type\s+(\w+)\s+struct/,
      /^\s*type\s+(\w+)\s+interface/,
    ],
    ".java": [
      /^\s*(?:public|private|protected)\s+.*\s+(\w+)\s*\(/,
      /^\s*(?:public|private|protected)\s+class\s+(\w+)/,
      /^\s*(?:public|private|protected)\s+interface\s+(\w+)/,
      /^\s*@\w+/, // Annotations often indicate important elements
    ],
    ".rb": [/^\s*def\s+(\w+)/, /^\s*class\s+(\w+)/, /^\s*module\s+(\w+)/],
    ".php": [
      /^\s*(?:public|private|protected)?\s*function\s+(\w+)/,
      /^\s*class\s+(\w+)/,
      /^\s*interface\s+(\w+)/,
      /^\s*trait\s+(\w+)/,
    ],
    ".cs": [
      /^\s*(?:public|private|protected|internal)\s+.*\s+(\w+)\s*\(/,
      /^\s*(?:public|private|protected|internal)\s+class\s+(\w+)/,
      /^\s*(?:public|private|protected|internal)\s+interface\s+(\w+)/,
      /^\s*(?:public|private|protected|internal)\s+enum\s+(\w+)/,
    ],
    ".swift": [
      /^\s*func\s+(\w+)/,
      /^\s*class\s+(\w+)/,
      /^\s*struct\s+(\w+)/,
      /^\s*enum\s+(\w+)/,
      /^\s*protocol\s+(\w+)/,
    ],
    ".rs": [
      /^\s*fn\s+(\w+)/,
      /^\s*struct\s+(\w+)/,
      /^\s*enum\s+(\w+)/,
      /^\s*trait\s+(\w+)/,
      /^\s*impl\s+/,
    ],
  };

  // Default regex for other languages
  const defaultRegex = [
    /^\s*function\s+(\w+)/,
    /^\s*class\s+(\w+)/,
    /^\s*def\s+(\w+)/,
  ];

  let knownLanguageKey = Object.keys(defRegexes).find((key) =>
    fileExt.endsWith(key)
  );

  // Select the regex patterns to use
  const regexPatterns = knownLanguageKey
    ? defRegexes[knownLanguageKey]
    : defaultRegex;

  // Find definitions in the file
  const definitions: string[] = [];
  const definitionLines: number[] = [];

  for (let i = headerEndIndex; i < lines.length; i++) {
    const line = lines[i];

    for (const regex of regexPatterns) {
      const match = regex.exec(line);
      if (match && match[1]) {
        definitions.push(match[1]);
        definitionLines.push(i);
        break;
      }
    }
  }

  // Include file footer - last few lines
  const footerLines = lines.slice(-5);

  // Create intelligent summary
  let summary = headerLines.join("\n") + "\n\n";

  // Add key definitions index
  if (definitions.length > 0) {
    // Limit to reasonable number (20) of definitions
    const displayCount = Math.min(definitions.length, 20);

    summary += `// File contains these ${definitions.length} definitions:\n`;
    summary += `// - ${definitions.slice(0, displayCount).join(", ")}`;

    if (definitions.length > displayCount) {
      summary += `, ... and ${definitions.length - displayCount} more`;
    }
    summary += "\n\n";

    // Add a few sample definitions to give a feel for the code style
    // Try to pick a few definitions from different parts of the file
    if (definitions.length > 3) {
      // Sample from beginning, middle and end of file for diversity
      const sampleIndices = [
        0,
        Math.floor(definitions.length / 2),
        definitions.length - 1,
      ];

      for (const idx of sampleIndices) {
        const lineIdx = definitionLines[idx];
        const defName = definitions[idx];

        // Extract a small sample of code for this definition
        // Start at the line with the definition and include up to 5 lines
        const sampleLines = Math.min(5, lines.length - lineIdx);
        if (lineIdx < lines.length) {
          summary += `// Sample definition: ${defName}\n`;
          summary += lines.slice(lineIdx, lineIdx + sampleLines).join("\n");
          summary += "\n\n";
        }
      }
    }
  } else {
    // If no definitions found, include a note about the file's size
    summary += `// ... ${
      lines.length - headerEndIndex - footerLines.length
    } lines not shown ...\n\n`;
  }

  summary += footerLines.join("\n");

  return summary;
}

/**
 * Improved comment stripping function with language-specific handling
 * @param content File content to strip comments from
 * @param fileExt File extension
 * @returns Content with comments stripped
 */
export function stripComments(content: string, fileExt: string): string {
  if (!content) return content;

  let strippedContent = content;

  // JavaScript/TypeScript/C-style comments
  if (
    [
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".c",
      ".cpp",
      ".h",
      ".java",
      ".cs",
      ".go",
      ".php",
      ".swift",
    ].some((ext) => fileExt.endsWith(ext))
  ) {
    // Keep JSDoc/TSDoc style comments with @param/@returns as they're valuable for understanding
    // Temporarily replace these with markers
    const docComments: string[] = [];

    // Extract and preserve important documentation comments
    strippedContent = strippedContent.replace(
      /\/\*\*[\s\S]*?\*\//g,
      (match) => {
        if (
          match.includes("@param") ||
          match.includes("@return") ||
          match.includes("@throws") ||
          match.includes("@description")
        ) {
          const index = docComments.length;
          docComments.push(match);
          return `__DOC_COMMENT_${index}__`;
        }
        return "";
      }
    );

    // Remove regular multi-line comments
    strippedContent = strippedContent.replace(/\/\*[\s\S]*?\*\//g, "");

    // Remove single-line comments while preserving important markers
    strippedContent = strippedContent.replace(/\/\/.*$/gm, (match) => {
      if (
        match.includes("TODO") ||
        match.includes("FIXME") ||
        match.includes("HACK") ||
        match.includes("NOTE")
      ) {
        return match; // Keep these informative comments
      }
      return "";
    });

    // Restore doc comments
    for (let i = 0; i < docComments.length; i++) {
      strippedContent = strippedContent.replace(
        `__DOC_COMMENT_${i}__`,
        docComments[i]
      );
    }
  }
  // Python/Ruby comments
  else if ([".py", ".rb"].some((ext) => fileExt.endsWith(ext))) {
    // Keep docstrings in Python (triple quotes)
    if (fileExt.endsWith(".py")) {
      const docstrings: string[] = [];

      // Extract and preserve docstrings
      strippedContent = strippedContent.replace(
        /"""[\s\S]*?"""|'''[\s\S]*?'''/g,
        (match) => {
          // Only preserve if it looks like a real docstring (not just a multiline string)
          if (
            match.includes(":param") ||
            match.includes(":return") ||
            match.includes("Args:") ||
            match.includes("Returns:")
          ) {
            const index = docstrings.length;
            docstrings.push(match);
            return `__DOCSTRING_${index}__`;
          }
          return match; // Keep normal triple-quoted strings
        }
      );

      // Remove regular comments
      strippedContent = strippedContent.replace(/#.*$/gm, "");

      // Restore docstrings
      for (let i = 0; i < docstrings.length; i++) {
        strippedContent = strippedContent.replace(
          `__DOCSTRING_${i}__`,
          docstrings[i]
        );
      }
    } else {
      // Regular comment removal for Ruby
      strippedContent = strippedContent.replace(/#.*$/gm, "");
    }
  }
  // HTML comments
  else if ([".html", ".xml", ".svg"].some((ext) => fileExt.endsWith(ext))) {
    strippedContent = strippedContent.replace(/<!--[\s\S]*?-->/g, "");
  }

  // Remove excessive blank lines (more than 2 consecutive)
  strippedContent = strippedContent.replace(/\n\s*\n\s*\n\s*\n/g, "\n\n\n");

  return strippedContent;
}

/**
 * Check if a file should be skipped for code rendering
 * @param filePath File path to check
 * @returns Boolean indicating if file should be skipped
 */
export function shouldSkipFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const skipExtensions = [
    // Binary extensions
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp",
    ".ico",
    ".webp",
    ".mp3",
    ".wav",
    ".ogg",
    ".mp4",
    ".avi",
    ".mov",
    ".flv",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".zip",
    ".tar",
    ".gz",
    ".exe",
    ".dll",
    ".so",
    ".pyc",
    ".class",
    ".o",
    ".obj",

    // Large text files often not useful for context
    ".min.js",
    ".min.css",
    ".map",
    ".lock",
  ];

  return skipExtensions.includes(ext) || isLikelyBinaryFile(filePath);
}

/**
 * Intelligently format content for different types of files
 * @param content File content
 * @param filePath File path
 * @param options Program options
 * @returns Formatted content
 */
export function formatFileContent(
  content: string,
  filePath: string,
  options: ProgramOptions
): string {
  const ext = path.extname(filePath).toLowerCase();

  // Skip binary files
  if (shouldSkipFile(filePath)) {
    return "// Binary or non-text file - content skipped";
  }

  // Check if file is too large
  const maxFileSize =
    options.maxFileSizeBytes || parseInt(options.maxFileSize || "500") * 1024;

  if (content.length > maxFileSize) {
    // Always use summarization regardless of truncateLargeFiles setting
    return createCodeSummary(content, ext);
  }

  // Strip comments if requested
  if (options.stripComments || options.optimizeTokens) {
    content = stripComments(content, ext);
  }

  return content;
}

/**
 * Format output for display or copying with improved organization
 * @param files Array of file paths
 * @param fileContents Array of file contents
 * @param options Program options
 * @param fileStats Array of file statistics
 * @returns Formatted output string
 */
export function formatOutput(
  files: string[],
  fileContents: string[],
  options: ProgramOptions,
  fileStats: FileStat[]
): string {
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

  let output = "";

  // Add a header with project info
  output += "# PROJECT CONTEXT\n\n";
  output += `This code was collected by the codesnap tool on ${
    new Date().toISOString().split("T")[0]
  }.\n`;

  // Calculate total size and tokens
  const totalSize = fileStats.reduce((sum, stat) => sum + stat.size, 0);
  const totalTokens = Math.ceil(totalSize / 4);

  output += `Total files: ${files.length}, `;
  output += `Size: ${filesize(totalSize)}, Est. tokens: ~${totalTokens}\n\n`;

  // Add file tree if requested
  if (options.tree) {
    try {
      output += "## PROJECT STRUCTURE\n";
      output += "```\n";
      output += getFileTree(options.directory);
      output += "```\n\n";
    } catch (error) {
      output += "## PROJECT STRUCTURE\n";
      output += "```\n";
      output += "Unable to generate file tree.\n";
      output += "```\n\n";
    }
  }

  // Add security notice if credential redaction is enabled
  if (options.redactCredentials) {
    output +=
      "> ⚠️ **Security Notice**: Sensitive information and credentials have been automatically redacted\n\n";
  }

  // Group files by directory for better organization
  const filesByDirectory = categorizeFilesByDirectory(
    files,
    fileContents,
    fileStats
  );

  // If list-only mode is enabled
  if (options.listOnly) {
    output += "## FILES INCLUDED\n\n";

    // Process directories in sorted order
    const dirs = Object.keys(filesByDirectory).sort();

    for (const dir of dirs) {
      // Skip empty directories
      if (filesByDirectory[dir].length === 0) continue;

      output += `### ${dir}/\n`;

      for (const { file, stat } of filesByDirectory[dir]) {
        output += `- ${path.basename(file)} (${filesize(stat.size)})\n`;
      }

      output += "\n";
    }
  } else {
    // Add file contents with improved organization
    output += "# PROJECT FILES\n\n";

    // Process directories in sorted order for better organization
    const dirs = Object.keys(filesByDirectory).sort();

    for (const dir of dirs) {
      // Skip empty directories
      if (filesByDirectory[dir].length === 0) continue;

      // Add directory header for organization
      if (dir !== ".") {
        output += `## Directory: ${dir}/\n\n`;
      } else {
        output += `## Root Directory\n\n`;
      }

      // Process each file in the directory
      for (const { file, content, stat } of filesByDirectory[dir]) {
        const basename = path.basename(file);

        // Add file header with size info
        output += `### ${basename} (${filesize(stat.size)})\n\n`;

        // Skip binary files
        if (shouldSkipFile(file)) {
          output +=
            "```\n// Binary or non-text file - content skipped\n```\n\n";
          continue;
        }

        // Format the content based on file type and options
        const formattedContent = formatFileContent(content, file, options);

        // Add code block with appropriate language
        output += "```\n";
        output += formattedContent;

        // Ensure there's a newline at the end
        if (!formattedContent.endsWith("\n")) {
          output += "\n";
        }

        output += "```\n\n";
      }
    }
  }

  // Add a note about codesnap
  output += "---\n";
  output +=
    "Generated with codesnap (improved for large projects). For more options run: `npx codesnap --help`\n";

  return output;
}

/**
 * Format an individual file for direct output
 * @param file File path
 * @param content File content
 * @param options Program options
 * @returns Formatted string for the single file
 */
export function formatSingleFile(
  file: string,
  content: string,
  options: ProgramOptions
): string {
  const basename = path.basename(file);
  const fileSize = content.length;

  let output = "";

  // Add file header
  output += `# ${basename} (${filesize(fileSize)})\n\n`;

  // Format content
  const formattedContent = formatFileContent(content, file, options);

  // Add code block with appropriate language
  output += "```\n";
  output += formattedContent;

  // Ensure there's a newline at the end
  if (!formattedContent.endsWith("\n")) {
    output += "\n";
  }

  output += "```\n\n";

  return output;
}

/**
 * Get the appropriate language identifier for syntax highlighting
 * @param filePath File path
 * @returns Language identifier for code blocks
 */
export function getLanguageIdentifier(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();

  const languageMap: { [key: string]: string } = {
    // JavaScript family
    ".js": "javascript",
    ".jsx": "jsx",
    ".ts": "typescript",
    ".tsx": "tsx",

    // Web
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".sass": "sass",
    ".less": "less",

    // Backend languages
    ".py": "python",
    ".rb": "ruby",
    ".php": "php",
    ".go": "go",
    ".java": "java",
    ".cs": "csharp",
    ".swift": "swift",
    ".kt": "kotlin",
    ".rs": "rust",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "c",

    // Config/Data
    ".json": "json",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".toml": "toml",
    ".xml": "xml",
    ".ini": "ini",
    ".md": "markdown",

    // Shell
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "bash",
    ".fish": "fish",
    ".ps1": "powershell",
  };

  return languageMap[ext] || "";
}

/**
 * Format and group files by type (config, source, documentation, etc.)
 * @param files Array of file paths
 * @param fileContents Array of file contents
 * @param fileStats Array of file statistics
 * @returns Grouped file structure for better organization
 */
export function groupFilesByType(
  files: string[],
  fileContents: string[],
  fileStats: FileStat[]
): { [key: string]: { file: string; content: string; stat: FileStat }[] } {
  // Define file type categories
  const fileTypeGroups: { [key: string]: string[] } = {
    "Configuration Files": [
      ".json",
      ".yml",
      ".yaml",
      ".toml",
      ".xml",
      ".ini",
      ".env.example",
    ],
    Documentation: [".md", ".markdown", ".txt", ".rst"],
    "JavaScript/TypeScript": [".js", ".jsx", ".ts", ".tsx"],
    "Web Frontend": [".html", ".css", ".scss", ".sass", ".less"],
    "Backend Code": [
      ".py",
      ".rb",
      ".php",
      ".go",
      ".java",
      ".cs",
      ".swift",
      ".kt",
      ".rs",
      ".c",
      ".cpp",
    ],
    "Shell Scripts": [".sh", ".bash", ".zsh", ".fish", ".ps1"],
    Other: [], // Catch-all category
  };

  // Group files by their type
  const groupedFiles: {
    [key: string]: { file: string; content: string; stat: FileStat }[];
  } = {};

  // Initialize groups
  Object.keys(fileTypeGroups).forEach((group) => {
    groupedFiles[group] = [];
  });

  // Categorize each file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = path.extname(file).toLowerCase();
    let assigned = false;

    // Check file against each group
    for (const [groupName, extensions] of Object.entries(fileTypeGroups)) {
      if (
        extensions.includes(ext) ||
        (groupName === "Configuration Files" &&
          path.basename(file).match(/config|conf|setting|settings/i))
      ) {
        groupedFiles[groupName].push({
          file,
          content: fileContents[i],
          stat: fileStats[i],
        });
        assigned = true;
        break;
      }
    }

    // If not assigned to any group, put in Other
    if (!assigned) {
      groupedFiles["Other"].push({
        file,
        content: fileContents[i],
        stat: fileStats[i],
      });
    }
  }

  // Remove empty groups
  Object.keys(groupedFiles).forEach((key) => {
    if (groupedFiles[key].length === 0) {
      delete groupedFiles[key];
    }
  });

  return groupedFiles;
}
