# Managing your products — the no-jargon guide

This is your cheat sheet for adding products, changing prices, and marking
things sold. **You do not need to know any code.** If you can copy, paste,
and type, you can run the shop.

> **The one big idea:** every product is one little text file inside the
> `_products/` folder. Editing a product = editing its file. Adding a
> product = making a new file. That's the whole system.

Everything you'll do lives here:
👉 **https://github.com/JohnWallace23/Attic-Ember/tree/main/_products**

When you save a change, the website updates itself in about **1–2 minutes**.
You don't have to "publish" or "deploy" anything.

---

## Do it all from your web browser (no computer setup needed)

You can edit everything right on GitHub — even from your phone.

### To change a price (or fix a typo, or edit a description)

1. Go to the `_products` folder (link above).
2. Click the product you want to change.
3. Click the **pencil icon ✏️** in the top-right corner.
4. Change what you need (e.g. the price number).
5. Scroll down, click the green **Commit changes** button, then **Commit changes** again in the popup.
6. Wait a minute or two, refresh your live site. Done. 🎉

### To add a brand-new product

1. Go to the `_products` folder (link above).
2. Click **Add file → Create new file** (top right).
3. Type a filename ending in `.md` — see the naming rule below.
4. Copy one of the **templates** further down this page and paste it in.
5. Fill in your details.
6. Click **Commit changes** twice. Your product is live in a minute or two.

### To mark something SOLD (instead of deleting it)

Nice for showing off what's moved. Edit the product's file and add this
line anywhere in the settings block:

```
sold: true
```

The "Add" button turns into a greyed-out "Sold." To bring it back, delete
that line (or change `true` to `false`).

### How the shop is ordered

Both the homepage and the **All Items** page sort by the `date` line in
each listing — **newest first**. So a new piece automatically goes to the
top, and you never have to renumber anything.

```
date: 2026-08-21
```

Use the day you listed it (`YYYY-MM-DD`). If two items share a date they
just group together, which is fine.

### To feature an item on the HOMEPAGE

The homepage shows a small "New arrivals" selection; the **All Items** page
(`/shop/`) always shows everything. To put an item in the homepage selection,
add this line to its settings block:

```
featured: true
```

The homepage shows the **3 most recent** featured items. Remove the line
when something's no longer new. A nice habit: keep several
items featured at a time — ideally a mix of vintage, reproduction, and
handmade so the homepage shows your whole range. (If nothing is featured,
the homepage just shows your most recent items automatically, so it's
never empty.)

---

## Naming your product files

The filename becomes part of the product's web address, so:

- Use lowercase letters, numbers, and hyphens `-` instead of spaces.
- Make it **unique** and describe the item.
- Always end it with `.md`.

✅ Good: `1960s-ghost-diecut.md`, `bleeding-heart-candle.md`
❌ Avoid: `New Product.md`, `IMG_2931.md`, `candle.md` (too vague — you'll
have more than one)

---

## Copy-paste templates

Copy **everything between the two dashed lines, including the dashed
lines**, into your new file. Then just replace the words. Keep the quotes
`" "` and the general shape exactly as they are.

### 🟥 Template: Genuine vintage find

```
---
title: "Your Item Name Here"
date: 2026-08-21
price: 48.00
era: "1950s"
category: "Paper & die-cuts"
source_type: "vintage"
images:
  - /assets/img/your-item-name/front.jpg
  - /assets/img/your-item-name/back.jpg
videos:
  - /assets/video/clip-1.mp4
description: >-
  A sentence or two about the piece — what it is, what's special about
  it, and its history. Write like you're telling a customer in person.
condition: >-
  Be honest here — note any wear, chips, fading, or repairs. Buyers
  trust sellers who point out the flaws.
---
```

*(No video? Delete the two `videos:` lines. Just one photo? Replace the
whole `images:` block with a single
`image: /assets/img/your-item-name/front.jpg`.)*

### 🟩 Template: Vendor reproduction (new stock)

```
---
title: "Your Item Name Here"
date: 2026-08-21
price: 12.00
era: "New (1950s design)"
category: "Paper & die-cuts"
source_type: "reproduction"
images:
  - /assets/img/your-item-name/front.jpg
  - /assets/img/your-item-name/back.jpg
videos:
  - /assets/video/clip-1.mp4
description: >-
  What it is, and that it's a brand-new reproduction of a classic design.
  Mention the vendor's quality if you like.
condition: >-
  New. Never displayed.
---
```

### 🟧 Template: Handmade candle (made by you)

```
---
title: "Your Candle Name Here"
date: 2026-08-21
price: 28.00
era: "Made to order"
category: "Candles"
source_type: "handmade"
images:
  - /assets/img/your-item-name/front.jpg
  - /assets/img/your-item-name/back.jpg
videos:
  - /assets/video/clip-1.mp4
description: >-
  Describe the candle — the look, the wax, the scent (or that it's
  unscented), and that you pour it yourself in small batches.
---
```

---

## What each line means (plain English)

| Line          | What to put                                                                 |
| ------------- | --------------------------------------------------------------------------- |
| `title`       | The product's name. **Keep the quotes.**                                    |
| `price`       | Just the number, like `48.00`. **No dollar sign** — the site adds it.       |
| `era`         | The little line under the name (e.g. `"1940s"`, `"Made to order"`).         |
| `category`    | The grouping label (e.g. `"Chalkware"`, `"Candles"`, `"Blow molds"`).      |
| `source_type` | **The important one.** Exactly one of: `"vintage"`, `"reproduction"`, `"handmade"`. This sets the colored badge automatically. |
| `description` | The paragraph customers read. Write naturally.                              |
| `condition`   | The honesty note for vintage/repro items. **Leave this line out for candles.** |

> **Which `source_type`?** Rule of thumb: *if you didn't make it, and it
> isn't genuinely old, it's a `reproduction`.*

---

## Adding a photo (optional — you can list before you shoot)

Until you add a photo, the product shows a nice placeholder pattern, so
it's totally fine to publish first and add the picture later.

When you're ready:

1. Put your photos in **`assets/img/your-item-name/`** — one folder per item,
   named to match the product file (Add file → Upload files on GitHub; type the
   folder name followed by `/` to create it).
2. Add this line to the product's settings block, matching your filename:

```
image: /assets/img/your-item-name/front.jpg
```

### Multiple photos (a gallery)

Got several angles? Upload all of them to `assets/img/your-item-name/`, then instead of the
single `image:` line, use an **`images:`** list — one line per photo, each
starting with two spaces and a dash:

```
images:
  - /assets/img/which-witch/front.jpg
  - /assets/img/which-witch/back.jpg
  - /assets/img/which-witch/box-damage.jpg
```

The **first photo** is the main one (it's what shows on the homepage and
shop cards). On the product page, the rest appear as little thumbnails a
shopper can click to swap the big picture. Use as many as you like.

### Adding a video

Great for showing a blow mold lit up or a candle burning. Upload your
clip to the **`assets/video`** folder (same Upload files steps as photos),
then add a **`videos:`** list to the product — one line per clip:

```
videos:
  - /assets/video/witch-glowing.mp4
```

The video shows up as a thumbnail with a ▶ play badge next to the photos;
clicking it plays the clip right in the main window. You can mix photos
and videos freely — list your `images:` and `videos:` both.

**Keep clips short** (a few seconds, ideally under ~20 MB each). Phone
videos can be huge; if one's very large, tell John/Claude and it can be
compressed. Use `.mp4` for the widest device support.

---

## Rules that keep things from breaking

1. **Keep the two `---` lines** at the very top and bottom of the settings
   block. They tell the site where the settings start and end.
2. **Prices are just numbers** — `165.00`, never `$165` or `165 dollars`.
3. **Quotes inside a title** — see below. This is the one that actually
   breaks the build.
4. **Capital letters matter in filenames.** The live site runs on Linux,
   which treats `Front.jpg` and `front.jpg` as two different files (your
   Windows PC does not). If a photo doesn't show up, check that the name
   in the settings block matches the uploaded file *exactly*, capitals
   and all.

### ⚠️ Quotes in a title (the #1 thing that breaks the site)

The title is wrapped in quotes, so a quote *inside* it ends the title
early and the whole page fails to build with a message like
*"did not find expected key"*.

**If the title contains double quotes, wrap it in single quotes:**

```
❌  title: "Halloween Works "Pumpkin Bumpkins" Scarecrow Costume"
✅  title: 'Halloween Works "Pumpkin Bumpkins" Scarecrow Costume'
```

**If the title contains an apostrophe, wrap it in double quotes:**

```
❌  title: 'Beistle Jack-o'-Lantern Man'
✅  title: "Beistle Jack-o'-Lantern Man"
```

**If it contains both**, use double quotes outside and `&quot;` for the
inner ones:

```
✅  title: "Jack-o'-Lantern Man, 24&quot; tall"
```

Simple rule of thumb: **whichever quote mark is inside your title, use
the other one to wrap it.**

That's everything. When in doubt, open an existing product in `_products/`
and copy how it's set up — they're all there as working models.
