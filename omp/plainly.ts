/**
 * plainly — Oh My Pi (OMP) extension.
 *
 * OMP has no output styles and does not run Claude Code's hooks.json, so this
 * extension does both of those jobs itself on every user prompt: it places the
 * rules in the system prompt once, and re-states a one-line reminder of them in
 * a hidden message after the prompt so adherence does not decay in long sessions.
 *
 * Both are laid out for the prompt cache: the rules sit inside the system-prompt
 * head that OMP caches and shares across sessions, and the per-prompt reminder is
 * one line rather than a fresh copy of every rule piling up in history each turn.
 * A footer status shows each model call's cache use so a regression is visible.
 *
 * The style file is the only copy of the rules — this module never holds a second one.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

const STYLE_FILE = path.join(import.meta.dir, "..", "output-styles", "plainly.md");

// Session entry that records /plainly on|off, so the choice survives resume and
// follows the branch it was made on.
const STATE_ENTRY = "plainly.state";

const USAGE = "Usage: /plainly on | off | status";

// System-prompt blocks that differ per session, folder, or turn. OMP's Anthropic
// provider anchors its system cache breakpoint on the block right before the first
// of these, so anything placed after them is never part of the shared cached head.
const VOLATILE_SYSTEM_MARKERS = ["<memories>", "<project-context>"];

const CACHE_STATUS_KEY = "plainly.cache";

// A call that re-writes at least this many tokens while reading under half of its
// prompt from cache is reported as a miss; smaller writes are ordinary turn growth.
const CACHE_MISS_MIN_WRITE = 10_000;

// The rule body without its YAML frontmatter, which is Claude Code style metadata.
function readRules(): string {
	try {
		return fs
			.readFileSync(STYLE_FILE, "utf8")
			.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
			.trim();
	} catch {
		return "";
	}
}

// One line naming the rules by their bold lead-ins, pointing back at the full text
// in the system prompt. Derived from the style file so it never drifts from it.
function buildReminder(rules: string): string {
	const title = rules.match(/^#\s+(.+)$/m)?.[1].replace(/\s*\([^)]*\)\s*$/, "") ?? "Plainly";
	const names = [...rules.matchAll(/^- \*\*(.+?)\*\*/gm)].map(match => match[1]);
	const list = names.length > 0 ? `: ${names.join(", ")}` : "";
	return `Plainly reply style is active. Follow every rule under "${title}" in the system prompt${list}.`;
}

// The rules placed just before the first volatile block, so they extend the cached
// head instead of trailing behind the per-folder context.
function withRules(systemPrompt: string[], rules: string): string[] {
	if (systemPrompt.includes(rules)) return systemPrompt;
	const volatileStart = systemPrompt.findIndex(block =>
		VOLATILE_SYSTEM_MARKERS.some(marker => block.startsWith(marker)),
	);
	const at = volatileStart === -1 ? systemPrompt.length : volatileStart;
	return [...systemPrompt.slice(0, at), rules, ...systemPrompt.slice(at)];
}

// On unless the latest /plainly choice on the current branch turned it off.
function isEnabled(ctx: ExtensionContext): boolean {
	const branch = ctx.sessionManager.getBranch();
	for (let i = branch.length - 1; i >= 0; i--) {
		const entry = branch[i];
		if (entry.type === "custom" && entry.customType === STATE_ENTRY) {
			return (entry.data as { enabled?: boolean } | undefined)?.enabled !== false;
		}
	}
	return true;
}

function formatTokens(count: number): string {
	return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
}

export default function plainly(pi: ExtensionAPI): void {
	const rules = readRules();
	if (!rules) {
		pi.logger.warn(`plainly: no rules found at ${STYLE_FILE}; extension inactive`);
		return;
	}
	const reminder = buildReminder(rules);

	// The first call after a session starts, switches, or compacts writes the whole
	// prompt by design, so it is never reported as a miss.
	let expectCacheWrite = true;
	const resetCacheBaseline = () => {
		expectCacheWrite = true;
	};
	pi.on("session_start", resetCacheBaseline);
	pi.on("session_switch", resetCacheBaseline);
	pi.on("session_compact", resetCacheBaseline);

	pi.registerCommand("plainly", {
		description: "Turn the Plainly reply style on or off for this session",
		getArgumentCompletions: prefix =>
			["on", "off", "status"]
				.filter(value => value.startsWith(prefix.trim().toLowerCase()))
				.map(value => ({ value, label: value })),
		handler: async (args, ctx) => {
			const action = args.trim().toLowerCase();
			if (action === "on" || action === "off") {
				pi.appendEntry(STATE_ENTRY, { enabled: action === "on" });
				ctx.ui.notify(
					`Plainly is ${action} from the next prompt, which re-reads the conversation without the prompt cache once.`,
					"info",
				);
				return;
			}
			if (action === "" || action === "status") {
				ctx.ui.notify(`Plainly is ${isEnabled(ctx) ? "on" : "off"}. ${USAGE}`, "info");
				return;
			}
			ctx.ui.notify(`Unknown option "${action}". ${USAGE}`, "warning");
		},
	});

	pi.on("before_agent_start", async (event, ctx) => {
		// The rules shape what the user reads, so subagents (whose replies go to the
		// main agent) and revived subagents (whose result OMP discards) are skipped.
		if (event.reason !== "prompt" || ctx.agent.kind !== "main" || !isEnabled(ctx)) return;
		return {
			systemPrompt: withRules(event.systemPrompt, rules),
			message: { customType: "plainly", content: reminder, display: false },
		};
	});

	// Each assistant message is one model call; its usage says how much of the
	// prompt came from cache, how much was written to it, and how much was neither.
	pi.on("message_end", async (event, ctx) => {
		if (ctx.agent.kind !== "main" || !ctx.hasUI) return;
		const message = event.message;
		if (message.role !== "assistant" || !message.usage) return;
		const { input, cacheRead, cacheWrite } = message.usage;
		const prompt = input + cacheRead + cacheWrite;
		if (prompt === 0) return;

		const hitRatio = cacheRead / prompt;
		ctx.ui.setStatus(
			CACHE_STATUS_KEY,
			`cache ${Math.round(hitRatio * 100)}% · read ${formatTokens(cacheRead)} · wrote ${formatTokens(cacheWrite)} · uncached ${formatTokens(input)}`,
		);

		if (!expectCacheWrite && hitRatio < 0.5 && cacheWrite >= CACHE_MISS_MIN_WRITE) {
			ctx.ui.notify(
				`Prompt cache missed: ${formatTokens(cacheWrite)} tokens re-written. Usual causes are idling past the cache lifetime, a model or tool change, or a changed system prompt.`,
				"warning",
			);
		}
		expectCacheWrite = false;
	});
}
