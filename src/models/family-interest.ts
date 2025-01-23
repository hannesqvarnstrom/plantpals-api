import { InferColumnsDataTypes, type InferInsertModel, type InferSelectModel, and, between, eq, sql } from 'drizzle-orm'
import dbManager from "../db/index"
import { familyInterests } from "../db/schema"

import { AppError } from "../utils/errors"

export type RawFamilyInterest = InferSelectModel<typeof familyInterests>
export type TFamilyInterestCreateArgs = InferInsertModel<typeof familyInterests>
export type TFamilyInterest = RawFamilyInterest


export default class FamilyInterestModel {
    public static factory(params: RawFamilyInterest): TFamilyInterest {
        const { id, familyId, userId } = params
        return { id, familyId, userId }
    }

    public async create(args: TFamilyInterestCreateArgs): Promise<TFamilyInterest> {
        const query = dbManager.db.insert(familyInterests)
            .values(args)
            .returning()
            .prepare(
                `createFamilyInterest${new Date().getTime()}`
            )

        const [result, ..._] = await query.execute()
        if (!result) {
            throw new AppError('Something went wrong while creating family interest', 400)
        }

        return result
    }

    public async getById<B extends boolean = true>(id: number, require: B): Promise<TFamilyInterest>
    public async getById(id: number): Promise<TFamilyInterest | undefined>
    public async getById<B extends boolean = false>(id: number, require?: B) {
        const query = dbManager.db.select()
            .from(familyInterests)
            .where(eq(familyInterests.id, id))
            .prepare(`getByFamilyInterestId${new Date().getTime()}`)

        const [result, ..._] = await query.execute()

        if (result) {
            const plant = FamilyInterestModel.factory(result)
            return plant
        }
        if (require) throw new AppError('family interest not found', 404)
        return undefined
    }

    public async getByUserId(userId: number): Promise<TFamilyInterest[]> {
        const query = dbManager.db.select()
            .from(familyInterests)
            .where(eq(familyInterests.userId, userId))
            .prepare(`getByUserId${new Date().getTime()}`)

        const result = await query.execute()
        return result
    }
}