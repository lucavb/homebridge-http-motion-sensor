// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    // Global ignores
    {
        ignores: ['dist/**', 'node_modules/**'],
    },

    // Base configs
    eslint.configs.recommended,
    tseslint.configs.recommended,

    // Custom overrides for TypeScript files
    {
        files: ['src/**/*.ts', 'src/**/*.tsx'],
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
);
