---
title: Removing Oxfmt (easy)
---

[Oxfmt](https://oxc.rs/docs/guide/usage/formatter) now handles formatting for the repo, with a small Astro-only Prettier fallback until `oxfmt` supports `.astro` files directly.

- Open `package.json`, change the `"fix"` script to `"yarn lint:fix"`, then remove the `"fmt"` scripts
- In the terminal, run `rm .oxfmtrc.json .github/workflows/formatting.yml`
- In the terminal, run `yarn remove oxfmt`
- If you are no longer formatting `.astro` files, you can also remove `.prettierrc`, `prettier`, `prettier-plugin-astro`, and `prettier-plugin-tailwindcss`
