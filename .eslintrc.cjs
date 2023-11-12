/* eslint-env node */
module.exports = {
  root: true,
  plugins: ['import'],
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
    '@vue/eslint-config-typescript',
    '@vue/eslint-config-prettier/skip-formatting',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    // Enforces the use of dot notation for property access when possible
    'dot-notation': 'error',

    // Prohobits default exports
    'import/no-default-export': 'error',

    // Defines which file types should have extensions in import statement
    'import/extensions': [
      'error',
      'never',
      { vue: 'always', css: 'always', scss: 'always', svg: 'always', png: 'always', gif: 'always' },
    ],

    // Enforces importing by absolute paths
    'no-restricted-imports': [
      'error',
      {
        patterns: ['.*'],
      },
    ],

    // Allows one-word component names
    'vue/multi-word-component-names': 'off',

    // Enforces hyphenation of attributes
    'vue/attribute-hyphenation': ['error', 'always'],

    // Bans usage of certain types that are discouraged by TS best practices
    // See https://typescript-eslint.io/rules/ban-types/
    '@typescript-eslint/ban-types': [
      'error',
      {
        types: {
          object: 'object type is too generic. Use an interface or an index signature instead.',
        },
        extendDefaults: true,
      },
    ],
  },
  overrides: [
    {
      files: ['*.vue', '*.d.ts'],
      rules: {
        'import/no-default-export': 'off',
      },
    },
  ],
};
