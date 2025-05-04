// jest.config.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Ścieżka do aplikacji Next.js
  dir: './',
});

// Konfiguracja Jest dostosowana do aplikacji Next.js
const customJestConfig = {
  // Dodaj więcej opcji konfiguracji tutaj jeśli potrzeba
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    // Obsługa aliasów z Next.js
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/services/notification/**/*.js',
    'src/components/notifications/**/*.jsx',
    'src/app/api/notifications/**/*.js',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

// createJestConfig jest eksportowane w ten sposób, aby zapewnić
// pobranie i przetworzenie ustawień Next.js
module.exports = createJestConfig(customJestConfig);