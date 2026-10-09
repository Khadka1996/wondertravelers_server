// src/utils/email.util.js
// Transactional email over SMTP (SMTP_* in .env). Without SMTP settings the
// message is only logged, so local development never sends real mail.

import nodemailer from 'nodemailer';
import { logger } from './logger.util.js';

let transporter = null;

const getTransporter = () => {
	if (transporter) return transporter;
	if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;

	transporter = nodemailer.createTransport({
		host: process.env.SMTP_HOST,
		port: Number(process.env.SMTP_PORT) || 587,
		secure: process.env.SMTP_SECURE === 'true',
		auth: {
			user: process.env.SMTP_USER,
			pass: process.env.SMTP_PASSWORD,
		},
	});
	return transporter;
};

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (ch) => ({
	'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));

export async function sendEmail({ to, subject, text, html } = {}) {
	const smtp = getTransporter();
	if (!smtp) {
		logger.info('[Email] SMTP not configured - not sent', { to, subject });
		return { success: false, error: 'SMTP not configured' };
	}

	const fromAddress = process.env.SMTP_FROM_EMAIL || process.env.EMAIL_FROM || process.env.SMTP_USER;
	const fromName = process.env.EMAIL_FROM_NAME || 'Wonder Travelers';

	try {
		const info = await smtp.sendMail({
			from: `"${fromName}" <${fromAddress}>`,
			to,
			subject,
			text,
			html: html || undefined,
		});
		logger.info('[Email] Sent', { to, subject, id: info.messageId });
		return { success: true, id: info.messageId };
	} catch (error) {
		logger.error('[Email] Send failed', { to, subject, error: error.message });
		return { success: false, error: error.message };
	}
}

export async function sendPasswordResetEmail(to, resetToken) {
	const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
	const link = `${frontendUrl}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;
	const minutes = 10; // matches createPasswordResetToken in auth.model.js

	return sendEmail({
		to,
		subject: 'Reset your Wonder Travelers password',
		text: `We received a request to reset your password.\n\nOpen this link to choose a new password (valid for ${minutes} minutes):\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
		html: `<p>We received a request to reset your password.</p>
<p><a href="${escapeHtml(link)}">Choose a new password</a> (valid for ${minutes} minutes).</p>
<p>If you did not ask for this, you can ignore this email.</p>`,
	});
}
