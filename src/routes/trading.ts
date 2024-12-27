import { Router } from 'express'
import { requireJwt } from '../middleware/jwt'
import userService from '../services/user'
import plantService from '../services/plant'
import { postPlantSchema, postTradeSchema, putPlantSchema } from './schemas'
import { validateRequest } from 'zod-express-middleware'
import { validateOwnership } from '../middleware/ownership'
import { ShallowPlant } from '../models/plant'
import { AppError } from '../utils/errors'
import tradingService from '../services/trading'

const tradingRouter = Router()

tradingRouter.use('/', requireJwt, async (req, _res, next) => {
    const userId = req.jwtPayload?.userId
    if (!userId) {
        return next(401) // jwt malformed
    }

    const user = await userService.getById(userId)
    req.user = user

    next()
})

tradingRouter.post('/', validateRequest({ body: postTradeSchema }), async (req, res, next) => {
    try {

        const { plantDesiredId, plantOfferedId } = req.body

        const result = await tradingService.createTrade({ plantDesiredId, plantOfferedId, requestingUserId: req.user!.id })
        const x = await tradingService.checkStatus(result.id)
        return res.send(result)
    } catch (e) {
        return next(e)
    }
})

tradingRouter.get('/', async (req, res, next) => {
    try {
        const trades = await tradingService.getTrades(req.user!.id)
        return res.send(trades)
    } catch (e) {
        return next(e)
    }
})

export default tradingRouter
