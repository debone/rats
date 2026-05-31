import * as fs from 'fs';
import * as path from 'path';
import type { Plugin } from 'vite';

/**
 * Dev support for the in-engine visual timeline editor.
 *
 * Timeline choreography is committed source under `assets/timelines/<id>.json`,
 * but the runtime fetches it from `assets/timelines/<id>.json` *as served* — i.e.
 * `public/assets/timelines/`. The main asset pipeline hashes filenames
 * (`cacheBust: true`), which would break the editor's fixed-path fetch, so this
 * plugin keeps a verbatim, stable-named copy of the timelines folder in
 * `public/assets/timelines/` and:
 *
 *  - copies it on server start and build start,
 *  - (dev) watches the source folder and re-copies on change,
 *  - (dev) serves `POST /api/save-timeline`, which writes the edited doc back to
 *    BOTH the committed source and the served copy so a hard-reload round-trips.
 *  - exposes a `virtual:timeline-manifest` module listing the data-driven
 *    sequence ids, so the VFX debug launcher knows which can be edited (Phase F).
 */

const SRC_DIR = path.resolve(process.cwd(), 'assets/timelines');
const OUT_DIR = path.resolve(process.cwd(), 'public/assets/timelines');

/** Valid timeline id: keeps the save endpoint from writing outside the folder. */
const ID_RE = /^[a-zA-Z0-9_-]+$/;

/**
 * Virtual module the app imports to learn which sequences are *data-driven* (have
 * an `assets/timelines/<id>.json`). The VFX debug launcher uses it to enable the
 * "edit" action only for those — avoiding a failed fetch as the discovery
 * mechanism (Phase F).
 */
const MANIFEST_ID = 'virtual:timeline-manifest';
const RESOLVED_MANIFEST_ID = '\0' + MANIFEST_ID;

function copyAll(): void {
  if (!fs.existsSync(SRC_DIR)) return;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const file of fs.readdirSync(SRC_DIR)) {
    if (file.endsWith('.json')) fs.copyFileSync(path.join(SRC_DIR, file), path.join(OUT_DIR, file));
  }
}

/** The timeline ids backed by a committed JSON doc, sorted for stable output. */
function timelineIds(): string[] {
  if (!fs.existsSync(SRC_DIR)) return [];
  return fs
    .readdirSync(SRC_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
    .sort();
}

export function timelinesPlugin(): Plugin {
  let watcher: fs.FSWatcher | undefined;

  return {
    name: 'vite-plugin-timelines',

    buildStart() {
      copyAll();
    },

    resolveId(id) {
      if (id === MANIFEST_ID) return RESOLVED_MANIFEST_ID;
    },

    load(id) {
      if (id === RESOLVED_MANIFEST_ID) {
        return `export const TIMELINE_IDS = ${JSON.stringify(timelineIds())};\n`;
      }
    },

    configureServer(server) {
      copyAll();

      if (fs.existsSync(SRC_DIR)) {
        watcher = fs.watch(SRC_DIR, (_event, filename) => {
          if (filename?.endsWith('.json')) {
            const from = path.join(SRC_DIR, filename);
            if (fs.existsSync(from)) fs.copyFileSync(from, path.join(OUT_DIR, filename));
          }
          // A timeline added/removed changes the manifest — invalidate it so the
          // launcher's data-driven set refreshes on the next full reload.
          const mod = server.moduleGraph.getModuleById(RESOLVED_MANIFEST_ID);
          if (mod) server.moduleGraph.invalidateModule(mod);
        });
      }

      server.middlewares.use('/api/save-timeline', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const doc = JSON.parse(body) as { id?: unknown };
            if (typeof doc.id !== 'string' || !ID_RE.test(doc.id)) {
              res.statusCode = 400;
              res.end('Invalid or missing timeline id');
              return;
            }
            const json = JSON.stringify(doc, null, 2) + '\n';
            fs.mkdirSync(SRC_DIR, { recursive: true });
            fs.mkdirSync(OUT_DIR, { recursive: true });
            fs.writeFileSync(path.join(SRC_DIR, `${doc.id}.json`), json);
            fs.writeFileSync(path.join(OUT_DIR, `${doc.id}.json`), json);
            console.log(`[timelines] saved ${doc.id}.json`);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, id: doc.id }));
          } catch (err) {
            console.error('[timelines] save failed', err);
            res.statusCode = 500;
            res.end('Save failed');
          }
        });
      });
    },

    buildEnd() {
      watcher?.close();
      watcher = undefined;
    },
  };
}
