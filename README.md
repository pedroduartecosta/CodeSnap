# CodeSnap

CodeSnap is a smart CLI tool that intelligently collects relevant code from your project to provide context to Large Language Models. It optimizes your interactions with AI coding assistants by capturing the most relevant parts of your codebase.

## Features

- 🧠 **Smart file selection** - Only includes relevant files based on extensions and patterns
- 📊 **Size awareness** - Shows you the size and token estimates before copying
- 🌲 **Project structure** - Option to include file tree for better context
- 📋 **Clipboard integration** - Copies formatted output directly to clipboard
- ⚙️ **Customizable** - Easily configure which files to include/exclude
- 🚫 **Respects .gitignore** - Automatically ignores files that Git would ignore
- 🔒 **Credential redaction** - Automatically detects and redacts API keys and sensitive information
- 🔍 **Smart prioritization** - Intelligently prioritizes important files like configs and entry points
- ⚡ **Token optimization** - Reduces token usage by stripping comments or truncating large files
- 🤖 **LLM optimized** - Format output specifically for your preferred LLM

## Installation

```bash
# Install locally
pnpm install && pnpm build && pnpm link
```

## Usage

### Basic usage

Run CodeSnap in your project directory to capture relevant files:

```bash
codesnap
```

### Common Options

```bash
# Select files interactively
codesnap --interactive

# Include file tree structure
codesnap --tree

# Limit to specific file extensions
codesnap --extensions .js .ts .jsx .tsx

# Exclude specific patterns
codesnap --ignore "test/*" "dist/*"

# Customize size limit (default is 50KB)
codesnap --limit 100

# Set token limit for LLMs (default is 100000)
codesnap --tokens 50000

# Optimize output for specific LLM
codesnap --llm claude

# Print output instead of copying to clipboard
codesnap --no-copy
```

### Advanced Features

```bash
# Save your configuration for future use
codesnap --save-config my-config

# Load a saved configuration
codesnap --load-config my-config

# Only include recent files (modified in the last 7 days)
codesnap --recent 7

# Show summary without copying
codesnap --summary

# Dry run to see what would be copied
codesnap --dry-run

# Set maximum file size (in KB)
codesnap --max-file-size 100

# Include truncated versions of large files
codesnap --truncate-large-files
```

## Configuration

CodeSnap automatically detects important files in your project, but you can customize the behavior:

- It respects your `.gitignore` file by default
- Automatically prioritizes config files, entry points, and READMEs
- Skips binary files, images, and other non-text content
- Redacts sensitive information like API keys and credentials

## Security

CodeSnap includes built-in security features:

- Automatically detects and redacts API keys, passwords, and tokens
- Respects `.gitignore` patterns to avoid including sensitive files
- Can show summaries of redacted content with `--show-redacted`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
