import { Response, Router } from 'express'
import authService, { OAuthProvider } from "../services/authentication"
import { JWTExpiresIn, requireJwt, signJwt } from "../middleware/jwt"
import { loginSchema, oauthGooglePostSchema, registerSchema, updateMeSchema } from "./schemas"
import userService from "../services/user"
import { TUser } from '../models/user'
import { AppError } from '../utils/errors'
import oauthService from '../services/oauth'
import { validateRequest } from 'zod-express-middleware'

const usersRouter = Router()

usersRouter.post('/register', validateRequest({ body: registerSchema }), async (req, res, next) => {
    try {
        const user = await userService.createUser(req.body)
        return res.status(201).send(user)
    } catch (e) {
        return next(e)
    }
})

const signAndSendUserToken = (user: TUser, res: Response) => {
    const token = signJwt(user.id)
    return res.status(200).send({
        token,
        userId: user.id,
        expiresAt: new Date().setTime(new Date().getTime() + (JWTExpiresIn * 1000)),
        expiresIn: JWTExpiresIn,
        logOverdue: userService.logOverdue(user, new Date())
    })
}

usersRouter.post('/login', validateRequest({ body: loginSchema }), async (req, res, next) => {
    try {
        const user = await authService.attemptPasswordLogin(req.body)
        return signAndSendUserToken(user, res)
    } catch (e) {
        return next(e)
    }
})

usersRouter.get('/me', requireJwt, async (req, res, next) => {
    try {
        const userId = req.jwtPayload?.userId as number
        const me = await userService.getById(userId)

        return res.send({ me })
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


/**
 * OAUTH ENDPOINTS
 */

/**
 * Client initiated
 */
/**
 * Google
 */
usersRouter.post('/auth/google', validateRequest({ body: oauthGooglePostSchema }), async (req, res, next) => {
    const {
        providerToken,
    } = req.body

    try {
        const { email, id } = await oauthService.verifyGoogleToken(providerToken)

        const userIdentity = await authService.findUserIdentity(id, 'GOOGLE')
        if (userIdentity) {
            const user = await userService.getById(userIdentity.userId)
            return signAndSendUserToken(user, res)
        } else {
            if (email) {
                let user = await userService.getByEmail(email)

                if (!user) {
                    user = await userService.createUser({ email })
                } else {
                    // @todo - if user already exists in the app, 
                    // force them to input their existing password to link the accounts
                    return res.status(200).send({
                        action: 'prompt_normal_login',
                    })
                }

                const identityPayload = {
                    provider: 'GOOGLE' as OAuthProvider,
                    providerId: id,
                    userId: user.id
                }

                await authService.createUserIdentity(identityPayload)
                return signAndSendUserToken(user, res)
            } else {
                throw new AppError('Missing an Email-address for Oauth Login', 400)
            }
        }
    } catch (e) {
        return next(e)
    }
})

export default usersRouter