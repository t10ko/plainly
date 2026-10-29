# Changelog

## 0.3.1

Oh My Pi only — Claude Code behaviour is unchanged.

- **Rules join the cached system-prompt head** — the rules now sit just before OMP's per-folder `<project-context>` block instead of after it, so they fall under OMP's system cache breakpoint and are reused across sessions and folders instead of being re-billed behind it.
- **One-line reminder instead of a full copy each prompt** — the hidden per-prompt message is now a single line naming the rules (built from the style file's rule names), not the whole rule text. Each prompt used to add about 1,400 tokens of repeated rules to history; a two-prompt test on Sonnet 5.5 dropped the second prompt's cache write from 1,653 to 271 tokens.
- **Cache report in the footer** — after every model call the status bar shows how much of the prompt was read from cache, written to it, and sent uncached, and a warning appears when a call re-writes most of the prompt (idle past the cache lifetime, a model or tool change, a changed system prompt). The first call after a session starts, switches, or compacts is never flagged.
- **`/plainly on|off` now says it costs one uncached prompt** — toggling changes the system prompt, so the next request re-reads the conversation without the cache once.

## 0.3.0

- **Ported the latest source contract** from the upstream project — four new rules that change how replies read, not just how they're laid out:
  - **Abstract By Default** — replies say what something does and why it matters in everyday words; file names, functions, paths, and settings appear only when the reader needs them to decide or act.
  - **Functional Grounding Over Jargon** — internal code terms and acronyms must come with their concrete human outcome.
  - **Adaptive Brevity** — as short as the task allows without dropping important details; all filler and meta-talk cut.
  - **Symmetric Inquiries** — questions and option lists give brief context and symmetric `[Action] — [Tradeoff]` choices with `(Recommended)` first.
- **BLUF sharpened** — the opening sentence now states the answer in abstract, high-level terms, and the whole contract is written in simple, clear English with zero ambiguous words.
- **Scope unchanged** — the same rules govern chat replies only; code, commits, and files on disk keep their normal format.
- **Oh My Pi support** — the same marketplace now installs Plainly in [Oh My Pi](https://omp.sh). OMP has no output styles and does not run Claude Code hooks, so a small OMP extension reads the same style file and, on each prompt, appends the rules to the system prompt and re-states them in a hidden message. `/plainly on|off` toggles it per session, and subagents are left alone.

## 0.2.1

- **No more literal `<details>` tags** — the style listed collapsible `<details>` blocks as a container, but Claude Code renders Markdown without HTML, so replies showed raw `<details>`/`<summary>` tags. Secondary material now goes in a closing `### Details` section, and raw HTML is banned alongside `[!NOTE]`/`[!WARNING]`.

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
