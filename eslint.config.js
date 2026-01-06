import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Relax some TypeScript rules for this project
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // TODO: Fix set-state-in-effect issues by extracting creator forms into separate components
      // Affected files: CommandSection, FileSection, NotesSection, RemoteIDESection, RemoteDirBrowser
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'release/'],
  }
)
