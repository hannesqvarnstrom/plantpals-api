import { type InferInsertModel, type InferSelectModel, eq } from "drizzle-orm";
import dbManager from "../db";
import { tradeMessages } from "../db/schema";

import { AppError } from "../utils/errors";

export type RawTradeMessage = InferSelectModel<typeof tradeMessages>;
export type TTradeMessageCreateArgs = InferInsertModel<typeof tradeMessages>;
export type TTradeMessage = RawTradeMessage;

export default class TradeMessageModel {
	public static factory(params: RawTradeMessage): TTradeMessage {
		const {
			id,
			tradeId,
			senderUserId,
			recipientUserId,
			suggestionId,
			createdAt,
			deletedAt,
			readAt,
			content,
			type,
		} = params;
		return {
			id,
			tradeId,
			senderUserId,
			recipientUserId,
			suggestionId,
			createdAt,
			deletedAt,
			readAt,
			content,
			type,
		};
	}

	public async create(args: TTradeMessageCreateArgs): Promise<TTradeMessage> {
		const query = dbManager.db
			.insert(tradeMessages)
			.values(args)
			.returning()
			.prepare(`createTradeaMessage${new Date().getTime()}`);

		const [result, ..._] = await query.execute();
		if (!result) {
			throw new AppError(
				"Something went wrong while creating trade message",
				400,
			);
		}

		return result;
	}

	public async getById<B extends boolean = true>(
		id: number,
		require: B,
	): Promise<TTradeMessage>;
	public async getById(id: number): Promise<TTradeMessage | undefined>;
	public async getById<B extends boolean = false>(id: number, require?: B) {
		const query = dbManager.db
			.select()
			.from(tradeMessages)
			.where(eq(tradeMessages.id, id))
			.prepare(`getByTradeMessagePlantId${new Date().getTime()}`);

		const [result, ..._] = await query.execute();

		if (result) {
			const plant = TradeMessageModel.factory(result);
			return plant;
		}
		if (require) throw new AppError("Trade Message not found", 404);
		return undefined;
	}
}
