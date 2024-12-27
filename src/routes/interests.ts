import { Router } from "express";
import { requireJwt } from "../middleware/jwt";
import userService from "../services/user";

const interestsRouter = Router()
interestsRouter.use(requireJwt, async (req, res, next) => {
    const userId = req.jwtPayload?.userId
    if (!userId) {
        return next(401) // jwt malformed
    }

    const user = await userService.getById(userId)
    req.user = user

    next()
})

interestsRouter.get('/', async (req, res, next) => {
    const userInterests = await userService.getInterests(req.user!.id)
    return res.send(userInterests)
})


export default interestsRouter