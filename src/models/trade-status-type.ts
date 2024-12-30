import { type InferSelectModel, eq } from "drizzle-orm";
import dbManager from "../db";
import { tradeStatusTypes } from "../db/schema";
import { AppError } from "../utils/errors";

export type RawTradeStatusType = InferSelectModel<typeof tradeStatusTypes>;

export type TTradeStatusType = RawTradeStatusType;

export default class TradeStatusTypeModel {
	public static factory(params: RawTradeStatusType): TTradeStatusType {
		const { id, name, value } = params;
		return { id, name, value };
	}

	public async getById<B extends boolean = true>(
		id: number,
		require: B,
	): Promise<TTradeStatusType>;
	public async getById(id: number): Promise<TTradeStatusType | undefined>;
	public async getById<B extends boolean = false>(id: number, require?: B) {
		const query = dbManager.db
			.select()
			.from(tradeStatusTypes)
			.where(eq(tradeStatusTypes.id, id))
			.prepare(`getByTradeStatusTypeId${new Date().getTime()}`);

		const [result, ..._] = await query.execute();

		if (result) {
			const plant = TradeStatusTypeModel.factory(result);
			return plant;
		}
		if (require) throw new AppError("Trade status type not found", 404);
		return undefined;
	}
}
