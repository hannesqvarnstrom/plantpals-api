import jwt, { SignOptions } from 'jsonwebtoken'
import envVars from '../utils/environment'
import { NextFunction, Request, Response } from 'express'
import { AppError } from '../utils/errors'
export const JWTExpiresIn = 3600 * 24

export const signJwt = (userId: number, options: SignOptions = {
    expiresIn: JWTExpiresIn// 1 day
}) => {
    const base64Key = envVars.get('ACCESS_TOKEN_PRIVATE_KEY')
    const privateKey = Buffer.from(
        base64Key,
        'base64'
    ).toString('ascii')

    /**
     * @todo come up with better solution for generating keys for each environment. 
     */


    const payload = { userId, expiresIn: JWTExpiresIn }
    return jwt.sign(payload, privateKey, {
        ...(options && options),
        algorithm: 'RS256'
    })
}

export const verifyJwt = <T>(token: string): T | null => {
    try {
        const publicKey = Buffer.from(
            envVars.get('ACCESS_TOKEN_PUBLIC_KEY'),
            'base64'
        ).toString('ascii')
        return jwt.verify(token, publicKey) as T
    } catch (error) {
        console.log('error:', error)
        return null
    }
}

export const requireJwt = async <Params>(req: Request<Params>, _res: Response, next: NextFunction) => {
    try {
        const authString = req.headers.authorization ?? req.headers.Authorization as string
        if (!authString) throw new AppError('No authorization header supplied', 401)
        const token = authString.substring(authString.indexOf('Bearer ') + 6, authString.length).trim()
        if (!token) throw new AppError('No webtoken supplied', 401)

        const jwtPayload = verifyJwt<JwtPayload>(token)
        if (!jwtPayload) throw new AppError('Unable to verify token', 401)

        req.jwtPayload = jwtPayload
        return next()
    } catch (error) {
        console.log('error:', error)
        next(error)
    }

}

export type JwtPayload = {
    userId: number,
    expiresIn: string
}
