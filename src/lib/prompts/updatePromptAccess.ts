export type PromptOwnerRecord = {
	userId: string;
	orgId: string;
};

export type UpdatePromptAccessResult = 'ok' | 'not_found' | 'forbidden_user' | 'forbidden_org';

export function evaluateUpdatePromptAccess(
	prompt: PromptOwnerRecord | undefined,
	actorUserId: string,
	requiredOrgId: string
): UpdatePromptAccessResult {
	if (!prompt) {
		return 'not_found';
	}

	if (prompt.userId !== actorUserId) {
		return 'forbidden_user';
	}

	if (prompt.orgId !== requiredOrgId) {
		return 'forbidden_org';
	}

	return 'ok';
}
