import dbManager from "../db"
import { users } from "../db/schema"
import { eq, InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { AppError } from "../utils/errors"

export type RawUser = InferSelectModel<typeof users>
export type TUserCreateArgs = InferInsertModel<typeof users>
export type TUser = Omit<RawUser, 'password'>

export default class UserModel {
    constructor() {
    }

    public static factory(params: RawUser): TUser {
        const { email, id, lastLogAt } = params
        return { email, id, lastLogAt }
    }

    /**
     * @param id id of entity requested in DB
     * @param require if true is passed, will throw 404 if entity couldn't be found
     * 
     * @TODO make this a function for a base Model-like class. Could be reused
     */
    public async getById<B extends boolean = true>(id: number, require: B): Promise<TUser>
    public async getById(id: number): Promise<TUser | undefined>
    public async getById<B extends boolean = false>(id: number, require?: B) {
        const q = dbManager.db.select().from(users).where(eq(users.id, id)).prepare('getUserById')
        const [result, ..._] = await q.execute()

        if (result) {
            const user = UserModel.factory(result)
            return user
        } else {
            if (require) throw new AppError('', 404)
            return undefined
        }
    }

    public async getRawById(id: number): Promise<RawUser> {
        const q = dbManager.db.select().from(users).where(eq(users.id, id)).prepare('getRawById')
        const [result, ..._] = await q.execute()

        if (result) {
            return result
        } else {
            throw new AppError('', 404)
        }
    }

    public async updateById(id: number, payload: { password?: string, lastLogAt?: Date } = {}) {
        const q = dbManager.db.update(users)
            .set(payload)
            .where(
                eq(users.id, id)
            )
            .returning()
            .prepare('updateById' + new Date().getTime())

        const [updatedUser, ..._] = await q.execute()
        if (updatedUser) {
            return UserModel.factory(updatedUser)
        } else {
            throw new Error('User failed to be added for some reason')
        }
    }

    public async getByEmail(email: string): Promise<RawUser | undefined> {
        const q = dbManager.db.select()
            .from(users)
            .where(
                eq(users.email, email)
            )
            .prepare('getByEmail' + new Date().getTime())

        const [user, ..._] = await q.execute()

        return user
    }

    public async create({ email, password }: TUserCreateArgs): Promise<TUser> {
        /**
         * @todo
         * - add unique constraint to email
         */
        const existingUserQ = dbManager.db.select()
            .from(users)
            .where(
                eq(users.email, email)
            )
            .prepare('existingUserQ' + new Date().getTime())

        const [alreadyExists, ..._1] = await existingUserQ.execute()
        if (alreadyExists) {
            throw new AppError('An Account with this email already exists', 400)
        }

        const [newUser, ..._2] = await dbManager.db.insert(users).values({ email, password }).returning()

        if (newUser) {
            return UserModel.factory(newUser)
        } else {
            throw new Error('User failed to be added for some reason')
        }
    }

    public async list({ limit }: ListArguments): Promise<TUser[]> {
        const q = dbManager.db.select().from(users).limit(limit).prepare('listUsers')
        const list = (await q.execute()).map(UserModel.factory)
        return list
    }
}

interface ListArguments {
    limit: number
}
