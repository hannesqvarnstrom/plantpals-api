import dbManager from "../db"
import { speciesInterests } from "../db/schema"
import { and, between, eq, InferColumnsDataTypes, InferInsertModel, InferSelectModel, sql } from 'drizzle-orm'
import { AppError } from "../utils/errors"
import { PlantTypeCol } from "../services/plant"

export type RawSpeciesInterest = InferSelectModel<typeof speciesInterests>
export type TSpeciesInterestCreateArgs = InferInsertModel<typeof speciesInterests>
export type TSpeciesInterest = RawSpeciesInterest


// export interface ShallowPlant {
//     name: string
//     {
//         genusName: string;
//         speciesName?: string;
//         varietyName?: string;
//         name1a?: {
//             species: boolean;
//             name: string;
//         };
//         name1b?: {
//             species: boolean;
//             name: string;
//         };

//         name2a?: {
//             species: boolean;
//             name: string;
//         };

//         name2b?: {
//             species: boolean;
//             name: string;
//         };
//     },
//     fromTrader?: number | null,
//     location?: string,
//     type?: PlantTypeCol,
//     image?: string,
//     fontSize: string
//     // ETC
// }

// export interface DeepPlant extends ShallowPlant {
//     id: string,
// }


export default class SpeciesInterestModel {
    constructor() {

    }

    public static factory(params: RawSpeciesInterest): TSpeciesInterest {
        const { id, speciesId, userId } = params
        return { id, speciesId, userId }
    }

    public async create(args: TSpeciesInterestCreateArgs): Promise<TSpeciesInterest> {
        const query = dbManager.db.insert(speciesInterests)
            .values(args)
            .returning()
            .prepare(
                'createSpeciesInterest' + new Date().getTime()
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
            .prepare('getBySpeciesInterestId' + new Date().getTime())

        const [result, ..._] = await query.execute()

        if (result) {
            const plant = SpeciesInterestModel.factory(result)
            return plant
        } else {
            if (require) throw new AppError('Species interest not found', 404)
            return undefined
        }
    }

    public async getByUserId(userId: number): Promise<TSpeciesInterest[]> {
        const query = dbManager.db.select()
            .from(speciesInterests)
            .where(eq(speciesInterests.userId, userId))
            .prepare('getByUserId' + new Date().getTime())

        const result = await query.execute()
        return result
    }
}