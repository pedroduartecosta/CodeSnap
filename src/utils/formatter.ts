import path from "path";
import { filesize } from "filesize";
import { ProgramOptions, FileStat } from "../types";
import { getFileTree } from "./file-utils";

/**
 * Simple function to create a summary of code
 * @param content File content to summarize
 * @param fileExt File extension
 * @param maxLines Maximum number of lines to include
 * @returns Summarized content
 */
function createCodeSummary(
  content: string,
  fileExt: string,
  maxLines = 20
): string {
  const lines = content.split("\n");
  if (lines.length <= maxLines) return content;

  // Get first 10 lines
  const firstLines = lines.slice(0, 10).join("\n");

  // Get last 5 lines
  const lastLines = lines.slice(-5).join("\n");

  // Pull out function/class definitions for the middle section
  let definitions: string[] = [];
  const defRegexes: { [key: string]: RegExp } = {
    ".js": /function\s+(\w+)|class\s+(\w+)|const\s+(\w+)\s*=/g,
    ".ts":
      /function\s+(\w+)|class\s+(\w+)|interface\s+(\w+)|type\s+(\w+)|const\s+(\w+)\s*=/g,
    ".py": /def\s+(\w+)|class\s+(\w+)/g,
    ".java":
      /public\s+(?:class|interface|enum)\s+(\w+)|public\s+(?:static\s+)?(?:void|[\w<>[\]]+)\s+(\w+)\s*\(/g,
    ".rb": /def\s+(\w+)|class\s+(\w+)/g,
    ".go": /func\s+(\w+)|type\s+(\w+)\s+struct/g,
  };

  // Find the right regex for the file type
  let regex: RegExp | null = null;
  for (const [ext, r] of Object.entries(defRegexes)) {
    if (fileExt.endsWith(ext)) {
      regex = r;
      break;
    }
  }

  // Extract definitions if we have a regex
  if (regex) {
    const middleContent = lines.slice(10, -5).join("\n");
    let match;
    while ((match = regex.exec(middleContent)) !== null) {
      const name = match.slice(1).find((m) => m);
      if (name) definitions.push(name);
    }
  }

  // Create the summary
  let summary = firstLines + "\n\n";

  if (definitions.length > 0) {
    // Limit to 20 definitions to avoid overwhelming
    if (definitions.length > 20) {
      definitions = definitions.slice(0, 20);
      definitions.push("... and more");
    }
    summary += `// File contains these definitions:\n// ${definitions.join(
      ", "
    )}\n\n`;
  } else {
    summary += `// ... ${lines.length - 15} more lines ...\n\n`;
  }

  summary += lastLines;

  return summary;
}

/**
 * Simple comment stripping function (not perfect, but good enough for token reduction)
 * @param content File content to strip comments from
 * @param fileExt File extension
 * @returns Content with comments stripped
 */
function stripComments(content: string, fileExt: string): string {
  if (!content) return content;

  // JavaScript/TypeScript/C-style comments
  if (
    [".js", ".jsx", ".ts", ".tsx", ".c", ".cpp", ".h", ".java", ".cs"].some(
      (ext) => fileExt.endsWith(ext)
    )
  ) {
    // Remove multi-line comments
    content = content.replace(/\/\*[\s\S]*?\*\//g, "");
    // Remove single-line comments
    content = content.replace(/\/\/.*$/gm, "");
  }
  // Python/Ruby comments
  else if ([".py", ".rb"].some((ext) => fileExt.endsWith(ext))) {
    // Remove # comments
    content = content.replace(/#.*$/gm, "");
  }
  // HTML comments
  else if ([".html", ".xml", ".svg"].some((ext) => fileExt.endsWith(ext))) {
    content = content.replace(/<!--[\s\S]*?-->/g, "");
  }

  // Remove excessive blank lines
  content = content.replace(/\n\s*\n\s*\n/g, "\n\n");

  return content;
}

export { formatOutput, createCodeSummary, stripComments };

/**
 * Format output for display or copying
 * @param files Array of file paths
 * @param fileContents Array of file contents
 * @param options Program options
 * @param fileStats Array of file statistics
 * @returns Formatted output string
 */
function formatOutput(
  files: string[],
  fileContents: string[],
  options: ProgramOptions,
  fileStats: FileStat[]
): string {
  let output = "";

  // Add file tree if requested
  if (options.tree) {
    output += "# PROJECT STRUCTURE\n";
    output += "```\n";
    output += getFileTree(options.directory);
    output += "```\n\n";
  }

  // Add some context about the LLM-Context tool
  output += "# PROJECT CONTEXT\n\n";
  output += `This code was collected by the LLM-Context tool on ${
    new Date().toISOString().split("T")[0]
  }.\n`;
  output += `Total files: ${files.length}, `;

  // Calculate total size and tokens
  const totalSize = fileStats.reduce((sum, stat) => sum + stat.size, 0);
  const totalTokens = Math.ceil(totalSize / 4);
  output += `Size: ${filesize(totalSize)}, Est. tokens: ~${totalTokens}\n\n`;

  // Add file contents
  output += "# PROJECT FILES\n\n";

  if (options.listOnly) {
    output += "Files included:\n";
    files.forEach((file) => {
      output += `- ${file}\n`;
    });
  } else {
    // Set up a maximum file size
    const maxFileSize = parseInt(options.maxFileSize || "10") * 1024;

    // Add security notice if credential redaction is enabled
    if (options.redactCredentials) {
      output +=
        "> ⚠️ **Security Notice**: Sensitive information and credentials have been automatically redacted\n\n";
    }

    files.forEach((file, index) => {
      let content = fileContents[index];
      const stat = fileStats[index];
      const ext = path.extname(file);

      // Add file header with size info
      output += `## ${file} (${filesize(stat.size)})\n`;

      // Check if file is too large
      if (stat.size > maxFileSize) {
        if (options.truncateLargeFiles) {
          // Truncate the file
          content =
            content.slice(0, maxFileSize) +
            "\n\n// ... truncated, file too large ...";
        } else if (options.summarizeLargeFiles) {
          // Replace with summary
          content = createCodeSummary(content, ext);
        }
      }

      // Strip comments if requested
      if (options.stripComments || options.optimizeTokens) {
        content = stripComments(content, ext);
      }

      // Add code block with language
      output += "```" + (ext.substring(1) || "") + "\n";
      output += content;

      // Ensure there's a newline at the end
      if (!content.endsWith("\n")) {
        output += "\n";
      }

      output += "```\n\n";
    });
  }

  // Add a note about LLM-Context
  output += "---\n";
  output +=
    "Generated with LLM-Context. For more options run: `npx llm-context --help`\n";

  return output;
}
