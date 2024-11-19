import { InferInsertModel, InferSelectModel, and, eq } from "drizzle-orm"
import { federatedIdentities } from "../db/schema"
import { OAuthProvider } from "../services/authentication"
import dbManager from "../db"
import { AppError } from "../utils/errors"

export type RawIdentity = InferSelectModel<typeof federatedIdentities>
export type TIdentity = RawIdentity
export type TCreateIdentityPayload = InferInsertModel<typeof federatedIdentities>

export default class IdentityModel {
    public static factory(params: RawIdentity): TIdentity {
        const { provider, providerId, createdAt, userId } = params

        return { provider, providerId, createdAt, userId }
    }

    /**
     * Attempts to find by provided providerId combined with a provider ('GOOGLE' or 'FACEBOOK')
     */
    public async findByProviderId(providerId: string, provider: OAuthProvider): Promise<TIdentity | undefined> {
        const q = dbManager.db.select()
            .from(federatedIdentities)
            .where(
                and(
                    eq(federatedIdentities.providerId, providerId),
                    eq(federatedIdentities.provider, provider)
                )
            )
            .prepare('findIdentityByProvider' + new Date().getTime())

        const [result, ..._] = await q.execute()

        return result ? IdentityModel.factory(result) : undefined
    }

    public async create(payload: TCreateIdentityPayload): Promise<TIdentity> {
        const q = dbManager.db.insert(federatedIdentities)
            .values(payload)
            .returning()
            .prepare('insertIdentity' + new Date().getTime())

        const [result, ..._] = await q.execute()

        if (!result) {
            throw new AppError('Something went wrong while saving identity', 400)
        }

        return IdentityModel.factory(result)
    }
}
