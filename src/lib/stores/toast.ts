// # FILE frontend/sl-dubbing-frontend-main/src/lib/stores/toast.ts
// # AR Reactive toast stack

import { writable } from 'svelte/store';

export type ToastKind = 'info' | 'success' | 'error' | 'warning';

export type ToastItem = {
	id: number;
	message: string;
	type: ToastKind;
};

let seq = 0;
export const toasts = writable<ToastItem[]>([]);

// # FN showToast
// # AR Push a toast notification
// # KW عام,general
export function showToast(message: string, type: ToastKind = 'info'): void {
	if (!message) return;
	const id = ++seq;
	toasts.update((list) => [...list, { id, message, type }]);
	setTimeout(() => {
		toasts.update((list) => list.filter((t) => t.id !== id));
	}, 4200);
}
