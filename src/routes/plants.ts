import { Router } from "express";
import { validateRequest } from "zod-express-middleware";
import { requireJwt, requireUser } from "../middleware/jwt";
import { validateOwnership } from "../middleware/ownership";
import plantService from "../services/plant";
import userService from "../services/user";
import { postPlantSchema, putPlantSchema } from "./schemas";

const plantsRouter = Router();

plantsRouter.use("/", requireJwt, async (req, _res, next) => {
	const userId = req.jwtPayload?.userId;
	if (!userId) {
		return next(401); // jwt malformed
	}

	const user = await userService.getById(userId);
	req.user = user;

	next();
});

plantsRouter.get("/", async (req, res, next) => {
	try {
		const user = requireUser(req);
		const plants = await plantService.getByUser(user);
		return res.send(plants);
	} catch (e) {
		return next(e);
	}
});

plantsRouter.post(
	"/",
	validateRequest({ body: postPlantSchema }),
	async (req, res, next) => {
		try {
			const { type, speciesId } = req.body;
			const user = requireUser(req);
			const newPlant = await plantService.createPlant({
				userId: user.id,
				speciesId,
				type,
			});

			return res.status(201).send(newPlant);
		} catch (e) {
			return next(e);
		}
	},
);

plantsRouter.post("/:plantId/tradeable", async (req, res, next) => {
	try {
		const user = requireUser(req);
		await plantService.makePlantTradeable(Number(req.params.plantId), user);
		return res.status(201).send();
	} catch (e) {
		return next(e);
	}
});

plantsRouter.delete("/:plantId/tradeable", async (req, res, next) => {
	try {
		const user = requireUser(req);
		await plantService.makePlantUntradeable(Number(req.params.plantId), user);
		return res.status(200).send();
	} catch (e) {
		return next(e);
	}
});

plantsRouter.delete("/:plantId", validateOwnership, async (req, res, next) => {
	try {
		const user = requireUser(req);
		await plantService.deletePlant(Number(req.params.plantId), user);
		return res.status(201).send();
	} catch (e) {
		return next(e);
	}
});

export default plantsRouter;
