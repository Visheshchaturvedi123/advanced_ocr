import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const errors = [];
const checked = [];

const rel = (file) => path.relative(root, file).replace(/\\/g, '/');
const exists = (file) => fs.existsSync(file) && fs.statSync(file).isFile();
const requireFile = (file, label = rel(file)) => {
  if (!exists(file)) errors.push(`Missing ${label}`);
  else {
    checked.push(file);
    if (fs.statSync(file).size === 0) errors.push(`Empty ${label}`);
  }
};
const requireDir = (dir, label = rel(dir)) => {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) errors.push(`Missing ${label}`);
  else checked.push(dir);
};

const required = [
  'index.html',
  'manifest.json',
  'background.js',
  'content.js',
  'content.css',
  'page-tools.js',
  'favicon.svg',
  'icon48.png',
  'icon128.png',
  'modules/autocine/index.html',
  'modules/scribble/index.html',
  'modules/image-lab/index.html',
  'ocr/worker.min.js',
  'ocr/tesseract-core-lstm.wasm',
  'ocr/tesseract-core-simd-lstm.wasm',
  'ocr/tesseract-core-relaxedsimd-lstm.wasm',
  'ocr/lang/eng.traineddata.gz',
  'ocr/lang/hin.traineddata.gz',
];
required.forEach((file) => requireFile(path.join(dist, file), `dist/${file}`));

let manifest = null;
try {
  manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'));
} catch (error) {
  errors.push(`Invalid manifest.json: ${error instanceof Error ? error.message : String(error)}`);
}

if (manifest) {
  if (manifest.manifest_version !== 3) errors.push('manifest_version must be 3');
  if (!manifest.background?.service_worker) errors.push('manifest background.service_worker is missing');
  else requireFile(path.join(dist, manifest.background.service_worker), manifest.background.service_worker);
  if (!manifest.action?.default_popup) errors.push('manifest action.default_popup is missing');
  else requireFile(path.join(dist, manifest.action.default_popup), manifest.action.default_popup);
  if (!manifest.chrome_url_overrides?.newtab) errors.push('manifest newtab override is missing');
  else requireFile(path.join(dist, manifest.chrome_url_overrides.newtab), manifest.chrome_url_overrides.newtab);

  const csp = manifest.content_security_policy?.extension_pages || '';
  if (!csp.includes("script-src 'self'")) errors.push("CSP must allow script-src 'self'");
  if (csp.includes('blob:')) errors.push('CSP must not allow blob: workers');

  const permissions = new Set(manifest.permissions || []);
  ['storage', 'tabs', 'scripting', 'downloads', 'management'].forEach((permission) => {
    if (!permissions.has(permission)) errors.push(`Missing permission: ${permission}`);
  });

  const resources = new Set(
    (manifest.web_accessible_resources || []).flatMap((entry) => entry.resources || [])
  );
  ['index.html', 'assets/*', 'modules/*', 'ocr/*', 'page-tools.js'].forEach((resource) => {
    if (!resources.has(resource)) errors.push(`Missing web-accessible resource: ${resource}`);
  });

  for (const script of manifest.content_scripts || []) {
    for (const file of script.js || []) requireFile(path.join(dist, file), file);
    for (const file of script.css || []) requireFile(path.join(dist, file), file);
  }

  const iconPaths = new Set([
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action?.default_icon || {}),
  ]);
  iconPaths.forEach((file) => requireFile(path.join(dist, file), file));
}

const htmlFiles = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') errors.push(`Unexpected ${entry.name} in dist`);
      else walk(full);
    } else if (entry.name.endsWith('.html')) {
      htmlFiles.push(full);
    }
    if (entry.isFile() && /^\.env(\.|$)/.test(entry.name)) errors.push(`Secret-like file in dist: ${rel(full)}`);
  }
};
if (fs.existsSync(dist)) walk(dist);
else errors.push('Missing dist directory');

for (const htmlFile of htmlFiles) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  const base = path.dirname(htmlFile);
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  for (const ref of refs) {
    if (/^(?:https?:|data:|#|mailto:)/i.test(ref)) continue;
    const clean = ref.split(/[?#]/)[0];
    if (!clean || clean === '/') continue;
    const target = clean.startsWith('/') ? path.join(dist, clean.slice(1)) : path.resolve(base, clean);
    if (!exists(target)) errors.push(`Broken asset reference in ${rel(htmlFile)}: ${ref}`);
    else checked.push(target);
  }
}

const totalBytes = fs.existsSync(dist)
  ? (() => {
      let total = 0;
      const sizeWalk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) sizeWalk(full);
          else total += fs.statSync(full).size;
        }
      };
      sizeWalk(dist);
      return total;
    })()
  : 0;

if (errors.length) {
  console.error(`Brahma dist verification failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  errors.forEach((error) => console.error(`  - ${error}`));
  process.exit(1);
}

console.log('Brahma dist verification passed.');
console.log(`  Files checked: ${new Set(checked.map((file) => path.resolve(file))).size}`);
console.log(`  HTML entry points: ${htmlFiles.length}`);
console.log(`  Build size: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
console.log('  Manifest, CSP, permissions, module entries, OCR assets, and asset references are valid.');
