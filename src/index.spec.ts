import plugin from './index';

describe('http-motion-sensor plugin', () => {
  it('should export a function', () => {
    expect(typeof plugin).toBe('function');
  });

  it('should not throw when called with mock API', () => {
    const mockApi = {
      hap: {
        Service: {},
        Characteristic: {},
      },
      registerAccessory: jest.fn(),
      on: jest.fn(),
    };
    expect(() => plugin(mockApi as any)).not.toThrow();
  });
});
