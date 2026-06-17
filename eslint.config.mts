// @ts-check

import eslint from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: ['dist/**', 'node_modules/**'],
    },

    eslint.configs.recommended,
    tseslint.configs.recommended,

    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parserOptions: {
                project: './tsconfig.json',
            },
        },
        rules: {
            '@typescript-eslint/explicit-function-return-type': 'warn',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    args: 'all',
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],
            'comma-dangle': ['error', 'always-multiline'],
            'guard-for-in': 'error',
            'new-cap': 'error',
            'no-caller': 'error',
            'no-console': 'warn',
            'no-extend-native': 'error',
            'no-extra-bind': 'error',
            'no-invalid-this': 'off',
            'no-irregular-whitespace': 'error',
            'no-multi-spaces': 'error',
            'no-multi-str': 'error',
            'no-new-wrappers': 'error',
            'no-throw-literal': 'error',
            'no-trailing-spaces': 'error',
            'no-unused-expressions': 'error',
            'no-with': 'error',
            'padded-blocks': 'off',
            'prefer-promise-reject-errors': 'error',
            'space-before-function-paren': ['error', { anonymous: 'never', asyncArrow: 'always', named: 'never' }],
            'spaced-comment': ['error', 'always'],
            eqeqeq: 'error',
            indent: ['error', 4, { SwitchCase: 1 }],
            quotes: ['error', 'single'],
            semi: 'error',
        },
    },

    {
        files: ['src/**/*.spec.ts'],
        languageOptions: {
            parserOptions: {
                project: './tsconfig.spec.json',
            },
        },
        plugins: {
            vitest,
        },
        rules: {
            ...vitest.configs.recommended.rules,
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
);
