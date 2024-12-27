import { Router } from 'express'
import { requireJwt } from '../middleware/jwt'
import userService from '../services/user'
import plantService from '../services/plant'
import { postPlantSchema, putPlantSchema } from './schemas'
import { validateRequest } from 'zod-express-middleware'

const plantsRouter = Router()

plantsRouter.use('/', requireJwt, async (req, _res, next) => {
    const userId = req.jwtPayload?.userId
    if (!userId) {
        return next(401) // jwt malformed
    }

    const user = await userService.getById(userId)
    req.user = user

    next()
})

plantsRouter.get('/', async (req, res, next) => {
    try {

        const plants = await plantService.getByUser(req.user!)
        return res.send(plants)
    } catch (e) {
        return next(e)
    }
})

plantsRouter.post('/',
    validateRequest({ body: postPlantSchema }),
    async (req, res, next) => {
        try {
            const { type, speciesId } = req.body
            const newPlant = await plantService.createPlant({
                userId: req.user!.id, speciesId, type
            })

            return res.status(201).send(newPlant)

        } catch (e) {
            return next(e)
        }
    })


plantsRouter.post('/:plantId/tradeable', async (req, res, next) => {
    try {

        await plantService.makePlantTradeable(Number(req.params.plantId), req.user!)
        return res.status(201).send()
    } catch (e) {
        return next(e)
    }
})

plantsRouter.delete('/:plantId/tradeable', async (req, res, next) => {
    try {

        await plantService.makePlantUntradeable(Number(req.params.plantId), req.user!)
        return res.status(200).send()
    } catch (e) {
        return next(e)
    }
})

export default plantsRouter
