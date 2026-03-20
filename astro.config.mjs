import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import { defineConfig } from 'astro/config';
import varlockAstroIntegration from '@varlock/astro-integration';
import checker from 'vite-plugin-checker';

const shouldSkipEnvValidation =
	!!process.env.SKIP_ENV_VALIDATION &&
	process.env.SKIP_ENV_VALIDATION !== 'false' &&
	process.env.SKIP_ENV_VALIDATION !== '0';

// https://astro.build/config
export default defineConfig({
	integrations: [react(), !shouldSkipEnvValidation && varlockAstroIntegration()].filter(Boolean),
	adapter: vercel({}),
	site: process.env.SITE_URL,
	vite: {
		plugins: [
			checker({
				typescript: true,
				overlay: { initialIsOpen: false, badgeStyle: 'left: 55px; bottom: 8px;' },
				enableBuild: false, // we already check that in `yarn ci:check`
			}),
		],
		optimizeDeps: {
			exclude: ['@resvg/resvg-js'],
		},
		build: {
			sourcemap: true /* B2B:CONFIG consider disabling sourcemaps for production */,
		},
	},
	server: {
		port: 3000,
	},
});
