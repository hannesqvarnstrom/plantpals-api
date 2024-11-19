import dbManager, { DB } from "../db";
import IdentityModel from "../models/identity";
import UserModel from "../models/user";
import envVars from "../utils/environment";
import { AppError } from "../utils/errors";

class OAuthService {
    db: DB
    userModel: UserModel
    identityModel: IdentityModel

    constructor() {
        this.db = dbManager.db
        this.userModel = new UserModel()
        this.identityModel = new IdentityModel()
    }

    public async verifyGoogleToken(token: string) {
        const { OAuth2Client } = await import('google-auth-library')
        const clientId = envVars.get('GOOGLE_CLIENT_ID')
        const client = new OAuth2Client(clientId);

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: clientId,
        });

        const payload = ticket.getPayload();
        if (!payload) {
            throw new AppError('Google token verification failed', 400)
        }
        const { email, sub: id } = payload
        return { email, id };
    }

}

const oauthService = new OAuthService()
export default oauthService
