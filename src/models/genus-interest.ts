import { type InferInsertModel, type InferSelectModel, eq } from 'drizzle-orm'
import dbManager from "../db/index"
import { genusInterests } from "../db/schema"
import { AppError } from "../utils/errors"

export type RawGenusInterest = InferSelectModel<typeof genusInterests>
export type TGenusInterestCreateArgs = InferInsertModel<typeof genusInterests>
export type TGenusInterest = RawGenusInterest

export default class GenusInterestModel {

    public static factory(params: RawGenusInterest): TGenusInterest {
        const { id, genusId, userId } = params
        return { id, genusId, userId }
    }

    public async create(args: TGenusInterestCreateArgs): Promise<TGenusInterest> {
        const query = dbManager.db.insert(genusInterests)
            .values(args)
            .returning()
            .prepare(
                `createGenusInterest${new Date().getTime()}`
            )

        const [result, ..._] = await query.execute()
        if (!result) {
            throw new AppError('Something went wrong while creating genus interest', 400)
        }

        return result
    }

    public async getById<B extends boolean = true>(id: number, require: B): Promise<TGenusInterest>
    public async getById(id: number): Promise<TGenusInterest | undefined>
    public async getById<B extends boolean = false>(id: number, require?: B) {
        const query = dbManager.db.select()
            .from(genusInterests)
            .where(eq(genusInterests.id, id))
            .prepare(`getByGenusInterestId${new Date().getTime()}`)

        const [result, ..._] = await query.execute()

        if (result) {
            const plant = GenusInterestModel.factory(result)
            return plant
        }
        if (require) throw new AppError('Genus interest not found', 404)
        return undefined
    }

    public async getByUserId(userId: number): Promise<TGenusInterest[]> {
        const query = dbManager.db.select()
            .from(genusInterests)
            .where(eq(genusInterests.userId, userId))
            .prepare(`getByUserId${new Date().getTime()}`)

        const result = await query.execute()
        return result
    }
}