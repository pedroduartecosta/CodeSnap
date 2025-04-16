/**
 * Constants for the codesnap tool
 * Contains default configuration values, file patterns, and size limits
 */

/**
 * Default directories to ignore when scanning for files
 * Common build, dependency, and system directories are excluded
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
 * Binary and large file extensions to exclude by default
 * Categorized by file type for better organization
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
  DATA_EXPORTS: [".csv", ".tsv"], // Separated from BINARY_DATA as these are sometimes useful text files
};

/**
 * Flattened list of binary/excluded extensions
 */
export const DEFAULT_EXCLUDE_EXTS: string[] = [
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
 * Text file extensions to include by default
 * Categorized by language/purpose for better organization
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
 * Flattened list of included extensions
 */
export const DEFAULT_INCLUDE_EXTS: string[] = [
  ...CODE_CATEGORIES.JAVASCRIPT,
  ...CODE_CATEGORIES.BACKEND,
  ...CODE_CATEGORIES.FRONTEND,
  ...CODE_CATEGORIES.CONFIG,
  ...CODE_CATEGORIES.DOCUMENTATION,
  ...CODE_CATEGORIES.SHELL,
];

/**
 * Important configuration files to prioritize
 * Categorized by purpose
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
};

/**
 * Flattened list of important files to include
 */
export const DEFAULT_INCLUDE_FILES: string[] = [
  ...CONFIG_FILE_CATEGORIES.PACKAGE_MANAGERS,
  ...CONFIG_FILE_CATEGORIES.BUILD_CONFIG,
  ...CONFIG_FILE_CATEGORIES.CONTAINERIZATION,
  ...CONFIG_FILE_CATEGORIES.PROJECT_INFO,
  ...CONFIG_FILE_CATEGORIES.VERSION_CONTROL,
  ...CONFIG_FILE_CATEGORIES.ENTRY_POINTS,
];

/**
 * Files to exclude even if they match other patterns
 * Typically large generated files or lock files
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
 * Size limits and thresholds
 */
export const FILE_SIZE_LIMITS = {
  // Maximum size for an individual file (500KB)
  MAX_INDIVIDUAL_FILE_SIZE: 500 * 1024,

  // Maximum number of files to include
  MAX_TOTAL_FILES: 100,

  // Threshold for preferring smaller files (50KB)
  SMALL_FILE_PREFERENCE_THRESHOLD: 50 * 1024,

  // Default token limit
  DEFAULT_TOKEN_LIMIT: 100000,

  // Default size limit in KB
  DEFAULT_SIZE_LIMIT_KB: 50,
};

// Export individual constants for backward compatibility
export const MAX_INDIVIDUAL_FILE_SIZE =
  FILE_SIZE_LIMITS.MAX_INDIVIDUAL_FILE_SIZE;
export const MAX_TOTAL_FILES = FILE_SIZE_LIMITS.MAX_TOTAL_FILES;
export const SMALL_FILE_PREFERENCE_THRESHOLD =
  FILE_SIZE_LIMITS.SMALL_FILE_PREFERENCE_THRESHOLD;
