// # FILE frontend/sl-dubbing-frontend-main/src/lib/types/user.ts
// # AR Shared user / auth types for menu and API headers

export type MenuUser = {
	id: string;
	name: string;
	email?: string;
	avatarUrl: string;
	credits: number | string;
};

export type AuthHeaders = {
	Authorization: string;
	'X-User-Id': string;
};
