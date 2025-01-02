import {
	Subquery,
	and,
	countDistinct,
	desc,
	eq,
	exists,
	inArray,
	isNull,
	not,
	or,
	sql,
} from "drizzle-orm";
import dbManager from "../db";
import {
	familyInterests,
	genusInterests,
	plants,
	species,
	speciesInterests,
	tradeStatusChanges,
	tradeStatusTypes,
	tradeSuggestionPlants,
	tradeSuggestions,
	tradeablePlants,
	trades,
	users,
} from "../db/schema";
import TradeModel, { TTrade, type TTradeCreateArgs } from "../models/trade";
import type { TTradeStatusType } from "../models/trade-status-type";
import TradeSuggestionModel, {
	type TTradeSuggestion,
} from "../models/trade-suggestion";
import TradeSuggestionPlantModel from "../models/trade-suggestion-plant";
import UserModel, { type TUser } from "../models/user";
import { AppError } from "../utils/errors";
import { NotificationsService } from "./notifications";
import plantService, { type CollectedPlant } from "./plant";
import taxonomyService from "./taxonomy";
import userService, {
	type FamilyInterest,
	type GenusInterest,
	type SpeciesInterest,
} from "./user";

const TRADE_STATUS_VALUES = {
	pending: "pending",
	accepted: "accepted",
	in_transit: "in_transit",
	completed: "completed",
	declined: "declined",
	cancelled: "cancelled",
} as const;
class TradingService {
	tradeModel: TradeModel;
	userModel: UserModel;
	tradeSuggestionModel: TradeSuggestionModel;
	tradeSuggestionPlantModel: TradeSuggestionPlantModel;
	notificationsService: NotificationsService;
	constructor() {
		this.tradeModel = new TradeModel();
		this.tradeSuggestionModel = new TradeSuggestionModel();
		this.tradeSuggestionPlantModel = new TradeSuggestionPlantModel();
		this.userModel = new UserModel();
		this.notificationsService = NotificationsService.getInstance();
	}

	public async checkStatus(tradeId: number): Promise<TTradeStatusType> {
		const trade = await dbManager.db.query.trades.findFirst({
			where: eq(trades.id, tradeId),
			with: {
				statusType: true,
			},
		});
		if (!trade) {
			throw new AppError("could not find trade");
		}

		return trade.statusType;
	}

	public async getTrades(userId: number): Promise<Trades | undefined> {
		const userTrades = await dbManager.db.query.users
			.findFirst({
				with: {
					tradesRequestedByUser: true,
					tradesReceivedByUser: true,
				},
				where: eq(users.id, userId),
			})
			.execute();

		const trades: Trades = {
			inbox: [],
			inProgress: [],
			history: [],
		};
		if (
			!userTrades ||
			!(userTrades.tradesRequestedByUser && userTrades.tradesReceivedByUser)
		) {
			return;
		}
		for (const trade of [
			...userTrades.tradesRequestedByUser,
			...userTrades.tradesReceivedByUser,
		]) {
			const [status, ...history] = await dbManager.db
				.select({
					id: tradeStatusTypes?.id,
					name: tradeStatusTypes.name,
					value: tradeStatusTypes.value,
				})
				.from(tradeStatusChanges)
				.where(eq(tradeStatusChanges.tradeId, trade.id))
				.innerJoin(
					tradeStatusTypes,
					eq(tradeStatusTypes.id, tradeStatusChanges.statusId),
				)
				.orderBy(desc(tradeStatusChanges.changedAt));
			console.log({ status, history });
			if (!status) {
				throw new AppError("couldnt find status for a trade", 500);
			}

			const suggestionHistory = await dbManager.db
				.select()
				.from(tradeSuggestions)
				.where(and(eq(tradeSuggestions.tradeId, trade.id)))
				.orderBy(desc(tradeSuggestions.createdAt));

			const currentSuggestion = suggestionHistory[0];
			if (!currentSuggestion) {
				throw new AppError("no current suggestion for trade");
			}
			const otherUser = await userService.getById(
				trade.requestingUserId === userId
					? trade.receivingUserId
					: trade.requestingUserId,
			);

			const hydratedTrade: Trade = {
				subjectUserId: trade.requestingUserId,
				objectUserId: trade.receivingUserId,
				id: trade.id,
				otherUserUsername: otherUser.username ?? "",
				currentSuggestion,
				status,
				createdAt: trade.createdAt,
				suggestionHistory: suggestionHistory.slice(1),
			};
			// console.log("hydratedTrade:", hydratedTrade);

			if (
				currentSuggestion.objectUserId === userId &&
				hydratedTrade.status.value === "pending"
			) {
				trades.inbox.push(hydratedTrade);
			} else if (
				!["completed", "declined", "cancelled"].includes(
					hydratedTrade.status.value,
				)
			) {
				trades.inProgress.push(hydratedTrade);
			} else {
				trades.history.push(hydratedTrade);
			}
		}

		return trades;
	}

	public async getAllPossibleTradesForUser(user: TUser): Promise<
		{
			userId: number;
			username: string | null;
			speciesMatches: number;
			otherMatches: number;
			tradeInProgress: number;
		}[]
	> {
		const userPlants = await plantService.getUserCollection(user.id);
		const userInterests = await userService.getInterests(user.id);

		const requireSomeInterests = or(
			inArray(
				speciesInterests.speciesId,
				userPlants.map((plant) => plant.speciesId),
			),
			inArray(
				genusInterests.genusId,
				userPlants.map((plant) => plant.genusId),
			),
			inArray(
				familyInterests.familyId,
				userPlants.map((plant) => plant.familyId),
			),
		);
		const requireSomeMatchingPlant = exists(
			dbManager.db
				.select({ id: plants.id })
				.from(plants)
				.where(
					and(
						eq(plants.userId, users.id),
						or(
							inArray(
								species.id,
								userInterests.species.map((s) => s.speciesId),
							),
							inArray(
								species.genusId,
								userInterests.genus.map((s) => s.genusId),
							),
							inArray(
								species.familyId,
								userInterests.family.map((s) => s.familyId),
							),
						),
					),
				)
				.innerJoin(tradeablePlants, eq(tradeablePlants.plantId, plants.id))
				.innerJoin(species, eq(species.id, plants.speciesId))
				.limit(1),
		);
		const [declinedStatus, ..._] = await dbManager.db
			.select()
			.from(tradeStatusTypes)
			.where(eq(tradeStatusTypes.value, "declined"));
		if (!declinedStatus) {
			throw new AppError("cant find declined status");
		}
		const usersQuery = dbManager.db
			.select({
				userId: users.id,
				username: users.username,
				speciesMatches: sql<number>`COUNT(DISTINCT CASE
				WHEN ${inArray(
					species.id,
					userInterests.species.map((s) => s.speciesId),
				)}
				THEN ${plants.id}
				END)`.as("speciesMatches"),
				otherMatches: sql<number>`COUNT(DISTINCT CASE
				WHEN ${or(
					inArray(
						species.genusId,
						userInterests.genus.map((s) => s.genusId),
					),
					inArray(
						species.familyId,
						userInterests.family.map((s) => s.familyId),
					),
				)}
				THEN ${plants.id}
				END)`.as("otherMatches"),
				tradeInProgress: countDistinct(trades.id),
			})
			.from(users)
			.where(
				and(
					requireSomeInterests,
					requireSomeMatchingPlant,
					not(eq(users.id, user.id)),
				),
			)
			.leftJoin(speciesInterests, eq(speciesInterests.userId, users.id))
			.leftJoin(genusInterests, eq(genusInterests.userId, users.id))
			.leftJoin(familyInterests, eq(familyInterests.userId, users.id))
			.leftJoin(plants, eq(plants.userId, users.id))
			.leftJoin(tradeablePlants, eq(tradeablePlants.plantId, plants.id))
			.leftJoin(species, eq(species.id, plants.speciesId))
			.leftJoin(
				trades,
				and(
					or(
						eq(trades.receivingUserId, user.id),
						eq(trades.requestingUserId, user.id),
					),
					or(
						eq(trades.receivingUserId, users.id),
						eq(trades.requestingUserId, users.id),
					),
					not(
						exists(
							dbManager.db
								.select({ id: tradeStatusChanges.id })
								.from(tradeStatusChanges)
								.where(
									and(
										eq(tradeStatusChanges.tradeId, trades.id),
										eq(tradeStatusChanges.statusId, declinedStatus.id),
									),
								)
								.limit(1),
						),
					),
				),
			)
			.groupBy(users.id, users.username)
			.orderBy(desc(sql`"speciesMatches"`), desc(sql`"otherMatches"`));

		return usersQuery.execute();
	}

	public async getPlantsForTradeMatch(
		subject: TUser,
		objectId: number,
	): Promise<{
		objectTradeableCollection: CollectedPlant[];
		objectInterests: {
			species: SpeciesInterest[];
			genus: GenusInterest[];
			family: FamilyInterest[];
		};
	}> {
		const object = await userService.getById(objectId);
		if (!object) {
			throw new AppError("cant find object user");
		}

		const objectInterests = await userService.getInterests(objectId);
		const objectCollection = await plantService.getUserCollection(object);

		// const subjectInterests = await userService.getInterests(subject.id);
		// const objectInterests = await userService.getInterests(object.id);

		const objectTradeableCollection = objectCollection.filter(
			(plant) => plant.openForTrade,
		);

		return {
			objectTradeableCollection,
			objectInterests,
		};
	}

	public async createTradeAndMakeSuggestion({
		subjectPlantIds,
		objectPlantIds,
		subjectUserId,
		objectUserId,
	}: {
		subjectPlantIds: number[];
		objectPlantIds: number[];
		subjectUserId: number;
		objectUserId: number;
	}): Promise<{ tradeId: number; tradeSuggestionId: number }> {
		const subjectUser = await userService.getById(subjectUserId);
		const objectUser = await userService.getById(objectUserId);
		if (!subjectUser || !objectUser) {
			throw new AppError("missing users");
		}

		const [status, ..._] = await dbManager.db
			.select()
			.from(tradeStatusTypes)
			.where(eq(tradeStatusTypes.value, TRADE_STATUS_VALUES.pending));
		if (!status) {
			throw new AppError("missing pending status", 500);
		}
		const trade = await this.tradeModel.create({
			requestingUserId: subjectUserId,
			receivingUserId: objectUserId,
			statusId: status.id,
		});
		const initialStatus = await dbManager.db
			.insert(tradeStatusChanges)
			.values({ tradeId: trade.id, statusId: status.id })
			.returning();

		const tradeSuggestion = await this.validateAndMakeTradeSuggestion(
			subjectUserId,
			objectUserId,
			subjectPlantIds,
			objectPlantIds,
			trade.id,
		);

		return { tradeId: trade.id, tradeSuggestionId: tradeSuggestion.id };
	}

	public async makeSuggestionForPendingTrade(
		tradeId: number,
		suggestionId: number,
		userId: number,
		subjectPlantIds: number[],
		objectPlantIds: number[],
	): Promise<{ tradeId: number; tradeSuggestionId: number }> {
		const trade = await this.tradeModel.getById(tradeId);
		const suggestion = await this.tradeSuggestionModel.getById(suggestionId);
		if (!trade || !suggestion) {
			throw new AppError("cant find trade or suggestion", 404);
		}
		if (userId !== suggestion.objectUserId) {
			throw new AppError(
				"Please wait for the other person to respond before altering the trade suggestion",
				400,
			);
		}

		const newSubjectUserId = userId;
		const newObjectUserId = suggestion.subjectUserId;

		const newTradeSuggestion = await this.validateAndMakeTradeSuggestion(
			newSubjectUserId,
			newObjectUserId,
			subjectPlantIds,
			objectPlantIds,
			trade.id,
		);

		return { tradeId: trade.id, tradeSuggestionId: newTradeSuggestion.id };
	}

	private async validateAndMakeTradeSuggestion(
		subjectUserId: number,
		objectUserId: number,
		subjectPlantIds: number[],
		objectPlantIds: number[],
		tradeId: number,
	): Promise<TradeSuggestion> {
		await Promise.all(
			subjectPlantIds.map(async (id) => {
				const plant = await plantService.getById(id);
				if (plant.userId !== subjectUserId) {
					throw new AppError("subject user does not own plant", 400);
				}
			}),
		);

		await Promise.all(
			objectPlantIds.map(async (id) => {
				const plant = await plantService.getById(id);
				if (plant.userId !== objectUserId) {
					throw new AppError("object user does not own plant", 400);
				}
			}),
		);

		const newTradeSuggestion = await this.tradeSuggestionModel.create({
			subjectUserId: subjectUserId,
			objectUserId: objectUserId,
			tradeId: tradeId,
		});

		await Promise.all(
			subjectPlantIds.map(async (plantId) => {
				return await this.tradeSuggestionPlantModel.create({
					plantId,
					tradeSuggestionId: newTradeSuggestion.id,
				});
			}),
		);

		await Promise.all(
			objectPlantIds.map(async (plantId) => {
				return await this.tradeSuggestionPlantModel.create({
					plantId,
					tradeSuggestionId: newTradeSuggestion.id,
				});
			}),
		);
		await this.notifyUsers([subjectUserId, objectUserId]);

		// await this.notificationsService.publishToUser({
		// 	type: "TRADES_UPDATE",
		// 	payload: await this.getTrades(subjectUserId),
		// });

		return newTradeSuggestion;
	}

	private async notifyUsers(userIds: number[]) {
		return Promise.all(
			userIds.map(
				async (id) =>
					await this.notificationsService.publishToUser(String(id), {
						type: "TRADES_UPDATE",
						payload: await this.getTrades(id),
					}),
			),
		);
	}

	public async getSuggestion(
		suggestionId: number,
		user: TUser,
	): Promise<CollectedPlant[]> {
		const suggestion = await dbManager.db.query.tradeSuggestions.findFirst({
			where: and(
				eq(tradeSuggestions.id, suggestionId),
				or(
					eq(tradeSuggestions.subjectUserId, user.id),
					eq(tradeSuggestions.objectUserId, user.id),
				),
			),
			with: {
				suggestionPlants: true,
			},
		});
		if (!suggestion) {
			throw new AppError("missing suggestion");
		}

		const suggestionPlants = await dbManager.db
			.select()
			.from(plants)
			.where(
				inArray(
					plants.id,
					suggestion.suggestionPlants.map((sp) => sp.plantId),
				),
			);

		return Promise.all(
			suggestionPlants.map((plant) =>
				plantService.getCollectedPlant(plant, user.id),
			),
		);
	}

	public async getTradeMatchesForSpecies(
		speciesId: number,
		user: TUser,
	): Promise<
		{
			userId: number;
			username: string | null;
			speciesMatches: number;
			otherMatches: number;
			tradeInProgress: number;
		}[]
	> {
		// const userPlants = await plantService.getUserCollection(user.id);
		const userInterests = await userService.getInterests(user.id);

		// const requireSomeInterests = or(
		// 	inArray(
		// 		speciesInterests.speciesId,
		// 		userPlants.map((plant) => plant.speciesId),
		// 	),
		// 	inArray(
		// 		genusInterests.genusId,
		// 		userPlants.map((plant) => plant.genusId),
		// 	),
		// 	inArray(
		// 		familyInterests.familyId,
		// 		userPlants.map((plant) => plant.familyId),
		// 	),
		// );
		const requireSomeMatchingPlant = exists(
			dbManager.db
				.select({ id: plants.id })
				.from(plants)
				.where(
					and(
						eq(plants.userId, users.id),
						eq(plants.speciesId, speciesId),
						or(
							inArray(
								species.id,
								userInterests.species.map((s) => s.speciesId),
							),
							inArray(
								species.genusId,
								userInterests.genus.map((s) => s.genusId),
							),
							inArray(
								species.familyId,
								userInterests.family.map((s) => s.familyId),
							),
						),
					),
				)
				.innerJoin(tradeablePlants, eq(tradeablePlants.plantId, plants.id))
				.innerJoin(species, eq(species.id, plants.speciesId))
				.limit(1),
		);
		const [declinedStatus, ..._] = await dbManager.db
			.select()
			.from(tradeStatusTypes)
			.where(eq(tradeStatusTypes.value, "declined"));
		if (!declinedStatus) {
			throw new AppError("cant find declined status");
		}
		const usersQuery = dbManager.db
			.select({
				userId: users.id,
				username: users.username,
				speciesMatches: sql<number>`COUNT(DISTINCT CASE
				WHEN ${inArray(
					species.id,
					userInterests.species.map((s) => s.speciesId),
				)}
				THEN ${plants.id}
				END)`.as("speciesMatches"),
				otherMatches: sql<number>`COUNT(DISTINCT CASE
				WHEN ${or(
					inArray(
						species.genusId,
						userInterests.genus.map((s) => s.genusId),
					),
					inArray(
						species.familyId,
						userInterests.family.map((s) => s.familyId),
					),
				)}
				THEN ${plants.id}
				END)`.as("otherMatches"),
				tradeInProgress: countDistinct(trades.id),
			})
			.from(users)
			.where(
				and(
					// requireSomeInterests,
					requireSomeMatchingPlant,
					not(eq(users.id, user.id)),
				),
			)
			.leftJoin(speciesInterests, eq(speciesInterests.userId, users.id))
			.leftJoin(genusInterests, eq(genusInterests.userId, users.id))
			.leftJoin(familyInterests, eq(familyInterests.userId, users.id))
			.leftJoin(plants, eq(plants.userId, users.id))
			.leftJoin(tradeablePlants, eq(tradeablePlants.plantId, plants.id))
			.leftJoin(species, eq(species.id, plants.speciesId))
			.leftJoin(
				trades,
				and(
					or(
						eq(trades.receivingUserId, user.id),
						eq(trades.requestingUserId, user.id),
					),
					or(
						eq(trades.receivingUserId, users.id),
						eq(trades.requestingUserId, users.id),
					),
					not(
						exists(
							dbManager.db
								.select({ id: tradeStatusChanges.id })
								.from(tradeStatusChanges)
								.where(
									and(
										eq(tradeStatusChanges.tradeId, trades.id),
										eq(tradeStatusChanges.statusId, declinedStatus.id),
									),
								)
								.limit(1),
						),
					),
				),
			)
			.groupBy(users.id, users.username)
			.orderBy(desc(sql`"speciesMatches"`), desc(sql`"otherMatches"`));

		return usersQuery.execute();
		/**
		 * the same as the match algorhithm, but include all those who have the species REGARDLESS if matching.
		 * separate them into different lists:
		 * - ones with matches
		 * - ones without
		 */
	}
	// public async getFullSuggestionData(
	// 	suggestionId: number,
	// 	user: TUser,
	// ): Promise<{
	// 	suggestionPlants: CollectedPlant[];
	// 	otherUsersInterests: {
	// 		species: SpeciesInterest[];
	// 		genus: GenusInterest[];
	// 		family: FamilyInterest[];
	// 	};
	// }> {

	// }
	public async acceptTradeSuggestion(
		tradeId: number,
		suggestionId: number,
		user: TUser,
	): Promise<void> {
		const trade = await this.tradeModel.getById(tradeId);
		const suggestion = await this.tradeSuggestionModel.getById(suggestionId);
		if (suggestion?.objectUserId !== user.id) {
			throw new AppError("Cannot accept trade where you aren't the object");
		}

		const acceptedStatus = await dbManager.db.query.tradeStatusTypes.findFirst({
			where: eq(tradeStatusTypes.value, "accepted"),
		});
		if (!trade || !suggestion || !acceptedStatus) {
			throw new AppError(
				"cant find trade or suggestion or acceptedstatus",
				404,
			);
		}
		await dbManager.db.insert(tradeStatusChanges).values({
			statusId: acceptedStatus.id,
			tradeId: tradeId,
		});
		await dbManager.db
			.update(tradeSuggestions)
			.set({ acceptedAt: new Date() })
			.where(eq(tradeSuggestions.id, suggestionId));
		await dbManager.db
			.update(trades)
			.set({ statusId: acceptedStatus.id })
			.where(eq(trades.id, tradeId));
		await this.notifyUsers([user.id, suggestion.subjectUserId]);

		// await this.notificationsService.publishToUser({
		// 	type: "TRADES_UPDATE",
		// 	payload: await this.getTrades(user.id),
		// });
		/**
		 * find trade accepted status
		 * set trade status as accepted
		 * set trade suggestion status as accepted
		 *
		 *
		 */
	}

	public async declineTradeSuggestion(
		tradeId: number,
		suggestionId: number,
		user: TUser,
	): Promise<void> {
		const trade = await this.tradeModel.getById(tradeId);
		const suggestion = await this.tradeSuggestionModel.getById(suggestionId);
		if (suggestion?.objectUserId !== user.id) {
			throw new AppError("Cannot decline trade where you aren't the object");
		}

		const declinedStatus = await dbManager.db.query.tradeStatusTypes.findFirst({
			where: eq(tradeStatusTypes.value, "declined"),
		});
		if (!trade || !suggestion || !declinedStatus) {
			throw new AppError(
				"cant find trade or suggestion or declinedStatus",
				404,
			);
		}

		await dbManager.db.insert(tradeStatusChanges).values({
			statusId: declinedStatus.id,
			tradeId: tradeId,
		});
		await dbManager.db
			.update(tradeSuggestions)
			.set({ deniedAt: new Date() })
			.where(eq(tradeSuggestions.id, suggestionId));
		await dbManager.db
			.update(trades)
			.set({ statusId: declinedStatus.id })
			.where(eq(trades.id, tradeId));

		await this.notifyUsers([user.id, suggestion.subjectUserId]);

		// await this.notificationsService.publishToUser({
		// 	type: "TRADES_UPDATE",
		// 	payload: await this.getTrades(user.id),
		// });
	}
}

interface Trade {
	id: number;
	subjectUserId: number;
	objectUserId: number;
	status: TradeStatus;
	otherUserUsername: string;
	currentSuggestion: TradeSuggestion;
	suggestionHistory: TradeSuggestionHistory;
	createdAt: Date;
}

type TradeSuggestion = TTradeSuggestion;

type TradeSuggestionHistory = TradeSuggestion[];

export interface Trades {
	inbox: Trade[];
	inProgress: Trade[];
	history: Trade[];
}

interface TradeStatus {
	id: number;
	name: string;
	value: "pending" | "accepted" | "completed" | "declined" | "cancelled";
}

const tradingService = new TradingService();
export default tradingService;

export interface TradeMatch {
	userId: number;
	username: string | null;
	speciesMatches: number;
	otherMatches: number;
	tradeInProgress: number;
}
