# LLM Context

A smart CLI tool that collects relevant code from your project to provide context to Large Language Models.

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
# Install globally
npm install -g codesnap

# Or use with npx without installing
npx codesnap


```
