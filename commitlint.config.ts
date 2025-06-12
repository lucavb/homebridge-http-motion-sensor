import type { UserConfig } from '@commitlint/types';

const config: UserConfig = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [
            2,
            'always',
            ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test'],
        ],
        'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
        'subject-full-stop': [2, 'never', '.'],
        'subject-empty': [2, 'never'],
        'type-empty': [2, 'never'],
        'type-case': [2, 'always', 'lower-case'],
        'body-max-line-length': [0],
    },
};

export default config;
