import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
		setupFiles: ['./vitest-setup.ts'],
		env: {
			SKIP_ENV_VALIDATION: 'true',
		},
	},
});
