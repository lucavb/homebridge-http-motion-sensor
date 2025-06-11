# Test Suite

This directory contains all testing utilities for the homebridge-http-motion-sensor plugin.

## Files

### `test.sh`

**Comprehensive functional test suite**

- Builds the plugin
- Starts Homebridge with test configuration
- Tests all motion sensor functionality
- Verifies HTTP responses, motion detection, and reset cycles
- Automatically detects CI environments
- Usage:
    ```bash
    npm test                 # Interactive mode
    npm run test:ci          # CI mode (no prompts)
    CI=true npm test         # CI mode via environment
    ```

### `manual-test.sh`

**Interactive manual testing**

- Quick setup for development testing
- Keeps Homebridge running for manual HTTP requests
- Usage:
    ```bash
    npm run test:manual
    ```

### `test-config.json`

**Test configuration**

- Homebridge configuration for testing
- Defines 2 motion sensors on ports 18089 and 18090
- Includes repeater functionality testing

## Test Commands

```bash
# Full test suite
npm test

# CI-friendly (no interactive prompts)
npm run test:ci

# Quick development testing
npm run test:quick

# Manual interactive testing
npm run test:manual

# Clean up temporary files
npm run test:clean
```

## Test Coverage

- ✅ Plugin compilation and loading
- ✅ Homebridge integration
- ✅ HTTP server startup
- ✅ Motion detection via HTTP requests
- ✅ Multiple rapid requests handling
- ✅ Different URL endpoints
- ✅ Motion reset after timeout
- ✅ Repeater functionality
- ✅ Error handling and logging
