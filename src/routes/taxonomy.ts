import { Router } from "express";
import { validateRequest } from "zod-express-middleware";
import dbManager from "../db";
import {
	allowJwtButNotRequire,
	requireJwt,
	requireUser,
} from "../middleware/jwt";
import taxonomyService from "../services/taxonomy";
import userService from "../services/user";
import { AppError } from "../utils/errors";
import {
	genusSearchSchema,
	getClassificationSchema,
	getLowerTaxaSchema,
	getNamePreviewSchema,
	postSpeciesSubmissionSchema,
	speciesSearchSchema,
} from "./schemas";

const taxonomyRouter = Router();

taxonomyRouter.get("/search", async (req, res, next) => {
	try {
		const { query } = req.query;
		if (!query || typeof query !== "string") {
			throw new AppError("Query is required");
		}
		const searchResults = await taxonomyService.searchTaxons({ q: query });
		return res.send(searchResults);
	} catch (e) {
		return next(e);
	}
});

taxonomyRouter.get(
	"/species/search",
	validateRequest<typeof speciesSearchSchema>({ query: speciesSearchSchema }),
	async (req, res, next) => {
		try {
			const {
				q,
				page,
				familyId,
				genusId,
				speciesId,
				onlyAccepted,
				excludeRank,
			} = req.query;
			const results = await taxonomyService.search({
				q,
				page,
				familyId,
				genusId,
				speciesId,
				onlyAccepted,
				excludeRank,
			});

			return res.send(results);
		} catch (e) {
			return next(e);
		}
	},
);

taxonomyRouter.get(
	"/species/hydrated-search",
	allowJwtButNotRequire,
	validateRequest<typeof speciesSearchSchema>({ query: speciesSearchSchema }),
	async (req, res, next) => {
		try {
			const { q, page, familyId, genusId, speciesId, onlyAccepted } = req.query;
			const results = await taxonomyService.hydratedSearch(
				{ q, page, familyId, genusId, speciesId, onlyAccepted },
				req.jwtPayload?.userId,
			);
			return res.send(results);
		} catch (e) {
			return next(e);
		}
	},
);

taxonomyRouter.get("/families", async (req, res, next) => {
	try {
		const families = await dbManager.db.query.families.findMany();
		return res.send(
			families.map((fam) => ({
				id: fam.id,
				name: fam.name,
				type: "family",
				scientificPortions: [],
			})),
		);
	} catch (e) {
		return next(e);
	}
});

taxonomyRouter.get("/family/:familyId", async (req, res, next) => {
	try {
		const family = await taxonomyService.familyModel.getById(
			Number(req.params.familyId),
		);

		if (!family) {
			throw new AppError("Family not found");
		}
		return res.send({
			name: family.name,
			id: family.id,
			type: "family",
		});
	} catch (e) {
		return next(e);
	}
});

taxonomyRouter.get("/genus/:genusId", async (req, res, next) => {
	try {
		const genus = await taxonomyService.genusModel.getById(
			Number(req.params.genusId),
		);
		if (!genus) {
			throw new AppError("Genus not found");
		}
		return res.send({ name: genus.name, id: genus.id, type: "genus" });
	} catch (e) {
		return next(e);
	}
});

taxonomyRouter.get("/species/:speciesId", async (req, res, next) => {
	try {
		const spec = await taxonomyService.speciesModel.getById(
			Number(req.params.speciesId),
		);
		if (!spec) {
			throw new AppError("Species not found");
		}
		const { scientificPortions } =
			await taxonomyService.getScientificallySplitName(spec.id);
		return res.send({
			name: spec.name,
			id: spec.id,
			type: "species",
			scientificPortions,
		});
	} catch (e) {
		return next(e);
	}
});

taxonomyRouter.get(
	"/genera/search",
	allowJwtButNotRequire,
	validateRequest<typeof genusSearchSchema>({ query: genusSearchSchema }),
	async (req, res, next) => {
		try {
			const { q, page, familyId, onlyAccepted } = req.query;
			const results = await taxonomyService.hydratedGenusSearch(
				{ q, page, familyId, onlyAccepted },
				req.jwtPayload?.userId,
			);

			return res.send(results);
		} catch (e) {
			return next(e);
		}
	},
);

taxonomyRouter.get(
	"/classification",
	allowJwtButNotRequire,
	validateRequest<typeof getClassificationSchema>({
		query: getClassificationSchema,
	}),
	async (req, res, next) => {
		try {
			const results = await taxonomyService.getClassification(
				Number.parseInt(req.query.taxonId),
				req.query.taxonType,
			);

			return res.send(results);
		} catch (e) {
			return next(e);
		}
	},
);
taxonomyRouter.get(
	"/lower-taxa",
	allowJwtButNotRequire,
	validateRequest<typeof getLowerTaxaSchema>({ query: getLowerTaxaSchema }),
	async (req, res, next) => {
		try {
			const lowerTaxa = await taxonomyService.getLowerTaxa(
				Number.parseInt(req.query.taxonId),
				req.query.taxonType,
			);
			return res.send(lowerTaxa);
		} catch (e) {
			return next(e);
		}
	},
);

taxonomyRouter.use("/", requireJwt, async (req, _res, next) => {
	const userId = req.jwtPayload?.userId;
	if (!userId) {
		return next(401); // jwt malformed
	}

	const user = await userService.getById(userId);
	req.user = user;

	next();
});
taxonomyRouter.post(
	"/name-preview",
	validateRequest<typeof getNamePreviewSchema>({ body: getNamePreviewSchema }),
	async (req, res, next) => {
		try {
			const nameData = await taxonomyService.getNamePreview(req.body);
			return res.send(nameData);
		} catch (e) {
			return next(e);
		}
	},
);
/**
 * /:plantId/trades/possible
 * Gets possible trades for a specific plant (not species!) and user
 */
taxonomyRouter.get(
	"/species/:speciesId/trades/possible",
	async (req, res, next) => {
		try {
			const user = requireUser(req);
			const { receive } = req.query;

			if (receive) {
				const possibleTrades =
					await taxonomyService.getPossibleTradesForUserToGetSpecies(
						Number(req.params.speciesId),
						user,
					);
				return res.status(200).send(possibleTrades);
			}
			const possibleTrades = await taxonomyService.getPossibleTradesForUser(
				Number(req.params.speciesId),
				user,
			);
			return res.status(200).send(possibleTrades);
		} catch (e) {
			return next(e);
		}
	},
);

taxonomyRouter.post("/species/:speciesId/interests", async (req, res, next) => {
	try {
		const user = requireUser(req);
		await taxonomyService.setNewInterest(
			"species",
			Number(req.params.speciesId),
			user,
		);
		return res.status(201).send();
	} catch (e) {
		return next(e);
	}
});
taxonomyRouter.delete(
	"/species/:speciesId/interests",
	async (req, res, next) => {
		try {
			const user = requireUser(req);
			await taxonomyService.removeInterest(
				"species",
				Number(req.params.speciesId),
				user,
			);
			return res.status(201).send();
		} catch (e) {
			return next(e);
		}
	},
);

taxonomyRouter.post("/genus/:genusId/interests", async (req, res, next) => {
	try {
		const user = requireUser(req);
		await taxonomyService.setNewInterest(
			"genus",
			Number(req.params.genusId),
			user,
		);
		return res.status(201).send();
	} catch (e) {
		return next(e);
	}
});
taxonomyRouter.delete("/genus/:genusId/interests", async (req, res, next) => {
	try {
		const user = requireUser(req);
		await taxonomyService.removeInterest(
			"genus",
			Number(req.params.genusId),
			user,
		);
		return res.status(201).send();
	} catch (e) {
		return next(e);
	}
});

taxonomyRouter.post("/family/:familyId/interests", async (req, res, next) => {
	try {
		const user = requireUser(req);
		await taxonomyService.setNewInterest(
			"family",
			Number(req.params.familyId),
			user,
		);
		return res.status(201).send();
	} catch (e) {
		return next(e);
	}
});
taxonomyRouter.delete("/family/:familyId/interests", async (req, res, next) => {
	try {
		const user = requireUser(req);
		await taxonomyService.removeInterest(
			"family",
			Number(req.params.familyId),
			user,
		);
		return res.status(201).send();
	} catch (e) {
		return next(e);
	}
});

taxonomyRouter.post(
	"/species/submissions",
	validateRequest({ body: postSpeciesSubmissionSchema }),
	async (req, res, next) => {
		try {
			const user = requireUser(req);
			const speciesSubmission = await taxonomyService.createSpeciesSubmission(
				req.body,
				user,
			);
			return res.send(speciesSubmission);
		} catch (e) {
			return next(e);
		}
	},
);

export default taxonomyRouter;
