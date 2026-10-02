# Changelog

## 0.2.0

- **Casual Chat Exemption** — new rule: greetings and quick one-off questions get relaxed replies instead of the full structure. It first landed under 0.1.0 without a version bump, so installs cached at 0.1.0 never received it.
- **Hook fires for the real style name** — Claude Code names a plugin's style `plainly:Plainly`, which is what `/output-style` and `/config` save; the hook only recognised `Plainly`, so it stayed silent for anyone who selected the style normally.
- **No more plugin load error** — `plugin.json` no longer re-declares `hooks/hooks.json`, which Claude Code loads automatically and was reporting as a duplicate.
- **README** — documents the `plainly:Plainly` name and how to turn the style on for every project or a whole team.

## 0.1.0

Initial release.

- **Output style** — `Plainly`, 15 rules, keeps Claude Code's built-in engineering instructions.
- **Reinforcement hook** — a `UserPromptSubmit` hook that re-states the rules each turn so adherence does not decay in long sessions.
- **Hook guard** — the hook stays silent unless `Plainly` is the resolved output style, so installing the plugin never contradicts a different style.
- **Single source of truth** — the hook strips frontmatter from `output-styles/plainly.md` rather than holding its own copy of the rules.
