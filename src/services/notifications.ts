import type { ServerResponse } from "node:http";
import type { Response } from "express";
import Redis from "ioredis";
import { REDIS_CONFIG } from "../redis";
import type { TradeMatch, Trades } from "./trading";

export type NotificationPayload = {
	type: "MATCHES_UPDATE" | "TRADES_UPDATE";
	payload: TradeMatch[] | Trades | undefined;
};

export class NotificationsService {
	private publisher: Redis;
	private subscriber: Redis;

	// private connections: Set<Response>;
	private static instance: NotificationsService;
	private userConnections: Map<string, Set<Response>> = new Map();

	private constructor() {
		this.publisher = new Redis(REDIS_CONFIG);
		this.subscriber = new Redis(REDIS_CONFIG);

		// this.connections = new Set();

		this.setupRedisErrorHandling();
		this.initializeSubscriber();
	}

	addConnection(userId: string, res: Response) {
		if (!this.userConnections.has(userId)) {
			this.userConnections.set(userId, new Set());
		}
		this.userConnections.get(userId)?.add(res);

		// Send a connection success message
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

	private setupRedisErrorHandling() {
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

	private initializeSubscriber() {
		this.subscriber.subscribe("trade-notifications");

		this.subscriber.on("message", (channel, message) => {
			if (channel === "trade-notifications") {
				const parsedMessage = JSON.parse(message);
				const { userId, ...notification } = parsedMessage;
				this.broadcastToUser(userId, JSON.stringify(notification));
			}
		});
	}

	private broadcastToUser(userId: string, message: string) {
		const userSet = this.userConnections.get(userId);
		if (userSet) {
			// biome-ignore lint/complexity/noForEach: <explanation>
			userSet.forEach((res) => {
				res.write(`data: ${message}\n\n`);
			});
		}
	}

	static getInstance(): NotificationsService {
		if (!NotificationsService.instance) {
			NotificationsService.instance = new NotificationsService();
		}
		return NotificationsService.instance;
	}

	// addConnection(res: Response) {
	// 	this.connections.add(res);
	// 	// Send a connection success message
	// 	res.write(`data: ${JSON.stringify({ type: "CONNECTED" })}\n\n`);
	// }

	// removeConnection(res: Response) {
	// 	this.connections.delete(res);
	// }

	// private broadcast(message: string) {
	// 	// biome-ignore lint/complexity/noForEach: <explanation>
	// 	const x = this.userConnections.forEach((res) => {
	// 		res.write(`data: ${message}\n\n`);
	// 	});
	// }

	async publishToUser(userId: string, notification: NotificationPayload) {
		const message = JSON.stringify({ userId, ...notification });
		await this.publisher.publish("trade-notifications", message);
	}

	async publish(notification: NotificationPayload) {
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
