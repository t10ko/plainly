/**
 * plainly — Oh My Pi (OMP) extension.
 *
 * OMP has no output styles and does not run Claude Code's hooks.json, so this
 * extension does both of those jobs itself on every user prompt: it appends the
 * rules to the system prompt, and re-states them in a hidden message after the
 * prompt so adherence does not decay in long sessions.
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

export default function plainly(pi: ExtensionAPI): void {
	const rules = readRules();
	if (!rules) {
		pi.logger.warn(`plainly: no rules found at ${STYLE_FILE}; extension inactive`);
		return;
	}

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
				ctx.ui.notify(`Plainly is ${action} from the next prompt.`, "info");
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
			systemPrompt: event.systemPrompt.includes(rules) ? event.systemPrompt : [...event.systemPrompt, rules],
			message: { customType: "plainly", content: rules, display: false },
		};
	});
}
