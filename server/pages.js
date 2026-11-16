// Serves the HTML pages. Every page shares the same <head> links, header and
// footer, kept once in public/partials/ and pasted in where a page writes
// <!-- @head -->, <!-- @header --> or <!-- @footer -->.
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PARTS = ['head', 'header', 'footer'];
const cache = new Map();

function read(file) {
  return fs.readFileSync(path.join(PUBLIC_DIR, file), 'utf8');
}

// Scripts and styles are linked as /v/<version>/js/... and /v/<version>/css/... The version changes
// with every server start (every deploy), so a browser never mixes a new page with old files.
// A module's own imports (../app.js) stay inside the same /v/<version>/ folder automatically.
const STARTED = Date.now().toString(36);
const version = () => (process.env.NODE_ENV === 'production' ? STARTED : Date.now().toString(36));

function build(file) {
  let page = read(file);
  for (const part of PARTS) {
    page = page.replace(`<!-- @${part} -->`, () => read(`partials/${part}.html`));
  }
  return page.replace(/(href|src)="\/(css|js)\//g, `$1="/v/${version()}/$2/`);
}

// In production a page is built once; in development it is rebuilt on every
// request so edits show up without a restart.
function render(file) {
  if (process.env.NODE_ENV !== 'production') return build(file);
  if (!cache.has(file)) cache.set(file, build(file));
  return cache.get(file);
}

function sendPage(res, file, status = 200) {
  res.status(status).type('html').set('Cache-Control', 'no-cache').send(render(file));
}

module.exports = { sendPage };
