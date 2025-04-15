import inquirer from "inquirer";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import os from "os";
import { filesize } from "filesize";

import { ProgramOptions, FileStat } from "../types";

interface ChoiceOption {
  name: string;
  value: number;
  checked: boolean;
}

/**
 * Handle interactive file selection
 * @param files Array of file paths
 * @param fileStats Array of file statistics
 * @returns Promise resolving to an array of selected indices
 */
async function interactiveFileSelection(
  files: string[],
  fileStats: FileStat[]
): Promise<number[]> {
  console.log(chalk.cyan("Interactive file selection mode:"));

  // Group files by directory for better organization
  const filesByDirectory: Record<string, ChoiceOption[]> = {};
  files.forEach((file, index) => {
    const dir = path.dirname(file);
    if (!filesByDirectory[dir]) {
      filesByDirectory[dir] = [];
    }
    filesByDirectory[dir].push({
      name: `${file} (${filesize(fileStats[index].size)})`,
      value: index,
      checked: true, // Default to checked
    });
  });

  // Sort directories
  const sortedDirs = Object.keys(filesByDirectory).sort();

  let selectedIndices: number[] = [];
  let currentTotalSize = fileStats.reduce(
    (total, stat) => total + stat.size,
    0
  );

  // Display current selection info
  console.log(
    chalk.green(
      `Initial selection: ${files.length} files, total size: ${filesize(
        currentTotalSize
      )}`
    )
  );

  // Process each directory
  for (const dir of sortedDirs) {
    const choices = filesByDirectory[dir];

    if (choices.length > 15) {
      // For directories with many files, offer a select/deselect all option first
      console.log(
        chalk.yellow(
          `\nDirectory ${dir} has ${choices.length} files. Select files to include:`
        )
      );

      const { selectAll } = await inquirer.prompt([
        {
          type: "list",
          name: "selectAll",
          message: `How do you want to handle directory "${dir}"?`,
          choices: [
            { name: "Include all files", value: "all" },
            { name: "Exclude all files", value: "none" },
            { name: "Select files individually", value: "select" },
          ],
          default: "all",
        },
      ]);

      if (selectAll === "all") {
        selectedIndices.push(...choices.map((c) => c.value));
        continue;
      } else if (selectAll === "none") {
        continue;
      }
      // If 'select', fall through to individual selection
    }

    // For directories with fewer files or if user chose to select individually
    const { selectedFiles } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectedFiles",
        message: `Select files from ${dir}:`,
        choices: choices,
        pageSize: 15,
      },
    ]);

    selectedIndices.push(...selectedFiles);

    // Calculate and display new total
    const selectedSize = selectedFiles.reduce(
      (total: number, idx: number) => total + fileStats[idx].size,
      0
    );
    currentTotalSize = selectedIndices.reduce(
      (total: number, idx: number) => total + fileStats[idx].size,
      0
    );
    console.log(
      chalk.green(
        `Selected ${selectedFiles.length} files from this directory (${filesize(
          selectedSize
        )})`
      )
    );
    console.log(
      chalk.green(
        `Current total: ${selectedIndices.length} files, ${filesize(
          currentTotalSize
        )}`
      )
    );
  }

  // Final confirmation
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Include ${selectedIndices.length} files (${filesize(
        currentTotalSize
      )}) in output?`,
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(chalk.yellow("Selection cancelled. Exiting..."));
    process.exit(0);
  }

  return selectedIndices;
}

/**
 * Save configuration to a file
 * @param options Program options
 * @param configName Name of the configuration
 */
function saveConfig(options: ProgramOptions, configName: string): void {
  try {
    // Create config directory if it doesn't exist
    const configDir = path.join(os.homedir(), ".llm-context");
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir);
    }

    // Clean up options object before saving
    const configToSave = { ...options };
    delete (configToSave as any)._;
    delete configToSave.saveConfig;
    delete configToSave.loadConfig;

    // Save configuration
    const configPath = path.join(configDir, `${configName}.json`);
    fs.writeFileSync(configPath, JSON.stringify(configToSave, null, 2));
    console.log(chalk.green(`Configuration saved as "${configName}"`));

    // List available configurations
    listSavedConfigs();
  } catch (error) {
    console.error(
      chalk.red(`Failed to save configuration: ${(error as Error).message}`)
    );
  }
}

/**
 * Load configuration from a file
 * @param configName Name of the configuration
 * @returns Loaded configuration or null if not found
 */
function loadConfig(configName: string): ProgramOptions | null {
  try {
    const configPath = path.join(
      os.homedir(),
      ".llm-context",
      `${configName}.json`
    );
    if (!fs.existsSync(configPath)) {
      console.error(chalk.red(`Configuration "${configName}" not found`));
      return null;
    }

    const config = JSON.parse(
      fs.readFileSync(configPath, "utf8")
    ) as ProgramOptions;
    console.log(chalk.green(`Loaded configuration "${configName}"`));
    return config;
  } catch (error) {
    console.error(
      chalk.red(`Failed to load configuration: ${(error as Error).message}`)
    );
    return null;
  }
}

/**
 * List all saved configurations
 */
function listSavedConfigs(): void {
  try {
    const configDir = path.join(os.homedir(), ".llm-context");
    if (!fs.existsSync(configDir)) {
      return;
    }

    const configs = fs
      .readdirSync(configDir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.replace(".json", ""));

    if (configs.length > 0) {
      console.log(chalk.cyan("Available configurations:"));
      configs.forEach((config) => {
        console.log(`- ${config}`);
      });
      console.log(chalk.cyan(`Load with: llm-context --load-config <name>`));
    }
  } catch (error) {
    // Ignore errors when listing configs
  }
}

export { interactiveFileSelection, saveConfig, loadConfig, listSavedConfigs };
