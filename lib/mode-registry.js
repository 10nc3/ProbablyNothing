const path = require('path');

const EXTENSION_MAP = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.rb': 'ruby',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.kt': 'kotlin',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.swift': 'swift',
  '.php': 'php',
  '.lua': 'lua',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.sql': 'sql',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.md': 'markdown',
  '.r': 'r',
  '.R': 'r',
  '.sol': 'solidity',
  '.zig': 'zig',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.erl': 'erlang',
  '.hs': 'haskell',
  '.ml': 'ocaml',
  '.dart': 'dart',
  '.dockerfile': 'docker',
  '.tf': 'terraform',
  '.nix': 'nix',
};

const CODE_PATTERNS = [
  { pattern: /\bfunction\s+\w+\s*\(/, lang: 'javascript' },
  { pattern: /\bconst\s+\w+\s*=\s*(?:require|async|function|\()/, lang: 'javascript' },
  { pattern: /\bimport\s+.*\s+from\s+['"]/, lang: 'javascript' },
  { pattern: /\bexport\s+(?:default|const|function|class)\b/, lang: 'javascript' },
  { pattern: /\bdef\s+\w+\s*\(.*\)\s*:/, lang: 'python' },
  { pattern: /\bclass\s+\w+(?:\(.*\))?\s*:/, lang: 'python' },
  { pattern: /\bimport\s+\w+\nfrom\s+\w+\s+import\b/, lang: 'python' },
  { pattern: /\bfn\s+\w+\s*\(.*\)\s*(?:->|{)/, lang: 'rust' },
  { pattern: /\blet\s+(?:mut\s+)?\w+\s*(?::\s*\w+)?\s*=/, lang: 'rust' },
  { pattern: /\bfunc\s+\w+\s*\(.*\)\s*(?:\w+\s*)?{/, lang: 'go' },
  { pattern: /\bpackage\s+main\b/, lang: 'go' },
  { pattern: /\bpublic\s+(?:static\s+)?(?:void|int|String|class)\s+/, lang: 'java' },
  { pattern: /\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE|ALTER\s+TABLE)\b/i, lang: 'sql' },
  { pattern: /#include\s*<\w+(?:\.h)?>/, lang: 'c' },
  { pattern: /\bstd::\w+/, lang: 'cpp' },
  { pattern: /\binterface\s+\w+\s*{/, lang: 'typescript' },
  { pattern: /:\s*(?:string|number|boolean|void)\b.*[;{]/, lang: 'typescript' },
];

function getLanguageFromExtension(filename) {
  if (!filename) return null;
  const ext = path.extname(filename).toLowerCase();
  return EXTENSION_MAP[ext] || null;
}

function detectCodeMode(attachments, extractedContent) {
  const result = { detected: false, fileName: null, language: null };

  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      const name = att.fileName || att.name || att;
      if (typeof name !== 'string') continue;
      const lang = getLanguageFromExtension(name);
      if (lang) {
        result.detected = true;
        result.fileName = name;
        result.language = lang;
        return result;
      }
    }
  }

  if (extractedContent && extractedContent.length > 0) {
    for (const item of extractedContent) {
      const text = item.text || item.content || '';
      const name = item.fileName || item.name || 'snippet';

      const extLang = getLanguageFromExtension(name);
      if (extLang) {
        result.detected = true;
        result.fileName = name;
        result.language = extLang;
        return result;
      }

      for (const { pattern, lang } of CODE_PATTERNS) {
        if (pattern.test(text)) {
          result.detected = true;
          result.fileName = name;
          result.language = lang;
          return result;
        }
      }
    }
  }

  return result;
}

module.exports = {
  detectCodeMode,
  getLanguageFromExtension,
  EXTENSION_MAP,
  CODE_PATTERNS
};
