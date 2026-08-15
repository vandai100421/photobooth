const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/', 'dist/', 'coverage/', '*.log'],
  },
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      indent: ['error', 2, { SwitchCase: 1 }],
      quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      semi: ['error', 'always'],
      'comma-dangle': ['error', 'always-multiline'],
      'max-len': [
        'error',
        {
          code: 100,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
        },
      ],
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-trailing-spaces': 'error',
      'eol-last': ['error', 'always'],
      'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
    },
  },
];
