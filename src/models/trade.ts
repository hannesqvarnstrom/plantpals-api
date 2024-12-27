import dbManager from "../db";
import { trades } from "../db/schema";
import {
    and,
    between,
    eq,
    InferColumnsDataTypes,
    InferInsertModel,
    InferSelectModel,
    sql,
} from "drizzle-orm";
import { AppError } from "../utils/errors";
import { PlantTypeCol } from "../services/plant";

export type RawTrade = InferSelectModel<typeof trades>;
export type TTradeCreateArgs = InferInsertModel<typeof trades>;
export type TTrade = RawTrade;


// export interface DeepPlant extends ShallowPlant {
//     id: string,
// }

export default class TradeModel {
    constructor() { }

    public static factory(params: RawTrade): TTrade {
        const { id, createdAt, requestingUserId, receivingUserId, plantDesiredId, plantOfferedId, statusId } = params;
        return { id, createdAt, requestingUserId, receivingUserId, plantDesiredId, plantOfferedId, statusId };
    }

    public async create(args: TTradeCreateArgs): Promise<TTrade> {
        const query = dbManager.db
            .insert(trades)
            .values(args)
            .returning()
            .prepare("createTrade" + new Date().getTime());

        const [result, ..._] = await query.execute();
        if (!result) {
            throw new AppError("Something went wrong while creating trade", 400);
        }

        return result;
    }

    public async getById<B extends boolean = true>(
        id: number,
        require: B
    ): Promise<TTrade>;
    public async getById(id: number): Promise<TTrade | undefined>;
    public async getById<B extends boolean = false>(id: number, require?: B) {
        const query = dbManager.db
            .select()
            .from(trades)
            .where(eq(trades.id, id))
            .prepare("getByTradeId" + new Date().getTime());

        const [result, ..._] = await query.execute();

        if (result) {
            const plant = TradeModel.factory(result);
            return plant;
        } else {
            if (require) throw new AppError("Trade not found", 404);
            return undefined;
        }
    }
}
