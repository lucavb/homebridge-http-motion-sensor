import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    minify: false,
    target: 'node22',
    platform: 'node',
    fixedExtension: false,
    outDir: 'dist',
    treeshake: false,
    deps: {
        neverBundle: ['homebridge'],
    },
});
