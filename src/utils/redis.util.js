import { logger } from './logger.util.js';

class RedisClient {
	constructor() {
		if (RedisClient._instance) return RedisClient._instance;
		this.client = null;
		this.connected = false;
		RedisClient._instance = this;
	}

	async connect() {
		if (this.connected && this.client) return this.client;

		const url = process.env.REDIS_URL || process.env.REDIS_URI || 'redis://127.0.0.1:6379';

		try {
			const redis = await import('redis');
			const { createClient } = redis;
			this.client = createClient({ url });

			this.client.on('error', (err) => {
				logger.error('Redis client error', { message: err?.message || err });
			});

			await this.client.connect();
			this.connected = true;
			logger.info('Redis → connected');
			return this.client;
		} catch (err) {
			// If redis package isn't available or connection fails, gracefully degrade
			logger.warn('Redis not available, proceeding without it', { error: err?.message });
			this.client = null;
			this.connected = false;
			return null;
		}
	}

	getClient() {
		return this.client;
	}

	async disconnect() {
		try {
			if (this.client && typeof this.client.quit === 'function') {
				await this.client.quit();
			}
		} catch (err) {
			logger.warn('Failed to disconnect Redis client', { error: err?.message });
		} finally {
			this.client = null;
			this.connected = false;
		}
	}
}

const instance = new RedisClient();
export default instance;

