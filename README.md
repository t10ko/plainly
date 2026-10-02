# plainly

> Claude Code answers you can scan in three seconds.

```bash
/plugin marketplace add t10ko/plainly
/plugin install plainly@plainly
```

Then turn the style on with `/output-style plainly:Plainly`, or pick it under `/config` → Output style.

That choice applies to the current project only — to use Plainly everywhere, see [Use it in every project](#use-it-in-every-project).

---

## What it does

`plainly` is an [output style](https://code.claude.com/docs/en/output-styles) — it rewrites the system prompt so every reply arrives pre-structured for scanning.

Four rules carry most of the weight:

- **The answer comes first.** Sentence one is the verdict, not a warm-up.
- **One idea per block.** No paragraph makes you hold two thoughts at once.
- **Every idea in the container that fits it.** Tradeoffs become tables, steps become numbered lists, caveats become callouts.
- **No process narration.** You never read "let me check…" or "I was wrong about…".

It keeps Claude Code's built-in engineering instructions (`keep-coding-instructions: true`), so it changes how Claude talks, not how it codes.

---

## Before

A real default-style answer to *"why is this test failing?"*:

```text
I looked into the failing test and found the issue. The test
`test_user_expiry` is calling `datetime.now()` directly rather than going
through the project's time utility, which means it picks up the local
timezone instead of UTC. Because CI runs in UTC and your machine is at
+04:00, the assertion comparing the expiry timestamp against a fixed
value drifts by four hours and the test fails on CI but passes locally.
I'd suggest switching it to use `utc_now()` from `src/utils/time.py`,
which is what the rest of the codebase does, and that should resolve the
discrepancy. Let me know if you'd like me to make that change.
```

Everything you need is in there. You just have to read all 90 words to find it.

## After

The same answer, in `plainly`:

````markdown
---
## TIMEZONE DRIFT — CI RUNS UTC, YOU RUN +04:00
---

`test_user_expiry` fails on CI because it reads local time instead of UTC.

The test calls `datetime.now()` directly, skipping the project's time
utility, so the expiry timestamp lands four hours off the fixed value it
asserts against.

| Environment | Timezone | Result |
|---|---|---|
| Your machine | +04:00 | [PASS] |
| CI | UTC | [FAIL] |

```diff
- expires = datetime.now() + timedelta(days=30)
+ expires = utc_now() + timedelta(days=30)
```

> **Note:** `utc_now()` lives in `src/utils/time.py` and is what the rest
> of the codebase already uses.

- **Next Action:** Apply the diff and re-run `pytest test_user_expiry`.
````

The verdict is in the first line. The mechanism is in the table. The fix is a diff you can read without parsing prose.

---

## Two more comparisons

<details>
<summary><b>"Should we use Postgres or SQLite?"</b></summary>

**Before** — the tradeoffs are real, but they're buried in clauses:

```text
It depends on your deployment model. SQLite is simpler since it's a single
file with no server to run, which makes local development and testing much
easier, but it locks the whole database on writes so concurrent writers
will serialize, and it has no native network access so you can't scale
horizontally. Postgres needs a server process and more operational setup,
but handles concurrent writes properly with row-level locking and gives
you real replication options if you need to grow.
```

**After** — the same tradeoffs, readable at a glance:

````markdown
---
## POSTGRES — YOUR WRITE PATTERN DECIDES IT
---

Pick Postgres if more than one process ever writes at once; otherwise
SQLite is the cheaper choice.

| | SQLite | Postgres |
|---|---|---|
| Setup | Single file, no server | Server process required |
| Concurrent writes | Serialized, whole-DB lock | Row-level locking |
| Network access | None | Native |
| Horizontal scaling | Not possible | Replication available |

> **Warning:** SQLite's whole-database write lock is the constraint that
> usually forces the migration later — check it against your write volume
> before choosing.

- **Next Action:** Count your concurrent writers, then commit to one.
````

</details>

<details>
<summary><b>"What changed?"</b></summary>

**Before**:

```text
I've updated the auth middleware to validate the token expiry before
checking the signature, since checking the signature first was wasting
CPU on tokens that were already expired. I also added a test for the
expired-token path which didn't have coverage, and updated the docstring
to explain the ordering. All 34 tests in the auth suite pass.
```

**After**:

````markdown
---
## AUTH MIDDLEWARE — EXPIRY CHECKED BEFORE SIGNATURE
---

Expired tokens now short-circuit before signature verification, which was
burning CPU on tokens already known to be dead.

- [x] Reordered the checks in `auth/middleware.py`
- [x] Added coverage for the expired-token path
- [x] Documented why the order matters

| Check | Result |
|---|---|
| `pytest tests/auth` | `34 passed` |

- **Next Action:** Review the diff, then run the full suite before merging.
````

</details>

---

## The rules

The full ruleset lives in [`output-styles/plainly.md`](output-styles/plainly.md) — 16 rules, readable in a minute.

Beyond the four above, the ones you'll notice most:

- **Define On First Use** — every acronym, file name, or internal label gets explained the first time it appears.
- **Safety & Verbatim Evidence** — errors, warnings, and caveats are never shortened; being brief never means testing less.
- **Anti-Monotony Rhythm** — consecutive look-alike blocks are treated as a failure, not a default.
- **Casual Chat Exemption** — greetings and quick asides stay conversational; the structure applies to substance, not small talk.
- **Scope** — the rules govern chat replies only; code, commits, and files on disk keep their normal format.

---

## Use it in every project

Installed at user scope, the plugin makes the style *available* in every project, but selecting it is a separate setting: `/output-style` and `/config` save it to the current project's `.claude/settings.local.json` and nowhere else.

To select it more widely, set `outputStyle` in the settings file that matches the reach you want:

| File | Applies to |
|---|---|
| `~/.claude/settings.json` | Every project on your machine, unless a project sets its own style |
| `.claude/settings.json`, committed | Everyone working in that repository |
| `.claude/settings.local.json` | You, in that repository — what the menu writes |

```json
{ "outputStyle": "plainly:Plainly" }
```

> **Warning:** Write the full name. Claude Code prefixes a plugin's styles with the plugin name, and a value that matches no style — `"Plainly"`, say — silently gives you the Default style.

To set up a repository for your whole team, commit this as its `.claude/settings.json`. Claude Code registers the marketplace and loads the plugin for each teammate once they trust the folder:

```json
{
  "extraKnownMarketplaces": {
    "plainly": { "source": { "source": "github", "repo": "t10ko/plainly" } }
  },
  "enabledPlugins": { "plainly@plainly": true },
  "outputStyle": "plainly:Plainly"
}
```

---

## The reinforcement hook

An output style is loaded **once**, at session start, into the cached system prompt. In a long session its influence fades and replies drift back toward prose.

`plainly` ships a `UserPromptSubmit` hook that re-states the rules each turn so they stay in recent context.

**It stays silent unless Plainly is actually your active style.** A plugin hook fires whenever the plugin is *enabled*, not when the style is *selected* — so the hook resolves `outputStyle` from your settings files (local → project → user) and prints nothing unless that's Plainly — `plainly:Plainly`, or `Plainly` for a hand-copied style file.

### Turning it off

The hook costs tokens on every turn. If you'd rather not pay that:

```bash
/plugin disable plainly@plainly   # disables the style too
```

To keep the style without the hook, skip the plugin: copy [`output-styles/plainly.md`](output-styles/plainly.md) into `~/.claude/output-styles/`, then select it. A style installed by hand has no plugin prefix, so here the name is plain `Plainly`:

```json
{ "outputStyle": "Plainly" }
```

### Forcing it on

```bash
export PLAINLY_REINFORCE=1
```

This bypasses the style check entirely — useful if you drive Claude Code through `--settings` or managed settings, which the resolver cannot see.

> **Known gap:** the resolver reads `.claude/settings.local.json`, `.claude/settings.json`, and `~/.claude/settings.json`. It does not consult managed/enterprise settings or the `--settings` flag, so on those setups the hook stays silent unless you set `PLAINLY_REINFORCE=1`.

---

## How it differs from similar plugins

Two plugins already shape Claude Code's output. `plainly` overlaps with both and takes the opposite bet on structure.

| Plugin | Mechanism | Aesthetic |
|---|---|---|
| [`hyperfocus`](https://github.com/nextor2k/hyperfocus) | Skill | ADHD chunking, three modes |
| [`i-have-adhd`](https://github.com/ayghri/i-have-adhd) | Skill | Action-first, numbered steps |
| **`plainly`** | **Output style** | **Aggressive container rotation** |

The ADHD plugins use **skills**, which activate when invoked or judged relevant. An output style applies to every reply without being asked.

`plainly` also disagrees with the prose-minimal school of output style — *bullets for lists, prose for reasoning*. It treats prose as the thing to avoid: never two plain paragraphs in a row, every sentence split a decision about which container fits next. If you find heavy Markdown structure noisy rather than navigable, a plain-prose style is the better choice for you.

---

## Uninstall

```bash
/plugin uninstall plainly@plainly
/plugin marketplace remove plainly
```

Then delete `"outputStyle": "plainly:Plainly"` from any settings file that still names it — left in place, it silently falls back to the Default style.

---

## License

MIT — see [LICENSE](LICENSE).
