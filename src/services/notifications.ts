import type { ServerResponse } from "node:http";
import type { Response } from "express";
import Redis from "ioredis";
import RedisMock from "ioredis-mock";
import type { TTradeMessage } from "../models/trade-message";
import type { TTradeSuggestion } from "../models/trade-suggestion";
import type { TUser } from "../models/user";
import { REDIS_CONFIG } from "../redis";
import envVars from "../utils/environment";
import type { TradeMatch, Trades } from "./trading";
export type NotificationTypes =
	| "MATCHES_UPDATE"
	| "TRADES_UPDATE"
	| "TRADES_MESSAGES_UPDATE";
export type NotificationPayload<T extends NotificationTypes> = {
	type: T;
	payload: T extends "MATCHES_UPDATE"
		? TradeMatch[]
		: T extends "TRADES_UPDATE"
			? Trades
			: T extends "TRADES_MESSAGES_UPDATE"
				? (TTradeMessage & {
						suggestion: TTradeSuggestion | null;
						sender: TUser;
					})[]
				: undefined;
};

export class NotificationsService {
	protected publisher: Redis;
	protected subscriber: Redis;

	protected static instance: NotificationsService;
	protected userConnections: Map<string, Set<Response>> = new Map();

	constructor(publisher?: Redis, subscriber?: Redis) {
		this.publisher = publisher || new Redis(REDIS_CONFIG);
		this.subscriber = subscriber || new Redis(REDIS_CONFIG);

		this.setupRedisErrorHandling();
		this.initializeSubscriber();
	}

	addConnection(userId: string, res: Response) {
		if (!this.userConnections.has(userId)) {
			this.userConnections.set(userId, new Set());
		}
		this.userConnections.get(userId)?.add(res);

		res.write(`data: ${JSON.stringify({ type: "CONNECTED" })}\n\n`);
	}
	removeConnection(userId: string, res: Response) {
		const userSet = this.userConnections.get(userId);
		if (userSet) {
			userSet.delete(res);
			if (userSet.size === 0) {
				this.userConnections.delete(userId);
			}
		}
	}

	protected setupRedisErrorHandling() {
		for (const client of [this.publisher, this.subscriber]) {
			client.on("error", (error) => {
				console.error("Redis error:", error);
			});

			client.on("connect", () => {
				console.log("Connected to redis");
			});

			client.on("reconnecting", () => {
				console.log("Reconnecting to Redis...");
			});
		}
	}

	protected initializeSubscriber() {
		this.subscriber.subscribe("trade-notifications");

		this.subscriber.on("message", (channel, message) => {
			if (channel === "trade-notifications") {
				const parsedMessage = JSON.parse(message);
				const { userId, ...notification } = parsedMessage;
				this.broadcastToUser(userId, JSON.stringify(notification));
			}
		});
	}

	protected broadcastToUser(userId: string, message: string) {
		const userSet = this.userConnections.get(userId);
		if (userSet) {
			// biome-ignore lint/complexity/noForEach: <explanation>
			userSet.forEach((res) => {
				res.write(`data: ${message}\n\n`);
			});
		}
	}

	static getInstance(): NotificationsService {
		if (envVars.get("NODE_ENV") === "test") {
			if (!TestNotificationsService.instance) {
				return new TestNotificationsService(new RedisMock(), new RedisMock());
			}
			return TestNotificationsService.instance;
		}

		if (!NotificationsService.instance) {
			NotificationsService.instance = new NotificationsService();
		}
		return NotificationsService.instance;
	}

	async publishToUser<S extends NotificationTypes>(
		userId: string,
		notification: NotificationPayload<S>,
	) {
		const message = JSON.stringify({ userId, ...notification });
		await this.publisher.publish("trade-notifications", message);
	}

	async publish<S extends NotificationTypes>(
		notification: NotificationPayload<S>,
	) {
		await this.publisher.publish(
			"trade-notifications",
			JSON.stringify(notification),
		);
	}

	cleanup() {
		this.publisher.disconnect();
		this.subscriber.disconnect();
	}
}

export class TestNotificationsService extends NotificationsService {
	protected setupRedisErrorHandling() {}
}
