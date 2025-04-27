// src/utils/constants.ts - Consolidated constants from across the codebase

/**
 * System-wide constants for the codesnap tool
 * Contains all configuration values, file patterns, and size limits
 */

/**
 * File categories for organization and filtering
 */
export const FILE_CATEGORIES = {
  IMAGES: [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".tiff",
    ".ico",
    ".svg",
    ".webp",
  ],
  AUDIO: [".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"],
  VIDEO: [".mp4", ".webm", ".avi", ".mov", ".wmv", ".flv", ".mkv"],
  COMPILED: [
    ".dll",
    ".so",
    ".dylib",
    ".a",
    ".lib",
    ".obj",
    ".o",
    ".class",
    ".pyc",
    ".pyo",
    ".exe",
  ],
  COMPRESSED: [".zip", ".tar", ".gz", ".7z", ".rar", ".bz2", ".xz"],
  DOCUMENTS: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"],
  BINARY_DATA: [".db", ".sqlite", ".sqlite3", ".mdb", ".dat", ".bin"],
  FONTS: [".ttf", ".otf", ".woff", ".woff2", ".eot"],
  DISK_IMAGES: [".dmg", ".iso", ".img"],
  MINIFIED: [".min.js", ".min.css", ".map"],
  DATA_EXPORTS: [".csv", ".tsv"],
};

/**
 * Code file categories organized by type
 */
export const CODE_CATEGORIES = {
  JAVASCRIPT: [".js", ".jsx", ".ts", ".tsx", ".vue", ".mjs", ".cjs"],
  BACKEND: [
    ".py",
    ".rb",
    ".go",
    ".java",
    ".php",
    ".rs",
    ".c",
    ".cpp",
    ".h",
    ".cs",
    ".swift",
    ".kt",
  ],
  FRONTEND: [".html", ".css", ".scss", ".sass", ".less", ".svelte"],
  CONFIG: [
    ".json",
    ".yml",
    ".yaml",
    ".toml",
    ".xml",
    ".ini",
    ".env.example",
    ".env.sample",
  ],
  DOCUMENTATION: [".md", ".markdown", ".txt", ".rst"],
  SHELL: [".sh", ".bash", ".zsh", ".fish", ".ps1"],
};

/**
 * Expanded code file categories to include more types
 */
export const EXPANDED_CODE_CATEGORIES = {
  INFRASTRUCTURE: [
    ".tf", // Terraform
    ".tfvars", // Terraform variables
    ".hcl", // HashiCorp Configuration Language
    ".nomad", // Nomad job files
    ".pkr.hcl", // Packer template
  ],
  CONTAINER: [
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    ".dockerignore",
  ],
  KUBERNETES: [
    ".yaml", // Common for K8s manifests
    ".yml", // Alternative YAML extension
    ".helmignore",
    "Chart.yaml",
    "values.yaml",
  ],
  TEMPLATES: [
    ".tpl", // Generic template
    ".tmpl", // Template
    ".j2", // Jinja2 template
    ".template", // Template
    ".gotmpl", // Go template
    ".erb", // Ruby template
  ],
  CONFIGS: [
    ".conf", // Config file
    ".config", // Config file
    ".properties", // Java properties
    ".ini", // INI config
    ".env", // Environment variables
    ".env.example",
    ".env.sample",
    ".toml", // TOML config (also used by Rust)
  ],
};

/**
 * Configuration file categories
 */
export const CONFIG_FILE_CATEGORIES = {
  PACKAGE_MANAGERS: [
    "package.json",
    "composer.json",
    "go.mod",
    "Cargo.toml",
    "Gemfile",
    "requirements.txt",
    "pyproject.toml",
    "build.gradle",
    "pom.xml",
  ],
  BUILD_CONFIG: [
    "tsconfig.json",
    "webpack.config.js",
    "rollup.config.js",
    "vite.config.js",
    "jest.config.js",
    "babel.config.js",
    ".eslintrc",
    ".eslintrc.js",
    ".eslintrc.json",
  ],
  CONTAINERIZATION: [
    "docker-compose.yml",
    "Dockerfile",
    "kubernetes.yaml",
    "k8s.yaml",
  ],
  PROJECT_INFO: ["README.md", "CONTRIBUTING.md", "LICENSE", "CHANGELOG.md"],
  VERSION_CONTROL: [".gitignore", ".gitattributes"],
  ENTRY_POINTS: [
    "main.js",
    "index.js",
    "app.js",
    "server.js",
    "main.py",
    "app.py",
    "__main__.py",
    "Main.java",
    "Program.cs",
    "main.go",
  ],
  LANGUAGE_SPECIFIC: [
    "settings.gradle",
    "build.sbt",
    "mix.exs",
    "CMakeLists.txt",
    "meson.build",
    "deno.json",
    "angular.json",
    "nuxt.config.js",
    "svelte.config.js",
    "gatsby-config.js",
    "astro.config.mjs",
    "tailwind.config.js",
    "postcss.config.js",
  ],
  INFRASTRUCTURE: [
    "main.tf",
    "variables.tf",
    "outputs.tf",
    "providers.tf",
    "backend.tf",
    "versions.tf",
    "terraform.tfvars",
    "Chart.yaml",
    "values.yaml",
    "kustomization.yaml",
    "serverless.yml",
    "cloudformation.yaml",
    "ansible.cfg",
    "playbook.yml",
    "inventory",
  ],
};

/**
 * Default directories to ignore when scanning for files
 */
export const DEFAULT_IGNORE_DIRS: string[] = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/public/**",
  "**/bin/**",
  "**/binaries/**",
  "**/test/**",
  "**/tests/**",
  "**/spec/**",
  "**/specs/**",
  "**/fixtures/**",
  "**/.git/**",
  "**/.github/**",
  "**/.svn/**",
  "**/coverage/**",
  "**/.gitlab/**",
  "**/.circleci/**",
  "**/docs/**",
  "**/doc/**",
  "**/examples/**",
  "**/vendor/**",
  "**/third-party/**",
  "**/external/**",
  "**/libs/**",
  "**/assets/**",
  "**/static/**",
  "**/images/**",
  "**/img/**",
  "**/videos/**",
  "**/audio/**",
  "**/fonts/**",
  "**/locales/**",
  "**/i18n/**",
  "**/l10n/**",
  "**/generated/**",
  "**/auto-generated/**",
  "**/gen/**",
  "**/.cache/**",
  "**/cache/**",
  "**/.terraform/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/.vercel/**",
  "**/.idea/**",
  "**/.vscode/**",
  "**/.DS_Store",
];

/**
 * Flattened list of binary file extensions to exclude
 */
export const BINARY_EXTENSIONS: string[] = [
  ...FILE_CATEGORIES.IMAGES,
  ...FILE_CATEGORIES.AUDIO,
  ...FILE_CATEGORIES.VIDEO,
  ...FILE_CATEGORIES.COMPILED,
  ...FILE_CATEGORIES.COMPRESSED,
  ...FILE_CATEGORIES.DOCUMENTS,
  ...FILE_CATEGORIES.BINARY_DATA,
  ...FILE_CATEGORIES.FONTS,
  ...FILE_CATEGORIES.DISK_IMAGES,
  ...FILE_CATEGORIES.MINIFIED,
];

/**
 * Flattened list of all code file extensions to include
 */
export const CODE_EXTENSIONS: string[] = [
  ...CODE_CATEGORIES.JAVASCRIPT,
  ...CODE_CATEGORIES.BACKEND,
  ...CODE_CATEGORIES.FRONTEND,
  ...CODE_CATEGORIES.CONFIG,
  ...CODE_CATEGORIES.DOCUMENTATION,
  ...CODE_CATEGORIES.SHELL,
];

/**
 * All code files including expanded categories
 */
export const EXPANDED_CODE_EXTENSIONS = [
  ...CODE_EXTENSIONS,
  ...EXPANDED_CODE_CATEGORIES.INFRASTRUCTURE,
  ...EXPANDED_CODE_CATEGORIES.CONTAINER,
  ...EXPANDED_CODE_CATEGORIES.KUBERNETES,
  ...EXPANDED_CODE_CATEGORIES.TEMPLATES,
  ...EXPANDED_CODE_CATEGORIES.CONFIGS,
];

/**
 * Files to exclude even if they match other patterns
 */
export const DEFAULT_EXCLUDE_FILES: string[] = [
  // Lock files
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "composer.lock",
  "Cargo.lock",
  "Gemfile.lock",

  // Minified/bundled files
  "*.min.js",
  "*.min.css",
  "*.bundle.js",
  "*.bundle.css",

  // Generated code
  "*.pb",
  "*.d.ts",
  "*.generated.*",

  // Large data files
  "*.sql",
  "*.dump",
  "*.bak",
];

/**
 * High priority files that should be included
 */
export const HIGH_PRIORITY_FILES: string[] = [
  ...CONFIG_FILE_CATEGORIES.PACKAGE_MANAGERS,
  ...CONFIG_FILE_CATEGORIES.BUILD_CONFIG,
  ...CONFIG_FILE_CATEGORIES.CONTAINERIZATION,
  ...CONFIG_FILE_CATEGORIES.PROJECT_INFO,
  ...CONFIG_FILE_CATEGORIES.VERSION_CONTROL,
  ...CONFIG_FILE_CATEGORIES.LANGUAGE_SPECIFIC,
  ...CONFIG_FILE_CATEGORIES.INFRASTRUCTURE,
];

/**
 * Entry point patterns that should be prioritized
 */
export const ENTRY_POINT_PATTERNS: string[] = [
  ...CONFIG_FILE_CATEGORIES.ENTRY_POINTS,
  "src/index.*",
  "src/main.*",
  "src/app.*",
  "cmd/main.go",
  "cmd/*/main.go",
];

/**
 * Folders that likely contain important code
 */
export const IMPORTANT_FOLDERS: string[] = [
  "src/",
  "app/",
  "lib/",
  "core/",
  "api/",
  "controllers/",
  "models/",
  "services/",
  "utils/",
  "helpers/",
  "components/",
  "hooks/",
  "store/",
  "context/",
  "reducers/",
  "actions/",
  "middleware/",
  "providers/",
];

/**
 * These files should be recognized even without extensions
 */
export const NO_EXTENSION_IMPORTANT_FILES = [
  "Dockerfile",
  "Makefile",
  "Jenkinsfile",
  "docker-compose",
  "docker-compose.override",
  ".gitignore",
  ".editorconfig",
  "Vagrantfile",
  "Brewfile",
  "Procfile",
  "nginx.conf",
];

/**
 * Size limits and thresholds
 */
export const FILE_SIZE_LIMITS = {
  // Maximum size for an individual file (500KB)
  MAX_INDIVIDUAL_FILE_SIZE: 500 * 1024,

  // Maximum number of files to include
  MAX_TOTAL_FILES: 1000000,

  // Threshold for preferring smaller files (50KB)
  SMALL_FILE_PREFERENCE_THRESHOLD: 50 * 1024,

  // Default token limit
  DEFAULT_TOKEN_LIMIT: 100000,

  // Default size limit in KB
  DEFAULT_SIZE_LIMIT_KB: 50,
};

/**
 * Backward compatibility exports for constants that were previously separate
 */
export const DEFAULT_EXCLUDE_EXTS = BINARY_EXTENSIONS;
export const DEFAULT_INCLUDE_EXTS = EXPANDED_CODE_EXTENSIONS;
export const DEFAULT_INCLUDE_FILES = [
  ...CONFIG_FILE_CATEGORIES.PACKAGE_MANAGERS,
  ...CONFIG_FILE_CATEGORIES.BUILD_CONFIG,
  ...CONFIG_FILE_CATEGORIES.CONTAINERIZATION,
  ...CONFIG_FILE_CATEGORIES.PROJECT_INFO,
  ...CONFIG_FILE_CATEGORIES.VERSION_CONTROL,
  ...CONFIG_FILE_CATEGORIES.ENTRY_POINTS,
  ...CONFIG_FILE_CATEGORIES.INFRASTRUCTURE,
  ...NO_EXTENSION_IMPORTANT_FILES,
];

export const MAX_INDIVIDUAL_FILE_SIZE =
  FILE_SIZE_LIMITS.MAX_INDIVIDUAL_FILE_SIZE;
export const MAX_TOTAL_FILES = FILE_SIZE_LIMITS.MAX_TOTAL_FILES;
export const SMALL_FILE_PREFERENCE_THRESHOLD =
  FILE_SIZE_LIMITS.SMALL_FILE_PREFERENCE_THRESHOLD;
