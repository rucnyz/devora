import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import eslintConfigPrettier from 'eslint-config-prettier'

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-use-before-define': 'off', // Disable base rule
      '@typescript-eslint/no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'release/', 'src-tauri/'],
  },
]
