import type { UserMetadata } from '@propelauth/node';

export function publicUserInfo(user: UserMetadata) {
	return {
		userId: user.userId,
		name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username,
		pictureUrl: user.pictureUrl,
		email: user.email,
	};
}

export type PublicUserInfo = ReturnType<typeof publicUserInfo>;

export function usersToPublicUserInfo(users: { [userId: string]: UserMetadata }): {
	[userId: string]: PublicUserInfo;
} {
	return Object.fromEntries(
		Object.entries(users).map(([userId, user]) => [userId, publicUserInfo(user)])
	);
}
