import { defineConfig } from 'tsup'

// Bundles index.ts (and the engine types it references) into a single self-contained
// ESM build with inlined type declarations, so the published package has no peer-dep
// relationship to the main app — installers only need partysocket at runtime.
export default defineConfig({
  entry: ['index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  // partysocket is a runtime dep — let it install via npm rather than bundling it.
  external: ['partysocket'],
})
