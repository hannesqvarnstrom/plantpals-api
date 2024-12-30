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
import { tradeSuggestionPlants, trades } from "../db/schema";
import { PlantTypeCol } from "../services/plant";
import { AppError } from "../utils/errors";

export type RawTradeSuggestionPlant = InferSelectModel<
	typeof tradeSuggestionPlants
>;
export type TTradeSuggestionPlantCreateArgs = InferInsertModel<
	typeof tradeSuggestionPlants
>;
export type TTradeSuggestion = RawTradeSuggestionPlant;

export default class TradeSuggestionPlantModel {
	public static factory(params: RawTradeSuggestionPlant): TTradeSuggestion {
		const { id, plantId, tradeSuggestionId } = params;
		return {
			id,
			plantId,
			tradeSuggestionId,
		};
	}

	public async create(
		args: TTradeSuggestionPlantCreateArgs,
	): Promise<TTradeSuggestion> {
		const query = dbManager.db
			.insert(tradeSuggestionPlants)
			.values(args)
			.returning()
			.prepare(`createTradeSuggestionPlant${new Date().getTime()}`);

		const [result, ..._] = await query.execute();
		if (!result) {
			throw new AppError(
				"Something went wrong while creating trade suggestion plant",
				400,
			);
		}

		return result;
	}

	public async getById<B extends boolean = true>(
		id: number,
		require: B,
	): Promise<TTradeSuggestion>;
	public async getById(id: number): Promise<TTradeSuggestion | undefined>;
	public async getById<B extends boolean = false>(id: number, require?: B) {
		const query = dbManager.db
			.select()
			.from(tradeSuggestionPlants)
			.where(eq(tradeSuggestionPlants.id, id))
			.prepare(`getByTradeSuggestionPlantId${new Date().getTime()}`);

		const [result, ..._] = await query.execute();

		if (result) {
			const plant = TradeSuggestionPlantModel.factory(result);
			return plant;
		}
		if (require) throw new AppError("Trade suggestion plant not found", 404);
		return undefined;
	}
}
