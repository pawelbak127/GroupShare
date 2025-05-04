// jest.setup.js
// Konfiguracja środowiska testowego dla testów jednostkowych

// Polyfill dla fetch (Node.js nie ma natywnego fetch)
global.fetch = jest.fn();

// Mock dla localStorage
class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }
}

// Przypisanie mocka localStorage do globalnego obiektu
global.localStorage = new LocalStorageMock();

// Mock dla window.fs.readFile (używany w NotificationRealtime.jsx)
global.window = Object.assign(global.window || {}, {
  fs: {
    readFile: jest.fn().mockResolvedValue(new Uint8Array())
  }
});

// Polyfill dla metody IntersectionObserver używanej w UI
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock dla toast notifications
jest.mock('@/lib/utils/notification', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn()
  },
  getNotificationLink: jest.fn().mockReturnValue('/test-link'),
  getNotificationIconConfig: jest.fn().mockReturnValue({ name: 'Bell', color: 'blue-500' }),
  getNotificationBackgroundColor: jest.fn().mockReturnValue('bg-gray-50'),
  getEntityBadgeConfig: jest.fn().mockReturnValue({ text: 'Test Entity', color: 'blue' })
}));

// Mock dla supabase-client
jest.mock('@/lib/database/supabase-client', () => ({
  channel: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn(cb => cb && cb('SUBSCRIBED')),
  removeChannel: jest.fn(),
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnValue({ data: { id: 'test-user-id' }, error: null })
}));

// Globalne czyszczenie mocków po każdym teście
afterEach(() => {
  jest.clearAllMocks();
});