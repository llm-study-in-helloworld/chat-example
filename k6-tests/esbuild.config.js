const { build } = require('esbuild');
const glob = require('glob');

// Find all test files
const entryPoints = glob.sync('tests/**/*.ts');

build({
  entryPoints,
  bundle: true,
  outdir: 'dist',
  platform: 'browser',
  target: 'es2015',
  format: 'cjs',
  external: ['k6', 'k6/*'],
  sourcemap: false,
  minify: false,
})
  .then(() => console.log('⚡ Build complete!'))
  .catch(() => process.exit(1)); 