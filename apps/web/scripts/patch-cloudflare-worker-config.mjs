import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const candidates = ['wrangler.json', '.open-next/wrangler.json', '.open-next/wrangler.jsonc'];

function walkWranglerFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) return walkWranglerFiles(fullPath);
    return /^wrangler\.jsonc?$/i.test(entry) ? [fullPath] : [];
  });
}

function patchWorkerConfig(content) {
  return content
    .replace(/"service"\s*:\s*"thutha-web-worker"/g, '"service": "thutha-web"')
    .replace(/"name"\s*:\s*"thutha-web-worker"/g, '"name": "thutha-web"')
    .replace(/\n\s*"services"\s*:\s*\[\s*\{\s*(?:\/\/[^\n]*\n\s*)*"binding"\s*:\s*"WORKER_SELF_REFERENCE"\s*,\s*(?:\/\/[^\n]*\n\s*)*"service"\s*:\s*"[^"]+"\s*\}\s*\]\s*,?/g, '');
}

const files = new Set([...candidates.map((candidate) => join(root, candidate)), ...walkWranglerFiles(join(root, '.open-next'))]);
let patched = 0;
for (const file of files) {
  if (!existsSync(file)) continue;
  const before = readFileSync(file, 'utf8');
  const after = patchWorkerConfig(before);
  if (after !== before) {
    writeFileSync(file, after);
    patched += 1;
  }
}
console.log(`Patched Cloudflare Worker config files: ${patched}`);
