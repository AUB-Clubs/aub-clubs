import eslint from '@eslint/js'
import stylistic from "@stylistic/eslint-plugin"
import tseslint from "typescript-eslint"

export default tseslint.config(
  { ignores: ["build/*"] },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      '@stylistic/semi': ['error', 'never'],
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { 'argsIgnorePattern': '^_' }
      ],
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  }
)