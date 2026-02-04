/**
 * Tests for the bash backgrounding blocker
 * 
 * Run with: npx tsx ~/.pi/agent/extensions/background-tasks/blocker.test.ts
 */

// Extract the detection logic for testing - must match index.ts exactly
function shouldBlockCommand(command: string): boolean {
	// Detect & used for backgrounding
	// Key insight: a backgrounding & is a SINGLE & that is:
	// - Not preceded by another & (that would be &&)
	// - Not followed by > (that would be &> redirect)
	// - Followed by: end of string, whitespace+newline, semicolon, ), or space+word
	
	// Pattern: single & followed by end, newline, semicolon, paren, or space+word
	// (?<!&) = not preceded by &
	// (?!>) = not followed by > (excludes &>)
	// (?!&) = not followed by & (excludes &&)
	const backgroundPattern = /(?<!&)&(?!>)(?!&)(\s*$|\s*\n|\s*;|\s*\)|\s+[a-zA-Z])/;
	
	const hasBackgroundAmpersand = backgroundPattern.test(command);

	// Exclude if & only appears inside heredocs
	// Simple heuristic: if there's a heredoc marker, be conservative
	const hasHeredoc = /<<[-]?\s*['"]?\w+['"]?/.test(command);

	return hasBackgroundAmpersand && !hasHeredoc;
}

// Test cases
const tests: { cmd: string; shouldBlock: boolean; description: string }[] = [
	// Should BLOCK - backgrounding attempts
	{ cmd: './app &', shouldBlock: true, description: 'simple background' },
	{ cmd: 'cd ~/dev && ./app &', shouldBlock: true, description: 'background after &&' },
	{ cmd: './app &\nsleep 1', shouldBlock: true, description: 'background then newline' },
	{ cmd: './app &\necho done', shouldBlock: true, description: 'background then more commands' },
	{ cmd: './server &; echo started', shouldBlock: true, description: 'background then semicolon' },
	{ cmd: 'nohup ./app &', shouldBlock: true, description: 'nohup with background' },
	{ cmd: './app & ', shouldBlock: true, description: 'background with trailing space' },
	{ cmd: './app &  \n', shouldBlock: true, description: 'background with whitespace and newline' },
	{ cmd: 'pkill -f app; ./app &\nsleep 1\necho started', shouldBlock: true, description: 'kill then background then commands' },
	{ cmd: '(./app &)', shouldBlock: true, description: 'background in subshell' },
	{ cmd: '{ ./app &; }', shouldBlock: true, description: 'background in braces' },
	{ cmd: './app&', shouldBlock: true, description: 'background no space before &' },
	{ cmd: './app & disown', shouldBlock: true, description: 'background then disown' },
	{ cmd: './app &\ndisown', shouldBlock: true, description: 'background newline disown' },
	{ cmd: 'setsid ./app &', shouldBlock: true, description: 'setsid with background' },
	{ cmd: './app </dev/null &', shouldBlock: true, description: 'redirect stdin then background' },
	{ cmd: './app >/dev/null 2>&1 &', shouldBlock: true, description: 'full redirect then background' },
	{ cmd: './app > log.txt &', shouldBlock: true, description: 'stdout redirect then background' },
	{ cmd: 'sleep 10 &\nwait', shouldBlock: true, description: 'background then wait' },
	{ cmd: 'jobs &', shouldBlock: true, description: 'jobs backgrounded (weird but catches it)' },
	{ cmd: '( sleep 5 && ./app ) &', shouldBlock: true, description: 'subshell group backgrounded' },
	{ cmd: 'bash -c "./app" &', shouldBlock: true, description: 'bash -c backgrounded' },
	{ cmd: 'exec ./app &', shouldBlock: true, description: 'exec with background' },
	{ cmd: './app &\n\n\necho done', shouldBlock: true, description: 'background with multiple newlines' },
	{ cmd: 'CMD=./app; $CMD &', shouldBlock: true, description: 'variable expansion backgrounded' },
	{ cmd: './app1 &\n./app2 &\nwait', shouldBlock: true, description: 'multiple backgrounds' },
	
	// Should ALLOW - legitimate uses
	{ cmd: './app', shouldBlock: false, description: 'simple command' },
	{ cmd: 'cmd1 && cmd2', shouldBlock: false, description: 'logical AND' },
	{ cmd: 'cmd1 && cmd2 && cmd3', shouldBlock: false, description: 'chained logical AND' },
	{ cmd: 'echo hello &> /dev/null', shouldBlock: false, description: 'redirect stdout+stderr' },
	{ cmd: 'echo hello &>> file.log', shouldBlock: false, description: 'append redirect' },
	{ cmd: 'cat file 2>&1', shouldBlock: false, description: 'stderr to stdout redirect' },
	{ cmd: 'ls && echo done', shouldBlock: false, description: 'logical AND at end' },
	{ cmd: 'test -f file && cat file', shouldBlock: false, description: 'conditional execution' },
	{ cmd: 'echo "run app &"', shouldBlock: false, description: '& in quoted string' }, // Note: this might false positive, but rare
	{ cmd: 'grep "&" file.txt', shouldBlock: false, description: '& in grep pattern' }, // Note: might false positive
	{ cmd: 'curl -X POST -d "a=1&b=2" url', shouldBlock: false, description: '& in URL params' },
	{ cmd: 'echo $((1 & 2))', shouldBlock: false, description: 'bitwise AND in arithmetic' },
	{ cmd: 'cat <<EOF\nrun &\nEOF', shouldBlock: false, description: '& in heredoc' }, // Might false positive
	{ cmd: 'export VAR="a&b"', shouldBlock: false, description: '& in env var value' },
	{ cmd: "grep -E 'foo&bar' file", shouldBlock: false, description: '& in regex single quotes' },
	{ cmd: 'echo foo && bar', shouldBlock: false, description: '&& logical and' },
	{ cmd: 'true && false && true', shouldBlock: false, description: 'multiple && operators' },
	{ cmd: '[ -f file ] && cat file', shouldBlock: false, description: 'test with &&' },
	{ cmd: 'make -j4 2>&1 | tee log', shouldBlock: false, description: 'redirect in pipe' },
	{ cmd: 'diff <(cmd1) <(cmd2)', shouldBlock: false, description: 'process substitution' },
];

// Run tests
let passed = 0;
let failed = 0;

console.log('Testing bash background blocker\n');
console.log('='.repeat(60));

for (const test of tests) {
	const result = shouldBlockCommand(test.cmd);
	const ok = result === test.shouldBlock;
	
	if (ok) {
		passed++;
		console.log(`✓ ${test.description}`);
	} else {
		failed++;
		console.log(`✗ ${test.description}`);
		console.log(`  Command: ${JSON.stringify(test.cmd)}`);
		console.log(`  Expected: ${test.shouldBlock ? 'BLOCK' : 'ALLOW'}`);
		console.log(`  Got: ${result ? 'BLOCK' : 'ALLOW'}`);
	}
}

console.log('='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed > 0) {
	process.exit(1);
}
