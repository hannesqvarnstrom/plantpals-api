// import dbManager from "../db"
// import { traders } from "../db/schema"
// import { eq, InferInsertModel, InferSelectModel } from 'drizzle-orm'
// import { AppError } from "../utils/errors"

// export type RawTrader = InferSelectModel<typeof traders>
// export type TTraderCreateArgs = InferInsertModel<typeof traders>
// export type TTrader = RawTrader


// export default class TraderModel {
//     constructor() {

//     }

//     public static factory(params: RawTrader): TTrader {
//         const { id, name, location, createdBy, createdAt } = params
//         return { id, name, location, createdBy, createdAt }
//     }

//     public async create(args: TTraderCreateArgs): Promise<TTrader> {
//         const query = dbManager.db.insert(traders)
//             .values(args)
//             .returning()
//             .prepare(
//                 'createTrader' + new Date().getTime()
//             )

//         const [result, ..._] = await query.execute()
//         if (!result) {
//             throw new AppError('Something went wrong while rating', 400)
//         }

//         return result
//     }

//     public async getById<B extends boolean = true>(id: number, require: B): Promise<TTrader>
//     public async getById(id: number): Promise<TTrader | undefined>
//     public async getById<B extends boolean = false>(id: number, require?: B) {
//         const query = dbManager.db.select()
//             .from(traders)
//             .where(eq(traders.id, id))
//             .prepare('getByPlantId' + new Date().getTime())

//         const [result, ..._] = await query.execute()

//         if (result) {
//             const plant = TraderModel.factory(result)
//             return plant
//         } else {
//             if (require) throw new AppError('Plant not found', 404)
//             return undefined
//         }
//     }

//     public async getByUserId(userId: number): Promise<TTrader[]> {
//         const query = dbManager.db.select()
//             .from(traders)
//             .where(eq(traders.createdBy, userId))
//             .prepare('getByUserId' + new Date().getTime())

//         const result = await query.execute()
//         return result
//     }

//     public async update(id: number, { name, location }: Partial<InferInsertModel<typeof traders>>): Promise<TTrader> {
//         const updateObject: Partial<InferInsertModel<typeof traders>> = {}
//         if (name) updateObject.name = name
//         if (location) updateObject.location = location

//         const query = dbManager.db.update(traders)
//             .set(updateObject)
//             .where(eq(traders.id, id))
//             .returning()
//             .prepare('updateTrader' + new Date().getTime())

//         const [result, ..._] = await query.execute()

//         if (!result) {
//             throw new AppError('Trader not found', 404)
//         }
//         return result
//     }
// }