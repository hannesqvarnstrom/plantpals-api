export const REDIS_CONFIG = {
	host: process.env.REDIS_HOST || "redis",
	port: Number.parseInt(process.env.REDIS_PORT || "6379"),
	retryStrategy: (times: number) => {
		const delay = Math.min(times * 50, 2000);
		return delay;
	},
	maxRetriesPerRequest: 3,
};