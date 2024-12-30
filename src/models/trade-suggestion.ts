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
import { tradeSuggestions, trades } from "../db/schema";
import { PlantTypeCol } from "../services/plant";
import { AppError } from "../utils/errors";

export type RawTradeSuggestion = InferSelectModel<typeof tradeSuggestions>;
export type TTradeSuggestionCreateArgs = InferInsertModel<
	typeof tradeSuggestions
>;
export type TTradeSuggestion = RawTradeSuggestion;

export default class TradeSuggestionModel {
	public static factory(params: RawTradeSuggestion): TTradeSuggestion {
		const {
			id,
			createdAt,
			subjectUserId,
			objectUserId,
			acceptedAt,
			deniedAt,
			respondedAt,
			tradeId,
		} = params;
		return {
			id,
			createdAt,
			subjectUserId,
			objectUserId,
			acceptedAt,
			deniedAt,
			respondedAt,
			tradeId,
		};
	}

	public async create(
		args: TTradeSuggestionCreateArgs,
	): Promise<TTradeSuggestion> {
		const query = dbManager.db
			.insert(tradeSuggestions)
			.values(args)
			.returning()
			.prepare(`createTradeSuggestion${new Date().getTime()}`);

		const [result, ..._] = await query.execute();
		if (!result) {
			throw new AppError(
				"Something went wrong while creating trade suggestion",
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
			.from(tradeSuggestions)
			.where(eq(tradeSuggestions.id, id))
			.prepare(`getByTradeSuggestionId${new Date().getTime()}`);

		const [result, ..._] = await query.execute();

		if (result) {
			const plant = TradeSuggestionModel.factory(result);
			return plant;
		}
		if (require) throw new AppError("Trade suggestion not found", 404);
		return undefined;
	}
}
