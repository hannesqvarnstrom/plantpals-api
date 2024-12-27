import { Router } from "express";
import { validateRequest } from "zod-express-middleware";
import {
    genusSearchSchema,
    getNamePreviewSchema,
    postSpeciesSubmissionSchema,
    speciesSearchSchema,
} from "./schemas";
import taxonomyService from "../services/taxonomy";
import { allowJwtButNotRequire, requireJwt } from "../middleware/jwt";
import userService from "../services/user";

const taxonomyRouter = Router();

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
            console.log("results:", results);
            return res.send(results);
        } catch (e) {
            return next(e);
        }
    }
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
                req.jwtPayload?.userId
            );
            return res.send(results);

            // }, 1000)
        } catch (e) {
            return next(e);
        }
    }
);

taxonomyRouter.get(
    "/genera/search",
    allowJwtButNotRequire,
    validateRequest<typeof genusSearchSchema>({ query: genusSearchSchema }),
    async (req, res, next) => {
        try {
            const { q, page, familyId, onlyAccepted } = req.query;
            const results = await taxonomyService.hydratedGenusSearch(
                { q, page, familyId, onlyAccepted },
                req.jwtPayload?.userId
            );
            // console.log('results:', results)
            setTimeout(() => {
                return res.send(results);
            }, 1000);
        } catch (e) {
            return next(e);
        }
    }
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
    }
);
/**
 * /:plantId/trades/possible
 * Gets possible trades for a specific plant (not species!) and user
 */
taxonomyRouter.get(
    "/species/:speciesId/trades/possible",
    async (req, res, next) => {
        try {
            const { receive } = req.query;

            if (receive) {
                const possibleTrades =
                    await taxonomyService.getPossibleTradesForUserToGetSpecies(
                        Number(req.params.speciesId),
                        req.user!
                    );
                return res.status(200).send(possibleTrades);
            } else {
                const possibleTrades = await taxonomyService.getPossibleTradesForUser(
                    Number(req.params.speciesId),
                    req.user!
                );
                return res.status(200).send(possibleTrades);
            }
        } catch (e) {
            return next(e);
        }
    }
);

taxonomyRouter.post("/species/:speciesId/interests", async (req, res, next) => {
    try {
        await taxonomyService.setNewInterest(
            Number(req.params.speciesId),
            req.user!
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
            await taxonomyService.removeInterest(
                Number(req.params.speciesId),
                req.user!
            );
            return res.status(201).send();
        } catch (e) {
            return next(e);
        }
    }
);

taxonomyRouter.post(
    "/species/submissions",
    validateRequest({ body: postSpeciesSubmissionSchema }),
    async (req, res, next) => {
        try {
            const {
                closestTaxonomicParent,
                closestTaxonomicParentType,
                submissionType,
                hybridMomId,
                hybridDadId,
                name,
            } = req.body;
            const speciesSubmission = await taxonomyService.createSpeciesSubmission(
                {
                    closestTaxonomicParent,
                    closestTaxonomicParentType,
                    submissionType,
                    hybridMomId,
                    hybridDadId,
                    name,
                },
                req.user!
            );
            return res.send(speciesSubmission);
        } catch (e) {
            return next(e);
        }
    }
);

export default taxonomyRouter;
