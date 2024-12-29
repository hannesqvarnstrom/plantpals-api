import { Router } from "express";
import { validateRequest } from "zod-express-middleware";
import { requireJwt } from "../middleware/jwt";

import tradingService from "../services/trading";
import userService from "../services/user";
import { AppError } from "../utils/errors";
import { getMatchCheckSchema, postTradeSchema } from "./schemas";

const tradingRouter = Router();

tradingRouter.use("/", requireJwt, async (req, _res, next) => {
	const userId = req.jwtPayload?.userId;
	if (!userId) {
		return next(401); // jwt malformed
	}

	const user = await userService.getById(userId);
	req.user = user;

	next();
});

tradingRouter.post(
	"/",
	validateRequest({ body: postTradeSchema }),
	async (req, res, next) => {
		try {
			if (!req.user) {
				throw new AppError("");
			}
			const { plantDesiredId, plantOfferedId } = req.body;

			const result = await tradingService.createTrade({
				plantDesiredId,
				plantOfferedId,
				requestingUserId: req.user.id,
			});
			const x = await tradingService.checkStatus(result.id);
			return res.send(result);
		} catch (e) {
			return next(e);
		}
	},
);

tradingRouter.get("/", async (req, res, next) => {
	try {
		if (!req.user) {
			throw new AppError("");
		}
		const trades = await tradingService.getTrades(req.user.id);
		return res.send(trades);
	} catch (e) {
		return next(e);
	}
});

tradingRouter.get("/match", async (req, res, next) => {
	try {
		if (!req.user) {
			throw new AppError("");
		}
		const tradeMatches = await tradingService.getAllPossibleTradesForUser(
			req.user,
		);
		return res.send(tradeMatches);
	} catch (e) {
		return next(e);
	}
});

tradingRouter.get(
	"/match/check",
	validateRequest<typeof getMatchCheckSchema>({ query: getMatchCheckSchema }),
	async (req, res, next) => {
		const { objectUserId } = req.query;
		if (!objectUserId || !req.user) {
			throw new AppError("missing users");
		}
		try {
			const plantsForTradeMatch = await tradingService.getPlantsForTradeMatch(
				req.user,
				Number(objectUserId),
			);
			setTimeout(() => {
				return res.send(plantsForTradeMatch);
			}, 1000);
		} catch (e) {
			return next(e);
		}
	},
);

export default tradingRouter;
