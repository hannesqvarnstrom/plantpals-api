import dbManager from "../db"
import { plants, users, userSpeciesSubmissions } from "../db/schema"
import { and, between, eq, InferColumnsDataTypes, InferInsertModel, InferSelectModel, sql } from 'drizzle-orm'
import { AppError } from "../utils/errors"
import { PlantTypeCol } from "../services/plant"

export type RawUserSpeciesSubmission = InferSelectModel<typeof userSpeciesSubmissions>
export type TUserSpeciesSubmissionCreateArgs = InferInsertModel<typeof userSpeciesSubmissions>
export type TUserSpeciesSubmission = RawUserSpeciesSubmission


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


export default class UserSpeciesSubmissionModel {
    constructor() {
    }

    public static factory(params: RawUserSpeciesSubmission): TUserSpeciesSubmission {
        const { id, createdAt, userId, speciesId } = params
        return { id, createdAt, userId, speciesId }
    }

    public async create(args: TUserSpeciesSubmissionCreateArgs): Promise<TUserSpeciesSubmission> {
        const query = dbManager.db.insert(userSpeciesSubmissions)
            .values(args)
            .returning()
            .prepare(
                'createSpeciesSubmission' + new Date().getTime()
            )

        const [result, ..._] = await query.execute()
        if (!result) {
            throw new AppError('Something went wrong while creating plant', 400)
        }

        return result
    }

    public async getById<B extends boolean = true>(id: number, require: B): Promise<TUserSpeciesSubmission>
    public async getById(id: number): Promise<TUserSpeciesSubmission | undefined>
    public async getById<B extends boolean = false>(id: number, require?: B) {
        const query = dbManager.db.select()
            .from(userSpeciesSubmissions)
            .where(eq(userSpeciesSubmissions.id, id))
            .prepare('getBySpeciesSubmissionId' + new Date().getTime())

        const [result, ..._] = await query.execute()

        if (result) {
            const plant = UserSpeciesSubmissionModel.factory(result)
            return plant
        } else {
            if (require) throw new AppError('Submission not found', 404)
            return undefined
        }
    }

    public async getByUserId(userId: number): Promise<TUserSpeciesSubmission[]> {
        const query = dbManager.db.select()
            .from(userSpeciesSubmissions)
            .where(eq(userSpeciesSubmissions.userId, userId))
            .prepare('getByUserId' + new Date().getTime())

        const result = await query.execute()
        return result
    }
}