// src/utils/email.util.js
// Email sending helper using Resend or placeholder mode

import { Resend } from 'resend';
import { logger } from './logger.util.js';

const resendApiKey = process.env.RESEND_API_KEY;
const emailProvider = process.env.EMAIL_PROVIDER || 'placeholder';
const enableEmailNotifications = process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'false';

let resend = null;

if (emailProvider === 'resend' && resendApiKey) {
	try {
		resend = new Resend(resendApiKey);
		logger.info('Resend email service initialized');
	} catch (err) {
		logger.error('Failed to initialize Resend:', err);
		resend = null;
	}
}

export async function sendEmail({ to, subject, text, html, attachments } = {}) {
	const payload = {
		to,
		subject,
		text,
		html: Boolean(html),
		attachments: attachments || [],
		timestamp: new Date().toISOString(),
	};

	// If notifications disabled, log only
	if (!enableEmailNotifications) {
		logger.debug('[Email] Notifications disabled - logging only:', payload);
		return {
			success: true,
			message: 'Email notifications disabled',
			payload,
		};
	}

	// Use Resend if available
	if (resend && resendApiKey) {
		try {
			const response = await resend.emails.send({
				from: `${process.env.EMAIL_FROM_NAME || 'Wondertravelers'} <${process.env.EMAIL_FROM || 'noreply@resend.dev'}>`,
				to,
				subject,
				html: html || text,
				text,
			});

			if (response.error) {
				logger.error('[Email] Resend error:', response.error);
				return {
					success: false,
					error: response.error.message || 'Unknown email error',
					payload,
				};
			}

			logger.info('[Email] Sent via Resend:', {
				id: response.data?.id,
				to,
				subject,
			});

			return {
				success: true,
				message: 'Email sent via Resend',
				id: response.data?.id,
				payload,
			};
		} catch (error) {
			logger.error('[Email] Exception:', error.message);
			return {
				success: false,
				error: error.message,
				payload,
			};
		}
	}

	// Fallback to placeholder mode
	logger.debug('[Email] Placeholder mode - logging only:', payload);
	return {
		success: true,
		message: 'Email queued (placeholder mode)',
		payload,
	};
}

