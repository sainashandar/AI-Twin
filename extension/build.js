import { build } from 'esbuild';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bundleExtension() {
  console.log('Building Chrome Extension (Manifest V3)...');

  const files = [
    { in: path.resolve(__dirname, 'background.ts'), out: 'background' },
    { in: path.resolve(__dirname, 'content.ts'), out: 'content' },
    { in: path.resolve(__dirname, 'popup.ts'), out: 'popup' },
    { in: path.resolve(__dirname, 'options.ts'), out: 'options' }
  ];

  for (const f of files) {
    if (fs.existsSync(f.in)) {
      await build({
        entryPoints: [f.in],
        outfile: path.resolve(__dirname, `${f.out}.js`),
        bundle: true,
        target: 'es2022',
        format: 'esm',
        minify: false
      });
      console.log(`✓ Built ${f.out}.js`);
    }
  }

  // Ensure icons directory exists
  const iconsDir = path.resolve(__dirname, 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // Create simple 1-pixel / valid base PNG files for extension icons if not already present
  const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
  for (const size of [16, 48, 128]) {
    const iconPath = path.resolve(iconsDir, `icon${size}.png`);
    if (!fs.existsSync(iconPath)) {
      fs.writeFileSync(iconPath, transparentPng);
    }
  }

  console.log('Extension built successfully in directory:', __dirname);
}

bundleExtension().catch(err => {
  console.error('Extension build failed:', err);
  process.exit(1);
});
