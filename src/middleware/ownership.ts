import type { NextFunction, Request, Response } from "express";

import plantService from "../services/plant";
import { AppError } from "../utils/errors";

export const validateOwnership = async <Params>(
	req: Request<Params>,
	res: Response,
	next: NextFunction,
) => {
	try {
		const user = req.user;
		if (!user) {
			throw new AppError("No auth supplied", 401);
		}
		const reqParams = req.params as typeof req.params & { plantId: string };
		const plantId = reqParams.plantId;
		if (!plantId) {
			throw new AppError("No plantid supplied", 400);
		}

		const plant = await plantService.getById(plantId);
		if (plant.userId !== user.id) {
			throw new AppError("Unauthorized acccess", 403);
		}

		return next();
	} catch (err) {
		console.log("error", err);
		return next(err);
	}
};
