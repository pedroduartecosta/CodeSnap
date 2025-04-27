# CodeSnap

CodeSnap is a smart CLI tool that intelligently collects relevant code from your project to provide context to Large Language Models. It optimizes your interactions with AI coding assistants by capturing the most relevant parts of your codebase.

## Features

- 🧠 **Smart file selection** - Only includes relevant files based on extensions and patterns
- 🔍 **Project type detection** - Automatically identifies project types (code, infrastructure, docs)
- 📊 **Size awareness** - Shows you the size and token estimates before copying
- 🌲 **Project structure** - Option to include file tree for better context
- 📋 **Clipboard integration** - Copies formatted output directly to clipboard
- 🚫 **Respects .gitignore** - Automatically ignores files that Git would ignore
- 🔒 **Credential redaction** - Automatically detects and redacts API keys and sensitive information
- ⚡ **Token optimization** - Reduces token usage by stripping comments or truncating large files

## Installation

```bash
# Install locally
pnpm install && pnpm build && pnpm link
```

````

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
codesnap -e .js .ts .jsx .tsx

# Exclude specific patterns
codesnap -x "test/*" "dist/*"

# Customize size limit (default is 50KB)
codesnap --limit 100

# Set token limit for LLMs (default is 100000)
codesnap --tokens 50000

# Optimize for specific project types
codesnap --mode infra    # Infrastructure code (Terraform, Kubernetes, etc.)
codesnap --mode code     # Source code projects
codesnap --mode doc      # Documentation-heavy projects

# Print output instead of copying to clipboard
codesnap --no-copy
```

### Configuration

```bash
# Save your configuration for future use
codesnap --save my-config

# Load a saved configuration
codesnap --load my-config
```

### Security Features

CodeSnap includes built-in security features:

- Automatically detects and redacts API keys, passwords, and tokens
- Respects `.gitignore` patterns to avoid including sensitive files
- Security levels can be set with `--security auto|strict|none`

For maximum security when sharing code:

```bash
codesnap --security strict
```

## Project Type Modes

CodeSnap detects your project type and optimizes file selection accordingly:

### Infrastructure Mode (`--mode infra`)

Optimized for Terraform, Kubernetes, Docker, and other infrastructure-as-code projects:

- Prioritizes `.tf`, `.yaml`, `.hcl`, and other config files
- Includes templates and deployment configurations
- Detects and includes resources, services, and deployment files

### Code Mode (`--mode code`)

Optimized for source code projects:

- Prioritizes code files over documentation
- Strips comments to reduce token usage
- Prioritizes important files like entry points and core modules

### Documentation Mode (`--mode doc`)

Optimized for documentation-heavy projects:

- Preserves comments and formatting
- Prioritizes README and documentation files
- Keeps whitespace and markdown intact

## Examples

Getting context for a Terraform project:

```bash
codesnap --mode infra
```

Capturing a React project's core components:

```bash
codesnap --mode code -e .js .jsx .ts .tsx
```

Including only recently modified files:

```bash
codesnap --recent 7
```

Selecting files interactively with increased security:

```bash
codesnap --interactive --security strict
```

## License

MIT
````
