import { Response, Router } from 'express'
import { JWTExpiresIn, requireJwt, signJwt } from "../middleware/jwt"
import { updateMeSchema } from "./schemas"
import userService from "../services/user"
import { TUser } from '../models/user'
import { validateRequest } from 'zod-express-middleware'
import plantService from '../services/plant'

const usersRouter = Router()

usersRouter.get('/me', requireJwt, async (req, res, next) => {
    try {
        const userId = req.jwtPayload?.userId as number
        const userInfo = await userService.getById(userId)
        const plantCollection = await plantService.getUserCollection(userId)
        // const interests = await userService.getInterests(userId)
        // const mappedInterests = {
        //     species: interests.userSpeciesInterests,
        //     genera: interests.userGenusInterests,
        //     families: interests.userFamilyInterests
        // }

        return res.send({ userInfo, plantCollection })


    } catch (e) { return next(e) }
})

usersRouter.put('/me', requireJwt, validateRequest({ body: updateMeSchema }), async (req, res, next) => {
    const userId = req.jwtPayload?.userId as number
    try {
        const updatedMe = await userService.updateById(userId, req.body)
        return res.status(201).send({ updatedMe })
    }
    catch (e) {
        return next(e)
    }
})

usersRouter.get('/:userId/interests', requireJwt, async (req, res, next) => {
    try {

        const { userId } = req.params

        const interests = await userService.getInterests(Number(userId))
        return res.send(interests)
    } catch (e) {
        return next(e)
    }
})

usersRouter.get('/collection', requireJwt, async (req, res, next) => {
    try {
        const user = await userService.getById(req.jwtPayload!.userId)
        const collection = await plantService.getUserCollection(user)
        return res.send(collection)
    } catch (e) {
        return next(e)
    }
})


export default usersRouter