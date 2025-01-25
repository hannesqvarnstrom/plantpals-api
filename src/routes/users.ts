import { type Response, Router } from "express";
import type { z } from "zod";
import { validateRequest } from "zod-express-middleware";
import { JWTExpiresIn, requireJwt, requireUser, signJwt } from "../middleware/jwt";
import plantService from "../services/plant";
import userService from "../services/user";
import { AppError } from "../utils/errors";
import { updateMeSchema, updateProfileSchema } from "./schemas";

const usersRouter = Router();

usersRouter.use(requireJwt, async (req, res, next) => {
	const userId = req.jwtPayload?.userId;
	if (!userId) {
		return next(401); // jwt malformed
	}

	const user = await userService.getById(userId);
	req.user = user;

	next();
})

usersRouter.get("/me", async (req, res, next) => {
	try {
		const userId = req.jwtPayload?.userId as number;
		const user = await userService.getById(userId);
		const profile = await userService.getProfileByUserId(user.id)
		console.log('profile:', profile)
		const plantCollection = await plantService.getUserCollection(userId);
		return res.send({ userInfo: { ...user, ...profile, id: user.id }, plantCollection });
	} catch (e) {
		return next(e);
	}
});

usersRouter.put(
	"/me",
	validateRequest({ body: updateMeSchema }),
	async (req, res, next) => {
		const userId = req.jwtPayload?.userId as number;
		try {
			const updatedMe = await userService.updateById(userId, req.body);
			return res.status(201).send({ updatedMe });
		} catch (e) {
			return next(e);
		}
	},
);

usersRouter.put(
	'/profile',
	validateRequest({ body: updateProfileSchema }),
	async (req, res, next) => {
		try {
			const user = requireUser(req)
			const args = req.body
			const updatedProfile = await userService.updateProfile(args, user)
			return res.send(updatedProfile)
		} catch (e) {
			return next(e)
		}
	}
)

usersRouter.get("/:userId/interests", async (req, res, next) => {
	try {
		const { userId } = req.params;

		const interests = await userService.getInterests(Number(userId));
		return res.send(interests);
	} catch (e) {
		return next(e);
	}
});

usersRouter.get(
	"/:userId/tradeable-plants",
	async (req, res, next) => {
		try {
			const { userId } = req.params;
			const requestingUserId = req.jwtPayload?.userId;
			if (!requestingUserId) {
				throw new AppError("missing user");
			}
			const tPlants = await userService.getTradeablePlants(
				Number(userId),
				requestingUserId,
			);
			return res.send(tPlants);
		} catch (e) {
			return next(e);
		}
	},
);
usersRouter.get('/:userId/profile', async (req, res, next) => {
	try {
		const profileData = await userService.getProfileByUserId(Number(req.params.userId))
		const user = await userService.getById(Number(req.params.userId))

		if (!profileData) {
			return res.send({ username: user.username, bio: '', tradesByPost: false, tradeInPerson: false, city: '', country: '' })
		}

		return res.send({ ...profileData, username: user.username })
	} catch (e) {
		return next(e)
	}
})
usersRouter.get("/collection", async (req, res, next) => {
	try {
		if (!req.jwtPayload?.userId) {
			throw new AppError("Missing user");
		}
		const user = await userService.getById(req.jwtPayload.userId);
		const collection = await plantService.getUserCollection(user);
		return res.send(collection);
	} catch (e) {
		return next(e);
	}
});

usersRouter.get('/favourites', async (req, res, next) => {
	try {
		const user = requireUser(req)
		const favourites = await userService.getFavourites(user)
		console.log('favourites:', favourites)
		return res.send(favourites)
	} catch (e) {
		return next(e)
	}
})


usersRouter.get('/search', async (req, res, next) => {
	try {
		const { query } = req.query
		if (!query || typeof query !== 'string') {
			throw new AppError('Query is required')
		}

		const user = requireUser(req)

		const results = await userService.search({ query }, user)
		return res.send(results)
	} catch (e) {
		return next(e)
	}
})

usersRouter.post('/:userId/favourite', async (req, res, next) => {
	try {
		const user = requireUser(req)
		console.log('user:', user)
		const result = await userService.addFavourite(user, Number(req.params.userId))
		return res.status(201).send(result)
	} catch (e) {
		return next(e)
	}
})

usersRouter.delete('/:userId/favourite', async (req, res, next) => {
	try {
		const user = requireUser(req)
		const result = await userService.removeFavourite(user, Number(req.params.userId))
		return res.status(201).send()
	} catch (e) {
		return next(e)
	}
})

export default usersRouter;
