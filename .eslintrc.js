module.exports = {
    extends: [
      'next/core-web-vitals',
      '@typescript-eslint/recommended',
      'plugin:react/recommended',
      'plugin:react-hooks/recommended'
    ],
    parser: '@typescript-eslint/parser',
    plugins: [
      '@typescript-eslint',
      'react',
      'react-hooks',
      'import',
      'jsx-a11y'
    ],
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      // TypeScript Rules
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-const': 'error',
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-inferrable-types': 'error',
      
      // React Rules
      'react/react-in-jsx-scope': 'off', // Not needed in Next.js 13+
      'react/prop-types': 'off', // Using TypeScript instead
      'react/display-name': 'warn',
      'react/no-unescaped-entities': 'error',
      'react/jsx-key': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-undef': 'error',
      'react/jsx-uses-react': 'off', // Not needed in Next.js 13+
      'react/jsx-uses-vars': 'error',
      'react/no-danger': 'warn',
      'react/no-deprecated': 'warn',
      'react/no-direct-mutation-state': 'error',
      'react/no-unknown-property': 'error',
      'react/require-render-return': 'error',
      
      // React Hooks Rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      
      // Import Rules
      'import/order': ['error', {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index'
        ],
        'newlines-between': 'never',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true
        }
      }],
      'import/no-unused-modules': 'warn',
      'import/no-cycle': 'error',
      'import/no-self-import': 'error',
      'import/no-duplicates': 'error',
      
      // General JavaScript Rules
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'error',
      'no-alert': 'warn',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-unused-expressions': 'error',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      'no-void': 'error',
      'no-with': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
      
      // Accessibility Rules
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/heading-has-content': 'error',
      'jsx-a11y/iframe-has-title': 'error',
      'jsx-a11y/img-redundant-alt': 'error',
      'jsx-a11y/no-access-key': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      
      // Custom EchoFi Rules
      'prefer-const': 'error',
      'no-magic-numbers': ['warn', { 
        ignore: [0, 1, -1, 2, 10, 100, 1000],
        ignoreArrayIndexes: true,
        enforceConst: true,
        detectObjects: false
      }],
      
      // Performance Rules
      'no-await-in-loop': 'warn',
      'no-async-promise-executor': 'error',
      'require-atomic-updates': 'error',
      
      // Security Rules
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
    },
    
    // Environment-specific overrides
    overrides: [
      // Configuration files
      {
        files: [
          '*.config.js',
          '*.config.ts',
          'next.config.js',
          'tailwind.config.js'
        ],
        rules: {
          '@typescript-eslint/no-var-requires': 'off',
          'no-undef': 'off'
        }
      },
      
      // Test files
      {
        files: [
          '**/__tests__/**/*',
          '**/*.{test,spec}.{js,ts,tsx}'
        ],
        env: {
          jest: true,
          'jest/globals': true
        },
        plugins: ['jest'],
        extends: ['plugin:jest/recommended'],
        rules: {
          'jest/no-disabled-tests': 'warn',
          'jest/no-focused-tests': 'error',
          'jest/no-identical-title': 'error',
          'jest/prefer-to-have-length': 'warn',
          'jest/valid-expect': 'error',
          '@typescript-eslint/no-non-null-assertion': 'off',
          'no-magic-numbers': 'off'
        }
      },
      
      // Scripts and tools
      {
        files: [
          'scripts/**/*',
          'tools/**/*'
        ],
        env: {
          node: true
        },
        rules: {
          'no-console': 'off',
          '@typescript-eslint/no-var-requires': 'off',
          'no-process-exit': 'off'
        }
      },
      
      // Component files
      {
        files: [
          'src/components/**/*.{ts,tsx}'
        ],
        rules: {
          // Enforce component naming conventions
          'prefer-const': 'error',
          'react/jsx-pascal-case': 'error',
          
          // Enforce proper hook usage
          'react-hooks/rules-of-hooks': 'error',
          'react-hooks/exhaustive-deps': 'error',
          
          // Performance optimizations
          'react/jsx-no-bind': ['warn', {
            allowArrowFunctions: true,
            allowBind: false,
            allowFunctions: false
          }]
        }
      },
      
      // Hook files
      {
        files: [
          'src/hooks/**/*.{ts,tsx}'
        ],
        rules: {
          'react-hooks/rules-of-hooks': 'error',
          'react-hooks/exhaustive-deps': 'error'
        }
      },
      
      // API routes
      {
        files: [
          'src/app/api/**/*.{ts,tsx}',
          'pages/api/**/*.{ts,tsx}'
        ],
        env: {
          node: true
        },
        rules: {
          'no-console': ['warn', { allow: ['warn', 'error', 'info', 'log'] }]
        }
      }
    ],
    
    // Global ignore patterns
    ignorePatterns: [
      'node_modules/',
      '.next/',
      'out/',
      'dist/',
      'build/',
      '*.min.js',
      'public/',
      '.vercel/',
      'coverage/',
      '*.config.js'
    ],
    
    // Parser options
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      ecmaFeatures: {
        jsx: true
      },
      project: './tsconfig.json'
    },
    
    env: {
      browser: true,
      es2022: true,
      node: true
    }
  };