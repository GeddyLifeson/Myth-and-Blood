import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';
import { browserScriptGlobals } from './eslint.globals.mjs';

const sharedRules = {
  'no-unused-vars': [
    'warn',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
  ],
  'no-var': 'warn',
  eqeqeq: ['warn', 'smart'],
  'no-redeclare': 'warn',
  'no-console': 'off',
  'no-empty': ['warn', { allowEmptyCatch: true }],
  'no-useless-assignment': 'warn',
  'no-regex-spaces': 'warn',
  'no-dupe-keys': 'error',
};

export default [
  {
    ignores: [
      'node_modules/**',
      'js/game-data-bundle.js',
      'data/**',
      'scripts/sim-report.json',
      'myth-and-blood.zip',
      'src/**',
      'js/types.js',
    ],
  },
  js.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: globals.browser,
    },
    rules: {
      ...sharedRules,
      // Shared helpers from units.js and other scripts are intentionally global.
      'no-undef': 'off',
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...browserScriptGlobals,
      },
    },
    rules: sharedRules,
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.mjs', 'eslint.globals.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...browserScriptGlobals },
    },
    rules: sharedRules,
  },
  {
    files: ['electron/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: sharedRules,
  },
];
