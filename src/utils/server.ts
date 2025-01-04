import cors from "cors";
import express from "express";
import type { Express } from "express-serve-static-core";
import { errorHandler } from "../middleware/error-handling";
import type { JwtPayload } from "../middleware/jwt";
import type { TUser } from "../models/user";
import routes from "../routes";
import { NotificationsService } from "../services/notifications";
// import { TUser } from '../models/user'

export default function makeServer(): Promise<Express> {
	const server = express();
	server.use(express.json());
	server.use(
		cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }),
	);
	server.use(routes);
	server.use(errorHandler);
	process.on("SIGTERM", () => {
		console.log("SIGTERM signal received: closing HTTP server");
		NotificationsService.getInstance().cleanup();
		process.exit(0);
	});
	return Promise.resolve(server);
}

declare global {
	// biome-ignore lint/suspicious/noRedeclare: <explanation>
	namespace Express {
		interface Request {
			jwtPayload?: JwtPayload;
			user?: TUser;
		}
	}
}
