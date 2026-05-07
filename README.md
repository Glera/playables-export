# Playables Export

Standalone repository where every playable creative's built `dist/index.html`
lands as a single self-contained HTML file. Push this repo to Render (or any
static host) and each creative is reachable at:

```
https://<your-render-service>.onrender.com/<playable-id>.html
```

`render.yaml` at the repo root tells Render to publish the whole tree as a
static site — first push provisions the service automatically. Subsequent
pushes auto-deploy.

`index.html` at the root is auto-generated and lists every exported creative
with size + last-modified timestamp.

## Naming convention

Each creative copies as `<playable-id>.html` — same id used in `npm run release
<id>` (e.g. `merge-timepress-v1.html`, `marble-sort.html`). Re-running export
overwrites in place; no version suffixes, so URLs are stable across iterations.

## How to refresh exports

Run from the `playables/` working tree:

```bash
npm run export <playable-id>     # one creative — must be already built
npm run export:all                # all built creatives
```

The script reads `playables/<id>/dist/index.html` and copies it here. If the
dist file is missing, the script fails — run `npm run release <id>` first.

After exporting:

```bash
cd ../playables-export
git add . && git commit -m "export <id>" && git push
```

First-time Render setup:

1. Push this repo to GitHub (or any git host Render supports).
2. On render.com → New → Blueprint → pick the repo. Render reads
   `render.yaml` and provisions the static site.
3. URL appears in the Render dashboard.

## Files

- `<id>.html` — single-file playable, ready to upload.
- `index.html` — auto-regenerated landing page with the full list. Hand-edits
  are overwritten on next export.
- `.gitignore` — ignores OS metadata only.
