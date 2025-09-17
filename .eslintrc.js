module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  rules: {
    // General rules
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/ban-types': [
      'error',
      {
        types: {
          Function: {
            message: 'Use explicit function type instead: (args: Type) => ReturnType',
          },
        },
        extendDefaults: true,
      },
    ],
    'no-case-declarations': 'error',

    // React/Next.js rules
    'react/react-in-jsx-scope': 'off', // Next.js handles React
    'react/jsx-key': 'warn',
    'react/display-name': 'warn',
    'react/prop-types': 'off', // We use TypeScript for prop validation
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  overrides: [
    {
      files: ['*.tsx', '*.ts'],
      rules: {
        'react/prop-types': 'off', // Disable prop-types in TypeScript files
      },
    },
  ],
};
