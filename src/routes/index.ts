import { Router } from "express"

import usersRouter from "./users"
import envVars from "../utils/environment"
import authRouter from "./auth"
import taxonomyRouter from "./taxonomy"
import plantsRouter from "./plants"
import tradingRouter from "./trading"
import interestsRouter from "./interests"

const router = Router()

router.use((_req, res, next) => {
    res.set('content-type', 'application/json')
    if (envVars.isDev()) {
        console.log('Getting request at url', _req.url)
    }

    next()
})

router.get('/', (_req, res) => {
    res.send({ message: 'Welcome to MoodLogger!' })
})

/**
 * Users 
 * - GET /me
 * - PUT /me
 * - GET /:userId/interests
 * - GET /:userId/collection
 */
router.use('/users', usersRouter)

/**
 * Plants
 * - GET /
 * - POST /
 * - POST /:plantId/tradeable
 * - DELETE /:plantId/tradeable
 */
router.use('/plants', plantsRouter)

/**
 * - POST /register, 
 * - POST /login, 
 * - GET /google
 * - GET /google/redirect
 */
router.use('/auth', authRouter)

/**
 * Taxonomy (@todo refactor)
 * - GET /species/search
 * - GET /species/hydrated-search
 * - GET /species/:speciesId/trades/possible
 * - POST /species/:speciesId/interests
 * - DELETE /species/:speciesId/interests
 */
router.use('/taxonomy', taxonomyRouter)

/**
 * Trading
 * - POST /
 */
router.use('/trading', tradingRouter)

/**
 * Interests
 * - GET /
 */
router.use('/interests', interestsRouter)

export default router

