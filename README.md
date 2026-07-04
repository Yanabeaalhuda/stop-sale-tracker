# Yanabea Alhuda — Stop Sale Tracker

## How to use this on GitHub Pages

1. Upload all these files/folders to your GitHub repo, keeping the same structure:
   - `index.html` (the site itself)
   - `data/stop-sale.xlsx` (the workbook the site reads)
2. In the repo settings, enable **GitHub Pages** (Settings → Pages → Deploy from branch → `main` / root).
3. To update the tracker later: just replace the file inside `data/` with a new
   `.xlsx` export (any file name works — the site scans the `data/` folder
   automatically), commit, and push. The site re-fetches on load / Refresh.

## Logo & hero banner images

Your actual logo and slogan banner are already included in this download,
inside the `files/` folder — the app will find them there automatically,
along with your workbook in `data/`, since it now scans every folder in
the repo. You can rename the folder or move the images anywhere else in
the repo later; nothing breaks as long as the file names still follow the
rule below.

Upload two image files anywhere in the repo (any folder, any exact name),
as long as each file name **contains** one of these words:

- Logo (circle image top-left of the header): file name must contain `logo`
  — e.g. `LOGO.png`, `yanabea-logo.jpg`.
- Hero banner (the background photo behind the header): file name must
  contain `slogan`, `banner`, `cover`, or `hero` — e.g. `SLOGAN.png`.

Supported extensions: `.png .jpg .jpeg .webp .gif .svg`. If a matching file
isn't found, that part of the header simply stays plain (no broken image).

## Already built-in (no action needed)
- **All Hotels / All Room Types**: both the Hotel and Room Type dropdowns
  in the Calendar section already default to "All" on load and on refresh.
- **Room type shorthand in the calendar**: room names are auto-abbreviated
  for the small calendar tags (e.g. "Double City View" → `DBL CV`), while
  the full name still shows in the hover tooltip.
- **Manual upload box**: hidden by default — the site only reads from
  GitHub, so this doesn't need any change on your end.

## Troubleshooting: still not showing up?

- **The repo must be public.** The GitHub API calls this site makes to find
  your files run with no login — that only works for public repositories.
  If `SST` is a private repo, discovery will fail every time.
- **GitHub Pages / browser caching.** After pushing changes, hard-refresh
  the page (Ctrl+Shift+R / Cmd+Shift+R) — GitHub Pages and browsers both
  cache aggressively, so a normal refresh can show you an old cached copy
  of `index.html` for a few minutes after a push.
- Open the browser console (F12 → Console tab) and refresh — if discovery
  fails, it now logs the exact reason (e.g. "repo lookup failed: HTTP
  404" for a private/misspelled repo) instead of failing silently.

## Important: only the VISIBLE sheet tab is read

The app only reads whichever sheet tab is **not hidden** in the workbook
(right-click a tab in Excel → Unhide/Hide to control this). Keep old months
hidden as an archive; leave the current month's tab visible before you
upload — that's the tab the site will treat as the live data.

## What changed in this version
- Fixed: the app was reading every sheet in the workbook, including 25
  hidden archived month tabs, so old stop-sale marks were leaking into the
  live tracker. Now it only reads the visible tab(s).
- Fixed: "All Room Types" in the calendar now means "any room is stopped
  that day" (unioned across every room row + the All-Room-Types row),
  instead of only reflecting the literal "All RM Types & Suites" row, which
  can be blank even when specific rooms are stopped.
- Redesigned the calendar to look like a proper monthly calendar, with a
  small badge on stop-sale days showing how many room types are affected,
  and a hover tooltip listing which ones.
- **Fixed for real this time: logo/slogan/workbook discovery across ANY
  folder.** The previous approach listed the repo root, then made one
  extra API call per folder to look one level deep. Two problems: (1) it
  only went one folder deep, so anything nested further wasn't found, and
  (2) each page load could burn 3+ calls against GitHub's unauthenticated
  API limit of 60 requests/hour — a handful of test refreshes could exhaust
  that, silently breaking discovery for the rest of the hour. The app now
  fetches the entire repo file tree in a single API call (finds files at
  ANY depth, in ANY folder, with 2 total requests instead of N), and
  caches whatever it finds in the browser's local storage so a temporary
  GitHub hiccup or rate-limit doesn't wipe out a logo/slogan/workbook that
  were already found before.
- **New: a second, GitHub-API-independent way of finding your files.**
  The GitHub API method above only works if the site is on a `*.github.io`
  address, the repo is public, and GitHub's API happens to be reachable at
  that moment. As a safety net, the app now ALSO tries fetching a
  shortlist of common paths directly (`data/`, `files/`, `assets/`,
  `images/`, plus the repo root, each checked for `LOGO.png`,
  `SLOGAN.png`, and a few common variants) — a plain file request that
  works no matter how the site is hosted. If either method finds the
  files, they'll show up.
- "Expand all hotels" is now **checked by default**, so hotel cards open
  automatically on first load instead of requiring a manual click.
- Dropdowns in the Calendar section now default to "All Hotels" / "All
  Room Types" reliably on every load (previously the browser could
  silently restore your last-picked hotel on refresh).
- **Audit Optimizations & Security Enhancements**:
  - Image assets (`LOGO.png` & `SLOGAN.png`) compressed from **3.46 MB** down to **~195 KB** (>94% bandwidth reduction).
  - Network fallback probing algorithm optimized with batched `HEAD` requests to eliminate browser request queue saturation.
  - Added full keyboard accessibility (`Tab`, `Enter`, `Space`) and ARIA grid/accordion semantics (`role="button"`, `aria-expanded`) across all hotel cards and interactive controls.
  - Subresource Integrity (SRI) hash added to external CDN scripts along with local offline library fallbacks.
