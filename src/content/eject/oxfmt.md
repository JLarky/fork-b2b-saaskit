---
title: Removing Oxfmt (easy)
---

[Oxfmt](https://oxc.rs/docs/guide/usage/formatter) is a high-performance code formatter for JavaScript and TypeScript. If you'd like to remove it:

- Open `package.json`, change the "fix" script to "yarn lint:fix", remove the "fmt" script
- In the terminal, run `rm .oxfmtrc.json .github/workflows/oxfmt.yml`
- In the terminal, run `yarn remove oxfmt`
