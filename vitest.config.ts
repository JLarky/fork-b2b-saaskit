import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
		// `serverEnv` validates on import; unit tests do not load Doppler secrets.
		env: {
			SKIP_ENV_VALIDATION: 'true',
		},
	},
});
