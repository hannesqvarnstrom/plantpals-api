import {
	InferColumnsDataTypes,
	type InferInsertModel,
	type InferSelectModel,
	and,
	between,
	eq,
	sql,
} from "drizzle-orm";
import dbManager from "../db";
import { trades } from "../db/schema";
import { PlantTypeCol } from "../services/plant";
import { AppError } from "../utils/errors";

export type RawTrade = InferSelectModel<typeof trades>;
export type TTradeCreateArgs = InferInsertModel<typeof trades>;
export type TTrade = RawTrade;

export default class TradeModel {
	public static factory(params: RawTrade): TTrade {
		const { id, createdAt, requestingUserId, receivingUserId, statusId } =
			params;
		return {
			id,
			createdAt,
			requestingUserId,
			receivingUserId,
			statusId,
		};
	}

	public async create(args: TTradeCreateArgs): Promise<TTrade> {
		const query = dbManager.db
			.insert(trades)
			.values(args)
			.returning()
			.prepare(`createTrade${new Date().getTime()}`);

		const [result, ..._] = await query.execute();
		if (!result) {
			throw new AppError("Something went wrong while creating trade", 400);
		}

		return result;
	}

	public async getById<B extends boolean = true>(
		id: number,
		require: B,
	): Promise<TTrade>;
	public async getById(id: number): Promise<TTrade | undefined>;
	public async getById<B extends boolean = false>(id: number, require?: B) {
		const query = dbManager.db
			.select()
			.from(trades)
			.where(eq(trades.id, id))
			.prepare(`getByTradeId${new Date().getTime()}`);

		const [result, ..._] = await query.execute();

		if (result) {
			const plant = TradeModel.factory(result);
			return plant;
		}
		if (require) throw new AppError("Trade not found", 404);
		return undefined;
	}
}
