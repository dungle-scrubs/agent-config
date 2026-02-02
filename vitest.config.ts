import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["tests/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["stow/**/*.ts"],
			exclude: ["**/*.test.ts", "**/node_modules/**"],
		},
	},
});
