/**
 * Ambient type for the build-time manifest provided by `vite-plugin-timelines`.
 * Lists the sequence ids that have a committed `assets/timelines/<id>.json`, so
 * the VFX debug launcher can tell data-driven sequences (editable) from purely
 * imperative ones (Phase F).
 */
declare module 'virtual:timeline-manifest' {
  export const TIMELINE_IDS: string[];
}
