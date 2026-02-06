/**
 * Pi extension that notifies WezTerm when agent turns complete.
 * Sets a user variable that WezTerm can read to change tab color.
 *
 * The tab turns blue when a turn ends, and resets when a new turn starts.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * Sets a WezTerm user variable via OSC 1337 escape sequence.
 * WezTerm reads these in format-tab-title via pane:get_user_vars()
 *
 * @param name - Variable name
 * @param value - Variable value
 */
function setWezTermUserVar(name: string, value: string): void {
	const encoded = Buffer.from(value).toString("base64");
	// OSC 1337 ; SetUserVar=name=base64value BEL
	process.stdout.write(`\x1b]1337;SetUserVar=${name}=${encoded}\x07`);
}

/**
 * Registers event handlers to notify WezTerm of turn status via user variables.
 * @param pi - Extension API for registering event handlers
 */
export default function (pi: ExtensionAPI) {
	// Turn ended - agent is done, notify user
	pi.on("turn_end", async (_event, _ctx) => {
		setWezTermUserVar("pi_status", "done");
	});

	// Turn starting - clear the notification
	pi.on("turn_start", async (_event, _ctx) => {
		setWezTermUserVar("pi_status", "working");
	});

	// Also clear on new input
	pi.on("input", async (_event, _ctx) => {
		setWezTermUserVar("pi_status", "");
		return { action: "continue" };
	});

	// Clear on session start
	pi.on("session_start", async (_event, _ctx) => {
		setWezTermUserVar("pi_status", "");
	});

	// Clear on shutdown
	pi.on("session_shutdown", async (_event, _ctx) => {
		setWezTermUserVar("pi_status", "");
	});
}
