import { type InferInsertModel, type InferSelectModel, eq } from 'drizzle-orm'
import dbManager from "../db/index"
import { speciesInterests } from "../db/schema"
import { AppError } from "../utils/errors"

export type RawSpeciesInterest = InferSelectModel<typeof speciesInterests>
export type TSpeciesInterestCreateArgs = InferInsertModel<typeof speciesInterests>
export type TSpeciesInterest = RawSpeciesInterest

export default class SpeciesInterestModel {
    public static factory(params: RawSpeciesInterest): TSpeciesInterest {
        const { id, speciesId, userId } = params
        return { id, speciesId, userId }
    }

    public async create(args: TSpeciesInterestCreateArgs): Promise<TSpeciesInterest> {
        const query = dbManager.db.insert(speciesInterests)
            .values(args)
            .returning()
            .prepare(
                `createSpeciesInterest${new Date().getTime()}`
            )

        const [result, ..._] = await query.execute()
        if (!result) {
            throw new AppError('Something went wrong while creating species interest', 400)
        }

        return result
    }

    public async getById<B extends boolean = true>(id: number, require: B): Promise<TSpeciesInterest>
    public async getById(id: number): Promise<TSpeciesInterest | undefined>
    public async getById<B extends boolean = false>(id: number, require?: B) {
        const query = dbManager.db.select()
            .from(speciesInterests)
            .where(eq(speciesInterests.id, id))
            .prepare(`getBySpeciesInterestId${new Date().getTime()}`)

        const [result, ..._] = await query.execute()

        if (result) {
            const plant = SpeciesInterestModel.factory(result)
            return plant
        }
        if (require) throw new AppError('Species interest not found', 404)
        return undefined
    }

    public async getByUserId(userId: number): Promise<TSpeciesInterest[]> {
        const query = dbManager.db.select()
            .from(speciesInterests)
            .where(eq(speciesInterests.userId, userId))
            .prepare(`getByUserId${new Date().getTime()}`)

        const result = await query.execute()
        return result
    }
}