import dbManager from "../db"
import { genera } from "../db/schema"
import { and, between, eq, InferColumnsDataTypes, InferInsertModel, InferSelectModel, sql, inArray } from 'drizzle-orm'
import { AppError } from "../utils/errors"
import { PlantTypeCol } from "../services/plant"

export type RawGenus = InferSelectModel<typeof genera>
export type TGenusCreateArgs = InferInsertModel<typeof genera>
export type TGenus = RawGenus


export default class GenusModel {
    constructor() {

    }

    public static factory(params: RawGenus): TGenus {
        const { id, name, gbifKey, vernacularNames, familyId, gbifFamilyKey, createdAt } = params
        return { id, name, gbifKey, vernacularNames, familyId, gbifFamilyKey, createdAt }
    }

    public async create(args: TGenusCreateArgs): Promise<TGenus> {
        const query = dbManager.db.insert(genera)
            .values(args)
            .returning()
            .prepare(
                'createGenus' + new Date().getTime()
            )

        const [result, ..._] = await query.execute()
        if (!result) {
            throw new AppError('Something went wrong while creating genus', 400)
        }

        return result
    }

    public async getById<B extends boolean = true>(id: number, require: B): Promise<TGenus>
    public async getById(id: number): Promise<TGenus | undefined>
    public async getById<B extends boolean = false>(id: number, require?: B) {
        const query = dbManager.db.select()
            .from(genera)
            .where(eq(genera.id, id))
            .prepare('getByGenusId' + new Date().getTime())

        const [result, ..._] = await query.execute()

        if (result) {
            const plant = GenusModel.factory(result)
            return plant
        } else {
            if (require) throw new AppError('genus not found', 404)
            return undefined
        }
    }

    //     public async update(id: number, { name, fontSize, fromTrader, location, type }: Partial<InferInsertModel<typeof plants>>): Promise<TPlant> {
    //         const updateObject: Partial<InferInsertModel<typeof plants>> = {}
    //         if (name) updateObject.name = name
    //         if (fontSize) updateObject.fontSize = fontSize
    //         if (fromTrader || fromTrader === null) updateObject.fromTrader = fromTrader
    //         if (location || location === '' || location === null) updateObject.location = location
    //         if (type) updateObject.type = type

    //         const query = dbManager.db.update(plants)
    //             .set(updateObject)
    //             .where(eq(plants.id, id))
    //             .returning()
    //             .prepare('updatePlant' + new Date().getTime())

    //         const [result, ..._] = await query.execute()

    //         if (!result) {
    //             throw new AppError('Plant not found', 404)
    //         }
    //         return result
    //     }
    // }
}