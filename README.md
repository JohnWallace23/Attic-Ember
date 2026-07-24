# Attic & Ember — starter site

A free-to-host storefront: GitHub Pages (hosting + Jekyll build) + Snipcart
(cart/checkout) + Stripe or PayPal (payment processing). No monthly platform
fee — just Snipcart's usage-based cost once you're live.

## 1. Put this on GitHub

1. Create a new **public** repo on GitHub (Pages' free tier requires public,
   unless you're on GitHub Pro/Team).
2. Upload everything in this folder to the repo (or `git init`, `git add .`,
   `git commit -m "first commit"`, `git push`).
3. In the repo: **Settings → Pages → Build and deployment → Source: Deploy
   from a branch → Branch: main, folder: / (root)**. Save.
4. GitHub will build the Jekyll site automatically — no build step to
   configure. Your site will be live in a minute or two at
   `https://yourusername.github.io/repo-name`.

## 2. Get your domain pointed at it (optional but recommended)

Buy a domain (~$12–15/yr, any registrar). In the repo, add a file named
`CNAME` at the root containing just your domain, e.g. `atticandember.com`.
Then add a `CNAME` record at your registrar pointing to
`yourusername.github.io`. GitHub's docs walk through this exactly if you
search "GitHub Pages custom domain."

## 3. Set up Snipcart

1. Create a free account at snipcart.com — you can build and test
   everything before you ever pay anything.
2. Dashboard → **Account → API Keys**, copy the **Public Test API Key**.
3. Paste it into `_config.yml` as `snipcart_public_api_key`.
4. Dashboard → **Payment gateways**, connect Stripe or PayPal (you'll need
   an account with whichever you pick — Stripe is the more common choice
   and takes about 10 minutes to set up).
5. Test a purchase using Snipcart's test card numbers (in their docs) to
   confirm checkout actually works end to end.
6. When you're ready to take real money: swap in your **Live** API key,
   and switch your payment gateway from test to live mode.

## 4. Add your real products

Each product is a file in `_products/`. Copy one of the examples
(`_products/1950s-jol-diecut.md`) and edit the front matter at the top —
title, price, era, category, description, condition. The filename becomes
part of the product's unique ID, so give each one a distinct filename.

> **Not comfortable with the technical side?** See **[PRODUCTS.md](PRODUCTS.md)**
> — a plain-language, copy-paste guide for adding products, changing
> prices, and marking items sold, entirely from your web browser. No code.

Set `sold: true` on an item once it sells to grey out its button instead of
deleting the listing (nice for showing off what's moved).

### Product categories — the `source_type` field (required)

Every product **must** declare a `source_type`, so a customer always knows
at a glance what they're buying. Use exactly one of these three values:

| `source_type`  | Use it for                                                | Badge shown          |
| -------------- | --------------------------------------------------------- | -------------------- |
| `vintage`      | Genuine secondhand pieces you personally sourced          | One-of-a-kind find   |
| `reproduction` | New stock from wholesale vendors (e.g. vintagebeistle.com) | New from our vendors |
| `handmade`     | Candles and other items you make yourself                 | Handmade by us       |

The category badge then appears automatically on both the homepage cards
and the product page — you don't style anything, just set the field.
Rule of thumb: **if you didn't make it and it isn't genuinely old, it's a
`reproduction`.**

## 5. Add real photos

Drop images into `assets/img/` and reference them in a product's front
matter as `image: /assets/img/your-photo.jpg`. Until you add a photo, the
card shows a placeholder pattern instead of a broken image — so it's safe
to publish products before you've shot them, just don't forget to circle
back.

## 6. Before you actually launch

- [ ] Swap the placeholder email in the footer for your real one
- [ ] Write your real "why vintage" story on the homepage (the `#about`
      section in `index.html`) — this is doing a lot of the selling
- [ ] Confirm sales tax is configured correctly in Snipcart for Illinois
- [ ] Set up shipping rates in Snipcart (flat rate is simplest to start)
- [ ] Test a full purchase in live mode with a real card for $1 before
      telling anyone the shop is open
- [ ] Set your LLC name and Illinois sales tax info in Snipcart's
      dashboard so your invoices are correct

## Local preview (optional)

If you want to see changes before pushing, install Ruby + Jekyll and run:

```
bundle exec jekyll serve
```

Not required — GitHub will build it for you either way — but useful if
you want to check something before it's live.
