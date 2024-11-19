import dbManager from "../db"
import { families } from "../db/schema"
import { and, between, eq, InferColumnsDataTypes, InferInsertModel, InferSelectModel, sql, inArray } from 'drizzle-orm'
import { AppError } from "../utils/errors"
import { PlantTypeCol } from "../services/plant"

export type RawFamily = InferSelectModel<typeof families>
export type TFamilyCreateArgs = InferInsertModel<typeof families>
export type TFamily = RawFamily


export default class FamilyModel {
    constructor() {

    }

    public static factory(params: RawFamily): TFamily {
        const { id, name, gbifKey, vernacularNames, createdAt } = params
        return { id, name, gbifKey, vernacularNames, createdAt }
    }

    public async create(args: TFamilyCreateArgs): Promise<TFamily> {
        const query = dbManager.db.insert(families)
            .values(args)
            .returning()
            .prepare(
                'createFamily' + new Date().getTime()
            )

        const [result, ..._] = await query.execute()
        if (!result) {
            throw new AppError('Something went wrong while creating family', 400)
        }

        return result
    }

    public async getById<B extends boolean = true>(id: number, require: B): Promise<TFamily>
    public async getById(id: number): Promise<TFamily | undefined>
    public async getById<B extends boolean = false>(id: number, require?: B) {
        const query = dbManager.db.select()
            .from(families)
            .where(eq(families.id, id))
            .prepare('getByFamilyId' + new Date().getTime())

        const [result, ..._] = await query.execute()

        if (result) {
            const plant = FamilyModel.factory(result)
            return plant
        } else {
            if (require) throw new AppError('family not found', 404)
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