import { Router } from "express";
import { validateRequest } from "zod-express-middleware";
import {
	type JwtPayload,
	requireJwt,
	requireUser,
	verifyJwt,
} from "../middleware/jwt";

import { NotificationsService } from "../services/notifications";
import tradingService from "../services/trading";
import userService from "../services/user";
import { AppError } from "../utils/errors";
import {
	getMatchCheckSchema,
	postMakeTradeSuggestionSchema,
	postTradeSchema,
} from "./schemas";

const tradingRouter = Router();

tradingRouter.get("/updates", async (req, res, next) => {
	try {
		const authString = req.query.token as string;
		if (!authString) throw new AppError("No authorization query supplied", 401);

		const jwtPayload = verifyJwt<JwtPayload>(authString);
		if (!jwtPayload) {
			throw new AppError("Unable to verify token", 401);
		}
		const userId = jwtPayload.userId;
		if (!userId) {
			throw new AppError("Unauthorized", 401); // jwt malformed
		}

		const user = await userService.getById(userId);
		req.user = user;

		const notificationService = NotificationsService.getInstance();

		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"Access-Control-Allow-Origin": "*",
		});

		// Pass the underlying Node response object
		notificationService.addConnection(userId.toString(), res);

		req.on("close", () => {
			notificationService.removeConnection(userId.toString(), res);
		});
	} catch (e) {
		return next(e);
	}
});

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
			const user = requireUser(req);
			const { objectUserId, subjectPlantIds, objectPlantIds } = req.body;

			const result = await tradingService.createTradeAndMakeSuggestion({
				subjectUserId: user.id,
				objectUserId,
				subjectPlantIds,
				objectPlantIds,
			});

			return res.send(result);
		} catch (e) {
			return next(e);
		}
	},
);

tradingRouter.post(
	"/:tradeId/suggestions",
	validateRequest({ body: postMakeTradeSuggestionSchema }),
	async (req, res, next) => {
		try {
			const user = requireUser(req);
			const { suggestionId, subjectPlantIds, objectPlantIds } = req.body;
			const result = await tradingService.makeSuggestionForPendingTrade(
				Number(req.params.tradeId),
				suggestionId,
				user.id,
				subjectPlantIds,
				objectPlantIds,
			);

			return res.send(result);
		} catch (e) {
			return next(e);
		}
	},
);

tradingRouter.get("/", async (req, res, next) => {
	try {
		const user = requireUser(req);
		const trades = await tradingService.getTrades(user.id);
		return res.send(trades);
	} catch (e) {
		return next(e);
	}
});

tradingRouter.get("/match", async (req, res, next) => {
	try {
		const user = requireUser(req);
		const tradeMatches = await tradingService.getAllPossibleTradesForUser(user);
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

tradingRouter.get("/:tradeId", async (req, res, next) => {
	try {
		const user = requireUser(req);
		const tradeData = await tradingService.getTradeData(
			Number(req.params.tradeId),
			user,
		);
		return res.send(tradeData);
	} catch (e) {
		return next(e);
	}
});

tradingRouter.post(
	"/:tradeId/suggestions/:suggestionId/accept",
	async (req, res, next) => {
		try {
			const user = requireUser(req);
			const result = await tradingService.acceptTradeSuggestion(
				Number(req.params.tradeId),
				Number(req.params.suggestionId),
				user,
			);
			return res.send(result);
		} catch (e) {
			return next(e);
		}
	},
);
tradingRouter.post(
	"/:tradeId/suggestions/:suggestionId/decline",
	async (req, res, next) => {
		try {
			const user = requireUser(req);
			const result = await tradingService.declineTradeSuggestion(
				Number(req.params.tradeId),
				Number(req.params.suggestionId),
				user,
			);
			return res.send(result);
		} catch (e) {
			return next(e);
		}
	},
);

tradingRouter.get("/species/:speciesId", async (req, res, next) => {
	try {
		const user = requireUser(req);
		const tradeMatches = await tradingService.getTradeDataForSpeciesForUser(
			Number(req.params.speciesId),
			user,
		);
		return res.send(tradeMatches);
	} catch (e) {
		return next(e);
	}
});

tradingRouter.get(
	"/:tradeId/suggestions/:suggestionId",
	async (req, res, next) => {
		try {
			const user = requireUser(req);
			const suggestionData = await tradingService.getSuggestion(
				Number(req.params.suggestionId),
				user,
			);
			return res.send(suggestionData);
		} catch (e) {
			return next(e);
		}
	},
);

export default tradingRouter;
