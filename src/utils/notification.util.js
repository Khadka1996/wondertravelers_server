// src/utils/notification.util.js
// Lightweight notification helpers for now (console-based)

export async function sendLoginNotification(userId, details = {}) {
	const payload = {
		event: 'login',
		userId: userId || null,
		timestamp: new Date().toISOString(),
		details,
	};

	console.log('[Notification] Login:', JSON.stringify(payload));
	return { success: true, payload };
}

export async function sendSecurityAlert(userId, event = {}, level = 'high') {
	const payload = {
		event: 'security_alert',
		level,
		userId: userId || null,
		timestamp: new Date().toISOString(),
		event,
	};

	console.log('[Notification] Security Alert:', JSON.stringify(payload));
	return { success: true, payload };
}

