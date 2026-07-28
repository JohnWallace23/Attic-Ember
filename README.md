# Attic & Ember

Internal maintenance notes for **John & Ashleigh**. Our shop for vintage
Halloween collectibles, honest reproductions, and handmade candles. This is
the doc to open when we forget how something works — mostly, how to add and
edit products.

---

## Hosting & deploys

- **Live site:** https://attic-ember.pages.dev
- **Host:** Cloudflare Pages, connected to this GitHub repo through Cloudflare's
  Git integration.
- **Deploys are automatic.** Every push to the **`main`** branch makes Cloudflare
  rebuild and redeploy in ~1–2 minutes. No manual deploy step, no publish button.
- **GitHub is just storage now** — the code, the product files, and the version
  history. It does *not* serve the site anymore. (We used to be on GitHub Pages;
  that's turned off.)
- **Build:** Cloudflare runs Jekyll against the `Gemfile` — plain Jekyll 4.3 +
  `jekyll-feed`. No `github-pages` gem, no committed `Gemfile.lock`.

**The whole workflow:** change a file → commit → push → Cloudflare redeploys.
Editing locally and editing directly on github.com both end up the same place.

---

## Where things live

| Path | What it is |
| --- | --- |
| `_products/` | One file per product. **This is what we touch most.** |
| `assets/img/` | Product photos |
| `assets/video/` | Product videos |
| `index.html` | Homepage — hero, featured products, our story |
| `shop.html` | The All Items page (filter + sort) |
| `_layouts/`, `_includes/` | Page templates — leave alone unless changing design |
| `assets/css/attic.css` | All the styling |
| `_config.yml` | Site-wide settings |
| `PRODUCTS.md` | Plain-language, copy-paste product guide (companion to this) |

---

## Adding & editing products

Every product is one text file in `_products/`, e.g. `spooky-tree.md`. The block
between the `---` lines at the top ("front matter") holds all the settings.

Two rules that bite:
- **The filename must end in `.md`** or Jekyll ignores the file and the product
  never appears. (Happened to us once with `spooky-tree`.)
- The filename becomes the product's web address and unique ID — make it
  **lowercase-with-hyphens and distinct**, e.g. `monster-mash-book.md`.

### Front matter fields

| Field | Required? | What it controls |
| --- | --- | --- |
| `title` | yes | Name shown everywhere. Keep the quotes. For an inch mark, type `&quot;` (e.g. `24&quot;` → 24″). |
| `price` | yes | Just the number — `50.00`. **No `$`.** |
| `source_type` | yes | One of `vintage`, `reproduction`, `handmade`. Sets the colored badge automatically (see below). |
| `category` | yes | Free-text item type shown under the title — `Housewares`, `Candles`, `Lighted & Animated Decor`, whatever fits. |
| `era` | optional | Small line by the title — `1980s`, `Made to order`, etc. |
| `description` | yes | The paragraph shoppers read. |
| `condition` | vintage / repro | Honest wear note. Skip it for handmade candles. |
| `image` | optional | A single photo path: `/assets/img/file.jpg`. |
| `images` | optional | Several photos as a list → a gallery. First one is the main/card photo. Use this **or** `image`, not both. |
| `videos` | optional | Video clips as a list: `/assets/video/file.mp4`. Show up as a ▶ thumbnail in the gallery. |
| `featured` | optional | `true` = also feature it on the homepage. Leave off = only on the All Items page. |
| `sold` | optional | `true` = greys the button to "Sold" instead of deleting the listing. |

There is **no separate `badge` field** — the badge comes entirely from
`source_type`. Setting `badge:` does nothing; don't bother.

### The three `source_type` values

| `source_type` | Badge it shows | Use it for |
| --- | --- | --- |
| `vintage` | One-of-a-kind find | Genuine old pieces we sourced |
| `reproduction` | New from our vendors | New stock from wholesale vendors |
| `handmade` | Handmade by us | Candles / things we make ourselves |

Rule of thumb: **if we didn't make it and it isn't genuinely old, it's a
`reproduction`.**

### Photos & videos

- Upload photos to `assets/img/` and videos to `assets/video/` **first**, then
  reference them by path.
- Multiple photos → use the `images:` list; the **first** one is the main photo
  and the one shown on cards.
- Keep files small — phone photos/videos are huge. Photos ideally under ~1 MB;
  clips as **`.mp4`** (not `.MOV`, which some browsers won't play). If something's
  oversized, it can be compressed.
- No photo yet? Leave the image lines out entirely — the card shows a placeholder,
  so it's fine to list a product before shooting it.

### A full example

```
---
title: "Spooky Tree by Hallmark"
price: 40.00
era: "2000s"
category: "Lighted & Animated Decor"
source_type: "vintage"
images:
  - /assets/img/Spooky-Tree-Front.jpg
  - /assets/img/Spooky-Tree-Back.jpg
videos:
  - /assets/video/Spooky-Tree.mp4
featured: true
description: >-
  Hallmark Spooky Tree animated plush with the original hang-tag — lights
  up, sings, and the owls move.
condition: >-
  Fully working and in great shape (see video).
---
```

---

## Quick walkthrough: add a product

Same result whether you do it on github.com or locally.

**On github.com** (no setup, works from a phone):
1. Upload the media: open `assets/img` (or `assets/video`) → **Add file → Upload
   files** → **Commit changes**.
2. Open `_products` → **Add file → Create new file**.
3. Name it `something-descriptive.md` — **must end in `.md`**.
4. Paste the contents of an existing product (open one and copy) or a template
   from `PRODUCTS.md`, then fill in the fields.
5. **Commit changes.** Cloudflare redeploys in ~1–2 minutes. Done.

**Locally** (repo cloned on your machine):
1. Copy an existing file in `_products/`, rename it, edit the fields.
2. Drop the photos in `assets/img/` (and videos in `assets/video/`).
3. `git add . && git commit -m "Add <product>" && git push` → Cloudflare redeploys.

To **change a price** or **mark something sold**, just open its file, edit
`price:` or add `sold: true`, and commit. `PRODUCTS.md` is the friendlier,
copy-paste version of all this.

> **If both of us are editing:** when you've made changes on github.com, run
> `git pull` on any local copy before editing there, so the two don't drift.

---

## Checkout is not wired up yet (on purpose)

The templates include a cart button and Snipcart hooks, but **checkout is
intentionally not connected.** We're building the site itself first — nobody can
actually buy anything until we set up Snipcart + a payment gateway down the road.
This is expected, not a bug or a missing step.

---

## Local preview (optional)

Not required — Cloudflare builds the real thing. But to preview before pushing:

```
bundle install        # first time, and any time the Gemfile changes
bundle exec jekyll serve --livereload
```

Then open the local URL it prints. Notes:
- Needs Ruby + Bundler installed on the machine.
- `bundle install` creates a `Gemfile.lock` locally. **Leave it uncommitted** —
  we keep it out of git on purpose (a Windows-pinned lock broke Cloudflare builds
  before).

---

## Credits

- Ambient fire sound: *"Fireplace Sound Loop"* by **NenadSimic** via
  [OpenGameArt.org](https://opengameart.org/content/fireplace-sound-loop) —
  **CC0 / public domain** (no attribution required; credited here for our own
  records). Compressed to a small mono MP3.
