import type { UserMetadata } from '@propelauth/node';
import { describe, expect, it } from 'vitest';

import { publicUserInfo, usersToPublicUserInfo } from './publicUserInfo';

function user(partial: Partial<UserMetadata> & Pick<UserMetadata, 'userId'>): UserMetadata {
	return {
		username: 'user',
		email: 'e@example.com',
		firstName: '',
		lastName: '',
		...partial,
	} as UserMetadata;
}

describe('publicUserInfo', () => {
	it('joins first and last name when present', () => {
		expect(
			publicUserInfo(
				user({
					userId: '1',
					firstName: 'Jane',
					lastName: 'Doe',
					username: 'jd',
				})
			).name
		).toBe('Jane Doe');
	});

	it('falls back to username when name parts are empty', () => {
		expect(
			publicUserInfo(
				user({
					userId: '1',
					firstName: '',
					lastName: '',
					username: 'solo',
				})
			).name
		).toBe('solo');
	});
});

describe('usersToPublicUserInfo', () => {
	it('maps each user id to public info', () => {
		const out = usersToPublicUserInfo({
			a: user({ userId: 'a', firstName: 'A', lastName: 'One', username: 'a1' }),
			b: user({ userId: 'b', firstName: '', lastName: '', username: 'bonly' }),
		});
		expect(out.a?.name).toBe('A One');
		expect(out.b?.name).toBe('bonly');
	});
});
