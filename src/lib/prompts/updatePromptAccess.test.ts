import { describe, expect, it } from 'vitest';

import { evaluateUpdatePromptAccess } from './updatePromptAccess';

describe('evaluateUpdatePromptAccess', () => {
	const USER_A = 'user-a';
	const USER_B = 'user-b';
	const ORG_1 = 'org-1';
	const ORG_2 = 'org-2';

	it('returns not_found when prompt does not exist', () => {
		expect(evaluateUpdatePromptAccess(undefined, USER_A, ORG_1)).toBe('not_found');
	});

	it('returns forbidden_user when actor does not own prompt', () => {
		expect(evaluateUpdatePromptAccess({ userId: USER_A, orgId: ORG_1 }, USER_B, ORG_1)).toBe(
			'forbidden_user'
		);
	});

	it('returns forbidden_org when actor owns prompt in another org', () => {
		expect(evaluateUpdatePromptAccess({ userId: USER_A, orgId: ORG_1 }, USER_A, ORG_2)).toBe(
			'forbidden_org'
		);
	});

	it('returns ok when actor owns prompt in active org', () => {
		expect(evaluateUpdatePromptAccess({ userId: USER_A, orgId: ORG_1 }, USER_A, ORG_1)).toBe('ok');
	});
});
