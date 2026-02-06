/**
 * Pattern Analyzer - Analyze intent logs for optimization opportunities
 *
 * Registered as /patterns command. Reads intents.jsonl and surfaces:
 * - High-frequency tool combinations (orchestration candidates)
 * - High-hop intents (inefficient workflows)
 * - Common failures (documentation/tooling gaps)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import type { IntentTrace, IntentMetrics } from "./intent-logger.js";

const LOG_DIR = path.join(process.env.HOME || "~", ".pi", "logs", "tool-proxy");
const LOG_FILE = path.join(LOG_DIR, "intents.jsonl");

// === Analysis Types ===

/** Frequently co-occurring tool combination with usage stats. */
interface ToolCombo {
	combo: string; // "app/tool" or "app/tool1 → app/tool2"
	count: number;
	avgHops: number;
	successRate: number;
}

/** Recurring failure pattern across intents. */
interface FailurePattern {
	errorType: string;
	count: number;
	tools: string[];
	examples: string[]; // Sample error messages
}

/** Intent that required an unusually high number of tool calls. */
interface HighHopIntent {
	id: string;
	prompt: string;
	totalHops: number;
	discoveryHops: number;
	outcome: string;
	toolsUsed: string[];
}

/** Complete analysis report with combos, inefficiencies, failures, and recommendations. */
interface AnalysisReport {
	totalIntents: number;
	dateRange: { start: string; end: string };
	
	// Orchestration candidates
	frequentCombos: ToolCombo[];
	
	// Inefficiency signals
	highHopIntents: HighHopIntent[];
	avgHopsPerIntent: number;
	avgDiscoveryTax: number; // % of hops spent on discovery
	
	// Failure patterns
	failures: FailurePattern[];
	overallSuccessRate: number;
	
	// Recommendations
	recommendations: string[];
}

// === Helpers ===

/**
 * Load all intent traces from the JSONL log file.
 * @returns Array of parsed IntentTrace objects, skipping malformed lines
 */
function loadTraces(): IntentTrace[] {
	if (!fs.existsSync(LOG_FILE)) {
		return [];
	}
	
	const content = fs.readFileSync(LOG_FILE, "utf-8");
	const lines = content.trim().split("\n").filter(Boolean);
	
	return lines.map((line) => {
		try {
			return JSON.parse(line) as IntentTrace;
		} catch {
			return null;
		}
	}).filter((t): t is IntentTrace => t !== null);
}

/**
 * Analyze intent traces to produce an optimization report.
 * @param traces - Array of intent traces to analyze
 * @returns Report with combos, inefficiencies, failures, and recommendations
 */
function analyzeTraces(traces: IntentTrace[]): AnalysisReport {
	if (traces.length === 0) {
		return {
			totalIntents: 0,
			dateRange: { start: "N/A", end: "N/A" },
			frequentCombos: [],
			highHopIntents: [],
			avgHopsPerIntent: 0,
			avgDiscoveryTax: 0,
			failures: [],
			overallSuccessRate: 0,
			recommendations: ["No data yet. Use tool-proxy tools to generate traces."],
		};
	}
	
	// Date range
	const timestamps = traces.map((t) => t.timestamp).sort((a, b) => a - b);
	const dateRange = {
		start: new Date(timestamps[0]).toISOString().split("T")[0],
		end: new Date(timestamps[timestamps.length - 1]).toISOString().split("T")[0],
	};
	
	// Tool combo frequency
	const comboCount = new Map<string, { count: number; hops: number[]; successes: number }>();
	
	for (const trace of traces) {
		const tools = trace.metrics?.toolsExecuted ?? [];
		const comboKey = tools.sort().join(" + ") || "(no executions)";
		
		const existing = comboCount.get(comboKey) || { count: 0, hops: [], successes: 0 };
		existing.count++;
		existing.hops.push(trace.metrics?.totalHops ?? 0);
		if (trace.outcome === "success") existing.successes++;
		comboCount.set(comboKey, existing);
	}
	
	const frequentCombos: ToolCombo[] = Array.from(comboCount.entries())
		.map(([combo, data]) => ({
			combo,
			count: data.count,
			avgHops: data.hops.reduce((a, b) => a + b, 0) / data.hops.length,
			successRate: data.successes / data.count,
		}))
		.filter((c) => c.count >= 2) // Only show repeated patterns
		.sort((a, b) => b.count - a.count)
		.slice(0, 10);
	
	// High-hop intents
	const highHopIntents: HighHopIntent[] = traces
		.filter((t) => (t.metrics?.totalHops ?? 0) > 5)
		.map((t) => ({
			id: t.id,
			prompt: t.userPrompt.slice(0, 100) + (t.userPrompt.length > 100 ? "..." : ""),
			totalHops: t.metrics?.totalHops ?? 0,
			discoveryHops: t.metrics?.discoveryHops ?? 0,
			outcome: t.outcome,
			toolsUsed: t.metrics?.toolsExecuted ?? [],
		}))
		.sort((a, b) => b.totalHops - a.totalHops)
		.slice(0, 10);
	
	// Averages
	const totalHops = traces.reduce((sum, t) => sum + (t.metrics?.totalHops ?? 0), 0);
	const totalDiscovery = traces.reduce((sum, t) => sum + (t.metrics?.discoveryHops ?? 0), 0);
	const avgHopsPerIntent = totalHops / traces.length;
	const avgDiscoveryTax = totalHops > 0 ? (totalDiscovery / totalHops) * 100 : 0;
	
	// Failure patterns
	const failureMap = new Map<string, { count: number; tools: Set<string>; examples: string[] }>();
	
	for (const trace of traces) {
		for (const failure of trace.metrics?.failures ?? []) {
			const existing = failureMap.get(failure.errorType) || {
				count: 0,
				tools: new Set(),
				examples: [],
			};
			existing.count++;
			existing.tools.add(failure.tool);
			if (existing.examples.length < 3) {
				existing.examples.push(failure.errorMessage.slice(0, 100));
			}
			failureMap.set(failure.errorType, existing);
		}
	}
	
	const failures: FailurePattern[] = Array.from(failureMap.entries())
		.map(([errorType, data]) => ({
			errorType,
			count: data.count,
			tools: Array.from(data.tools),
			examples: data.examples,
		}))
		.sort((a, b) => b.count - a.count);
	
	// Success rate
	const successes = traces.filter((t) => t.outcome === "success").length;
	const overallSuccessRate = successes / traces.length;
	
	// Generate recommendations
	const recommendations: string[] = [];
	
	// High-frequency combos → orchestration candidates
	for (const combo of frequentCombos.slice(0, 3)) {
		if (combo.count >= 5 && combo.avgHops > 3) {
			recommendations.push(
				`Consider orchestrated tool for "${combo.combo}" (used ${combo.count}x, avg ${combo.avgHops.toFixed(1)} hops)`
			);
		}
	}
	
	// High discovery tax
	if (avgDiscoveryTax > 40) {
		recommendations.push(
			`High discovery tax (${avgDiscoveryTax.toFixed(0)}% of hops). Consider caching app context or creating shortcuts.`
		);
	}
	
	// Common failures
	for (const failure of failures.slice(0, 2)) {
		if (failure.count >= 3) {
			recommendations.push(
				`Frequent "${failure.errorType}" errors (${failure.count}x). Add to troubleshooting context or fix root cause.`
			);
		}
	}
	
	if (recommendations.length === 0) {
		recommendations.push("No significant optimization opportunities detected yet.");
	}
	
	return {
		totalIntents: traces.length,
		dateRange,
		frequentCombos,
		highHopIntents,
		avgHopsPerIntent,
		avgDiscoveryTax,
		failures,
		overallSuccessRate,
		recommendations,
	};
}

/**
 * Format an analysis report as human-readable text for the /patterns command.
 * @param report - Analysis report to format
 * @returns Formatted multi-line string
 */
function formatReport(report: AnalysisReport): string {
	const lines: string[] = [];
	
	lines.push("# Tool Proxy Pattern Analysis\n");
	lines.push(`**Intents analyzed:** ${report.totalIntents}`);
	lines.push(`**Date range:** ${report.dateRange.start} to ${report.dateRange.end}`);
	lines.push(`**Success rate:** ${(report.overallSuccessRate * 100).toFixed(0)}%`);
	lines.push(`**Avg hops/intent:** ${report.avgHopsPerIntent.toFixed(1)}`);
	lines.push(`**Discovery tax:** ${report.avgDiscoveryTax.toFixed(0)}% of hops\n`);
	
	// Recommendations
	lines.push("## Recommendations\n");
	for (const rec of report.recommendations) {
		lines.push(`- ${rec}`);
	}
	lines.push("");
	
	// Frequent combos
	if (report.frequentCombos.length > 0) {
		lines.push("## Frequent Tool Combinations\n");
		lines.push("| Combination | Count | Avg Hops | Success |");
		lines.push("|-------------|-------|----------|---------|");
		for (const combo of report.frequentCombos) {
			lines.push(
				`| ${combo.combo} | ${combo.count} | ${combo.avgHops.toFixed(1)} | ${(combo.successRate * 100).toFixed(0)}% |`
			);
		}
		lines.push("");
	}
	
	// High-hop intents
	if (report.highHopIntents.length > 0) {
		lines.push("## High-Hop Intents (>5 hops)\n");
		lines.push("| Hops | Discovery | Outcome | Prompt |");
		lines.push("|------|-----------|---------|--------|");
		for (const intent of report.highHopIntents) {
			lines.push(
				`| ${intent.totalHops} | ${intent.discoveryHops} | ${intent.outcome} | ${intent.prompt.replace(/\|/g, "\\|")} |`
			);
		}
		lines.push("");
	}
	
	// Failures
	if (report.failures.length > 0) {
		lines.push("## Failure Patterns\n");
		lines.push("| Error Type | Count | Tools |");
		lines.push("|------------|-------|-------|");
		for (const failure of report.failures) {
			lines.push(`| ${failure.errorType} | ${failure.count} | ${failure.tools.join(", ")} |`);
		}
		lines.push("");
	}
	
	return lines.join("\n");
}

// === Command Registration ===

export default function patternAnalyzer(pi: ExtensionAPI): void {
	pi.registerCommand("patterns", {
		description: "Analyze tool-proxy usage patterns for optimization opportunities",
		handler: async (args, ctx) => {
			const traces = loadTraces();
			const report = analyzeTraces(traces);
			const formatted = formatReport(report);
			
			// Output as notification for now, could also inject as message
			if (ctx.hasUI) {
				// Show summary notification
				ctx.ui.notify(
					`Analyzed ${report.totalIntents} intents. ${report.recommendations.length} recommendations.`,
					"info"
				);
			}
			
			// Return the full report to be displayed
			console.log(formatted);
		},
	});
	
	pi.registerCommand("patterns:clear", {
		description: "Clear tool-proxy intent logs",
		handler: async (_args, ctx) => {
			if (fs.existsSync(LOG_FILE)) {
				const backup = LOG_FILE + `.backup-${Date.now()}`;
				fs.renameSync(LOG_FILE, backup);
				if (ctx.hasUI) {
					ctx.ui.notify(`Logs backed up to ${path.basename(backup)} and cleared`, "info");
				}
			} else {
				if (ctx.hasUI) {
					ctx.ui.notify("No logs to clear", "info");
				}
			}
		},
	});
	
	pi.registerCommand("patterns:export", {
		description: "Export pattern analysis as JSON",
		handler: async (_args, ctx) => {
			const traces = loadTraces();
			const report = analyzeTraces(traces);
			const exportPath = path.join(LOG_DIR, `analysis-${Date.now()}.json`);
			
			fs.writeFileSync(exportPath, JSON.stringify(report, null, 2));
			
			if (ctx.hasUI) {
				ctx.ui.notify(`Exported to ${exportPath}`, "info");
			}
			console.log(exportPath);
		},
	});
}
