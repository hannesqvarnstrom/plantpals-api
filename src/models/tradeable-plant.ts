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
import { tradeablePlants } from "../db/schema";
import { PlantTypeCol } from "../services/plant";
import { AppError } from "../utils/errors";

export type RawTradeablePlant = InferSelectModel<typeof tradeablePlants>;
export type TTradeablePlantCreateArgs = InferInsertModel<
	typeof tradeablePlants
>;
export type TTradeablePlant = RawTradeablePlant;

export default class TradeablePlantModel {
	public static factory(params: RawTradeablePlant): TTradeablePlant {
		const { id, plantId, availableFrom } = params;
		return { id, plantId, availableFrom };
	}

	public async create(
		args: TTradeablePlantCreateArgs,
	): Promise<TTradeablePlant> {
		const query = dbManager.db
			.insert(tradeablePlants)
			.values(args)
			.returning()
			.prepare(`createTradeablePlant${new Date().getTime()}`);

		const [result, ..._] = await query.execute();
		if (!result) {
			throw new AppError(
				"Something went wrong while creating tradeable plant",
				400,
			);
		}

		return result;
	}

	public async getById<B extends boolean = true>(
		id: number,
		require: B,
	): Promise<TTradeablePlant>;
	public async getById(id: number): Promise<TTradeablePlant | undefined>;
	public async getById<B extends boolean = false>(id: number, require?: B) {
		const query = dbManager.db
			.select()
			.from(tradeablePlants)
			.where(eq(tradeablePlants.id, id))
			.prepare(`getByTradeablePlantId${new Date().getTime()}`);

		const [result, ..._] = await query.execute();

		if (result) {
			const plant = TradeablePlantModel.factory(result);
			return plant;
		}
		if (require) throw new AppError("Tradeable Plant not found", 404);
		return undefined;
	}
}
