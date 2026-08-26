# Changelog

## 0.1.0

Initial release.

- **Output style** — `Plainly`, 15 rules, keeps Claude Code's built-in engineering instructions.
- **Reinforcement hook** — a `UserPromptSubmit` hook that re-states the rules each turn so adherence does not decay in long sessions.
- **Hook guard** — the hook stays silent unless `Plainly` is the resolved output style, so installing the plugin never contradicts a different style.
- **Single source of truth** — the hook strips frontmatter from `output-styles/plainly.md` rather than holding its own copy of the rules.
