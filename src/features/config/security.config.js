const NODE_ENV = process.env.NODE_ENV || 'development';

const securityConfig = {
	passwordPolicy: {
		minLength: Number(process.env.PASSWORD_MIN_LENGTH) || 8,
		requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
		requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
		requireSpecial: process.env.PASSWORD_REQUIRE_SPECIAL !== 'false',
		history: Number(process.env.PASSWORD_HISTORY) || 5,
	},

	tokenExpiry: {
		access: process.env.TOKEN_EXPIRY_ACCESS || '15m',
		refresh: process.env.TOKEN_EXPIRY_REFRESH || '7d',
		resetPassword: process.env.TOKEN_EXPIRY_RESET || '10m',
	},

	rateLimits: {
		login: Number(process.env.RATE_LIMIT_LOGIN) || 30,
		api: Number(process.env.RATE_LIMIT_API) || 100,
		reset: Number(process.env.RATE_LIMIT_RESET) || 3,
	},

	session: {
		cookieName: process.env.SESSION_COOKIE_NAME || 'sid',
		maxAge: Number(process.env.SESSION_MAX_AGE) || 1000 * 60 * 60 * 24 * 7, // 7 days
		secureOnly: NODE_ENV === 'production',
		httpOnly: true,
		// ✅ IMPORTANT: Use 'Lax' for cross-domain setup (frontend: wondertravelers.com, backend: shirijanga.com)
		// 'Lax' allows cookies on safe cross-origin requests (navigation, GET)
		// Always use secure: true when frontend is HTTPS (regardless of NODE_ENV)
		sameSite: 'Lax',
	}
};

export default securityConfig;

