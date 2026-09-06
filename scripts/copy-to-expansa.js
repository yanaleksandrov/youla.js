// Copies every built, non-minified "dist/js/*.js" file into the Expansa project, which vendors
// Youla.js by source file rather than as an npm dependency. Skips silently (not an error) when
// that project isn't checked out next to this one, so `npm run build` still succeeds for anyone
// else without this local sibling folder.
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '..', 'dist', 'js');
const DEST_DIR = 'D:\\projects\\expansa\\src\\js';

if (!fs.existsSync(DEST_DIR)) {
  console.warn(`[copy-to-expansa] Skipped: "${DEST_DIR}" not found on this machine.`);
  process.exit(0);
}

const files = fs.readdirSync(SRC_DIR).filter(file => file.endsWith('.js') && !file.endsWith('.min.js'));

files.forEach(file => fs.copyFileSync(path.join(SRC_DIR, file), path.join(DEST_DIR, file)));

console.log(`[copy-to-expansa] Copied ${files.length} file(s) to ${DEST_DIR}`);
