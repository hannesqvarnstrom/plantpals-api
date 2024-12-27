import dbManager from "../db";
import { tradeStatusTypes } from "../db/schema";
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

export type RawTradeStatusType = InferSelectModel<typeof tradeStatusTypes>;

export type TTradeStatusType = RawTradeStatusType;


// export interface DeepPlant extends ShallowPlant {
//     id: string,
// }

export default class TradeStatusTypeModel {
    constructor() { }

    public static factory(params: RawTradeStatusType): TTradeStatusType {
        const { id, name, value } = params;
        return { id, name, value };
    }

    public async getById<B extends boolean = true>(
        id: number,
        require: B
    ): Promise<TTradeStatusType>;
    public async getById(id: number): Promise<TTradeStatusType | undefined>;
    public async getById<B extends boolean = false>(id: number, require?: B) {
        const query = dbManager.db
            .select()
            .from(tradeStatusTypes)
            .where(eq(tradeStatusTypes.id, id))
            .prepare("getByTradeStatusTypeId" + new Date().getTime());

        const [result, ..._] = await query.execute();

        if (result) {
            const plant = TradeStatusTypeModel.factory(result);
            return plant;
        } else {
            if (require) throw new AppError("Trade status type not found", 404);
            return undefined;
        }
    }
}
