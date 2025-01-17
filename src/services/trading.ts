import {
	type InferInsertModel,
	Subquery,
	and,
	countDistinct,
	desc,
	eq,
	exists,
	inArray,
	isNotNull,
	isNull,
	not,
	or,
	sql,
} from "drizzle-orm";
import dbManager from "../db";
import {
	families,
	familyInterests,
	genera,
	genusInterests,
	plantTypeEnum,
	plants,
	species,
	speciesInterests,
	tradeMessages,
	tradeStatusChanges,
	tradeStatusTypes,
	tradeSuggestionPlants,
	tradeSuggestions,
	tradeablePlants,
	trades,
	users,
} from "../db/schema";
import SpeciesModel from "../models/species";
import TradeModel, { type TTrade } from "../models/trade";
import type { TTradeMessage } from "../models/trade-message";
import type { TTradeStatusType } from "../models/trade-status-type";
import TradeSuggestionModel, {
	type TTradeSuggestion,
} from "../models/trade-suggestion";
import TradeSuggestionPlantModel from "../models/trade-suggestion-plant";
import UserModel, { type TUser } from "../models/user";
import { AppError } from "../utils/errors";
import { NotificationsService } from "./notifications";
import plantService, { type PlantTypeCol, type CollectedPlant } from "./plant";
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

	speciesModel: SpeciesModel;
	constructor() {
		this.tradeModel = new TradeModel();
		this.tradeSuggestionModel = new TradeSuggestionModel();
		this.tradeSuggestionPlantModel = new TradeSuggestionPlantModel();
		this.userModel = new UserModel();
		this.notificationsService = NotificationsService.getInstance();
		this.speciesModel = new SpeciesModel();
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

	public async getTrades(userId: number): Promise<Trades> {
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
			return { inbox: [], inProgress: [], history: [] };
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
					changedAt: tradeStatusChanges.changedAt
				})
				.from(tradeStatusChanges)
				.where(eq(tradeStatusChanges.tradeId, trade.id))
				.innerJoin(
					tradeStatusTypes,
					eq(tradeStatusTypes.id, tradeStatusChanges.statusId),
				)
				.orderBy(desc(tradeStatusChanges.changedAt));

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
				completedByUser:
					!!(
						trade.completedByReceivingUser && trade.receivingUserId === userId
					) ||
					!!(
						trade.completedByRequestingUser && trade.requestingUserId === userId
					),
			};

			if (
				currentSuggestion.objectUserId === userId &&
				hydratedTrade.status.value === "pending"
			) {
				trades.inbox.push(hydratedTrade);
			} else if (
				!["completed", "declined", "cancelled"].includes(
					hydratedTrade.status.value,
				) ||
				(hydratedTrade.status.value === "completed" &&
					!hydratedTrade.completedByUser)
			) {
				trades.inProgress.push(hydratedTrade);
			} else {
				trades.history.push(hydratedTrade);
			}
		}

		for (const trade of [
			...trades.inbox,
			...trades.inProgress,
			...trades.history,
		]) {
			trade.suggestionHistory.sort(
				(a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
			);
		}

		trades.inbox.sort(
			(a, b) =>
				b.currentSuggestion.createdAt.getTime() -
				a.currentSuggestion.createdAt.getTime(),
		);
		trades.inProgress.sort(
			(a, b) =>
				b.currentSuggestion.createdAt.getTime() -
				a.currentSuggestion.createdAt.getTime(),
		);
		trades.history.sort(
			(a, b) =>
				b.currentSuggestion.createdAt.getTime() -
				a.currentSuggestion.createdAt.getTime(),
		);

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
		if (
			(!userInterests.family.length &&
				!userInterests.genus.length &&
				!userInterests.species.length) ||
			!userPlants.length
		) {
			return [];
		}
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

		// maybe this as a CTE?
		// like, user interest plants?
		// my thinking is this will be very unperformant.
		// since the exists is kinda nuts.

		// for each user, do this query.
		// i think it might be better to execute this ONCE, like user interest plants or something
		// then join that table in on the users query, instead
		const userInterestPlants = dbManager.db.$with("user_interest_plants").as(
			dbManager.db
				.select({ id: plants.id, userId: plants.userId })
				.from(plants)
				.where(
					and(
						isNull(plants.deletedAt),
						// eq(plants.userId, users.id),
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
				.innerJoin(species, eq(species.id, plants.speciesId)),
		);

		// const requireSomeMatchingPlant = exists(
		// 	dbManager.db
		// 		.select({ id: plants.id })
		// 		.from(plants)
		// 		.where(
		// 			and(
		// 				isNull(plants.deletedAt),
		// 				eq(plants.userId, users.id),
		// 				or(
		// 					inArray(
		// 						species.id,
		// 						userInterests.species.map((s) => s.speciesId),
		// 					),
		// 					inArray(
		// 						species.genusId,
		// 						userInterests.genus.map((s) => s.genusId),
		// 					),
		// 					inArray(
		// 						species.familyId,
		// 						userInterests.family.map((s) => s.familyId),
		// 					),
		// 				),
		// 			),
		// 		)
		// 		.innerJoin(tradeablePlants, eq(tradeablePlants.plantId, plants.id))
		// 		.innerJoin(species, eq(species.id, plants.speciesId))
		// 		.limit(1),
		// );
		const excludeStatuses = await dbManager.db
			.select({ id: tradeStatusTypes.id })
			.from(tradeStatusTypes)
			.where(
				inArray(tradeStatusTypes.value, [
					"accepted",
					"cancelled",
					"completed",
					"declined",
				]),
			);

		const usersQuery = dbManager.db
			.with(userInterestPlants)
			.select({
				userId: users.id,
				username: users.username,
				speciesMatches: sql<number>`COUNT(DISTINCT CASE
				WHEN ${inArray(
					species.id,
					userInterests.species.map((s) => s.speciesId),
				)}
				THEN ${species.id}
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
				THEN ${species.id}
				END)`.as("otherMatches"),
				tradeInProgress: countDistinct(trades.id),
			})
			.from(users)
			.where(and(requireSomeInterests, not(eq(users.id, user.id))))
			.innerJoin(userInterestPlants, eq(userInterestPlants.userId, users.id))
			.leftJoin(speciesInterests, eq(speciesInterests.userId, users.id))
			.leftJoin(genusInterests, eq(genusInterests.userId, users.id))
			.leftJoin(familyInterests, eq(familyInterests.userId, users.id))
			.leftJoin(
				plants,
				and(eq(plants.userId, users.id), isNull(plants.deletedAt)),
			)
			.innerJoin(tradeablePlants, eq(tradeablePlants.plantId, plants.id))
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
										inArray(
											tradeStatusChanges.statusId,
											excludeStatuses.map((x) => x.id),
										),
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
		await this.updateUsersTradeNotifications([subjectUserId, objectUserId]);

		return newTradeSuggestion;
	}

	private async updateUsersTradeNotifications(userIds: number[]) {
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

	private async updateUserTradeMessageNotifications(userId: number) {
		await this.notificationsService.publishToUser(String(userId), {
			type: "TRADES_MESSAGES_UPDATE",
			payload: await this.getTradeMessagesForUser(userId),
		});
	}

	public async getTradeMessagesForUser(userId: number) {
		const messages = await dbManager.db.query.tradeMessages.findMany({
			where: and(
				eq(tradeMessages.recipientUserId, userId),
				isNull(tradeMessages.deletedAt),
			),
			with: {
				suggestion: true,
				sender: true,
			},
		});
		return messages;
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
				and(
					isNull(plants.deletedAt),

					inArray(
						plants.id,
						suggestion.suggestionPlants.map((sp) => sp.plantId),
					),
				),
			);

		return Promise.all(
			suggestionPlants.map((plant) =>
				plantService.getCollectedPlant(plant, user.id),
			),
		);
	}

	public async getTradeDataForFamilyForUser(
		familyId: number,
		user: TUser,
	): Promise<TaxonTradeInfo> {
		const userPlants = await plantService.getUserCollection(user.id);
		const plantSpecies = await Promise.all(
			userPlants.map((plant) =>
				this.speciesModel.getById(plant.speciesId, true),
			),
		);
		const userOwnsSpecies = plantSpecies.some(
			(spec) => spec.familyId === familyId,
		);

		const userInterests = await userService.getInterests(user.id);
		const family = await dbManager.db.query.families.findFirst({
			where: eq(families.id, familyId),
		});

		if (!family) {
			throw new AppError("Unable to find genus");
		}

		const usersThatHaveItAvailable = await dbManager.db
			.selectDistinctOn([users.id], {
				id: users.id,
				username: users.username,
				plantTypesAvailable: sql<
					PlantTypeCol[] | null
				>`CASE WHEN MAX(plants.type) IS NOT NULL THEN 
					array_to_json(
						array_agg(
							distinct plants.type
						)
					) 
				ELSE
					null
				END`.as("plant_types_available"),
			})
			.from(users)
			.groupBy(users.id)
			.innerJoin(
				plants,
				and(eq(plants.userId, users.id), isNull(plants.deletedAt)),
			)
			.innerJoin(tradeablePlants, eq(plants.id, tradeablePlants.plantId))
			.innerJoin(
				species,
				and(eq(species.id, plants.speciesId), eq(species.familyId, familyId)),
			);

		const usersThatWantIt = await dbManager.db
			.selectDistinctOn([users.id], {
				id: users.id,
				username: users.username,
				tradeablePlantsCount: countDistinct(tradeablePlants.plantId),
			})
			.from(users)
			.where(
				and(
					not(eq(users.id, user.id)),
					or(
						eq(speciesInterests.speciesId, species.id),
						eq(genusInterests.genusId, species.genusId),
						eq(familyInterests.familyId, familyId),
					),
					// not(
					// 	exists(
					// 		dbManager.db
					// 			.select({ id: plants.id })
					// 			.from(plants)
					// 			.where(
					// 				and(
					// 					eq(plants.userId, users.id),
					// 					eq(plants.speciesId, speciesId),
					// 				),
					// 			)
					// 			.limit(1),
					// 	),
					// ),
				),
			)
			.innerJoin(
				plants,
				and(eq(plants.userId, users.id), isNull(plants.deletedAt)),
			)
			.innerJoin(
				species,
				and(eq(species.id, plants.speciesId), eq(species.familyId, familyId)),
			)
			.innerJoin(tradeablePlants, eq(tradeablePlants.plantId, plants.id))
			.leftJoin(speciesInterests, eq(speciesInterests.userId, users.id))
			.leftJoin(genusInterests, eq(genusInterests.userId, users.id))
			.leftJoin(familyInterests, eq(familyInterests.userId, users.id))
			.groupBy(users.id);

		const recommendedTradeUsersResult = userOwnsSpecies
			? usersThatWantIt
			: usersThatHaveItAvailable;

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

		const recommendedTradeUsers = await dbManager.db
			.select({
				id: users.id,

				// select matching interest to taxon. so we have matchingFamilyInterests, matchingGenusInterests, matchingSpeciesInterests as select columns here
			})
			.from(users)
			.where(
				and(
					inArray(
						users.id,
						recommendedTradeUsersResult.map((u) => u.id),
					),
					requireSomeInterests,
				),
			)
			.leftJoin(speciesInterests, eq(speciesInterests.userId, users.id))
			.leftJoin(genusInterests, eq(genusInterests.userId, users.id))
			.leftJoin(familyInterests, eq(familyInterests.userId, users.id));

		// const { scientificPortions, name: fullName } =
		// 	await taxonomyService.getScientificallySplitName(speciesId);
		return {
			recommendedTradeUserIds: recommendedTradeUsers.map((u) => u.id),
			usersThatHaveItAvailable,
			usersThatWantIt,
			name: { fullName: family.name, scientificPortions: [] },
		};
	}

	public async getTradeDataForGenusForUser(
		genusId: number,
		user: TUser,
	): Promise<TaxonTradeInfo> {
		const userPlants = await plantService.getUserCollection(user.id);
		const plantSpecies = await Promise.all(
			userPlants.map((plant) =>
				this.speciesModel.getById(plant.speciesId, true),
			),
		);
		const userOwnsSpecies = plantSpecies.some(
			(spec) => spec.genusId === genusId,
		);

		const userInterests = await userService.getInterests(user.id);
		const genus = await dbManager.db.query.genera.findFirst({
			where: eq(genera.id, genusId),
		});

		if (!genus) {
			throw new AppError("Unable to find genus");
		}

		const usersThatHaveItAvailable = await dbManager.db
			.selectDistinctOn([users.id], {
				id: users.id,
				username: users.username,
				plantTypesAvailable: sql<
					PlantTypeCol[] | null
				>`CASE WHEN MAX(plants.type) IS NOT NULL THEN 
					array_to_json(
						array_agg(
							distinct plants.type
						)
					) 
				ELSE
					null
				END`.as("plant_types_available"),
			})
			.from(users)
			.groupBy(users.id)
			.innerJoin(
				plants,
				and(eq(plants.userId, users.id), isNull(plants.deletedAt)),
			)
			.innerJoin(tradeablePlants, eq(plants.id, tradeablePlants.plantId))
			.innerJoin(
				species,
				and(eq(species.id, plants.speciesId), eq(species.genusId, genusId)),
			);

		const usersThatWantIt = await dbManager.db
			.selectDistinctOn([users.id], {
				id: users.id,
				username: users.username,
				tradeablePlantsCount: countDistinct(tradeablePlants.plantId),
			})
			.from(users)
			.where(
				and(
					not(eq(users.id, user.id)),
					or(
						eq(genusInterests.genusId, genusId),
						eq(familyInterests.familyId, genus.familyId),
					),
					// not(
					// 	exists(
					// 		dbManager.db
					// 			.select({ id: plants.id })
					// 			.from(plants)
					// 			.where(
					// 				and(
					// 					eq(plants.userId, users.id),
					// 					eq(plants.speciesId, speciesId),
					// 				),
					// 			)
					// 			.limit(1),
					// 	),
					// ),
				),
			)
			.innerJoin(
				plants,
				and(eq(plants.userId, users.id), isNull(plants.deletedAt)),
			)
			// .innerJoin(
			// 	species,
			// 	and(eq(species.id, plants.speciesId), eq(species.genusId, genusId)),
			// )
			.innerJoin(tradeablePlants, eq(tradeablePlants.plantId, plants.id))
			.leftJoin(speciesInterests, eq(speciesInterests.userId, users.id))
			.leftJoin(genusInterests, eq(genusInterests.userId, users.id))
			.leftJoin(familyInterests, eq(familyInterests.userId, users.id))
			.groupBy(users.id);

		const recommendedTradeUsersResult = userOwnsSpecies
			? usersThatWantIt
			: usersThatHaveItAvailable;

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

		const recommendedTradeUsers = await dbManager.db
			.select({
				id: users.id,

				// select matching interest to taxon. so we have matchingFamilyInterests, matchingGenusInterests, matchingSpeciesInterests as select columns here
			})
			.from(users)
			.where(
				and(
					inArray(
						users.id,
						recommendedTradeUsersResult.map((u) => u.id),
					),
					requireSomeInterests,
				),
			)
			.leftJoin(speciesInterests, eq(speciesInterests.userId, users.id))
			.leftJoin(genusInterests, eq(genusInterests.userId, users.id))
			.leftJoin(familyInterests, eq(familyInterests.userId, users.id));

		// const { scientificPortions, name: fullName } =
		// 	await taxonomyService.getScientificallySplitName(speciesId);
		return {
			recommendedTradeUserIds: recommendedTradeUsers.map((u) => u.id),
			usersThatHaveItAvailable,
			usersThatWantIt,
			name: { fullName: genus.name, scientificPortions: [genus.name] },
		};
	}

	public async getTradeDataForSpeciesForUser(
		speciesId: number,
		user: TUser,
	): Promise<TaxonTradeInfo> {
		// maybe not even needed..
		const userPlants = await plantService.getUserCollection(user.id);
		const userOwnsSpecies = userPlants.some(
			(plant) => plant.speciesId === speciesId,
		);

		const userInterests = await userService.getInterests(user.id);
		const spec = await dbManager.db.query.species.findFirst({
			where: eq(species.id, speciesId),
		});

		if (!spec) {
			throw new AppError("Unable to find species");
		}

		const usersThatHaveItAvailable = await dbManager.db
			.selectDistinctOn([users.id], {
				id: users.id,
				username: users.username,
				plantTypesAvailable: sql<
					PlantTypeCol[] | null
				>`CASE WHEN MAX(plants.type) IS NOT NULL THEN 
					array_to_json(
						array_agg(
							distinct plants.type
						)
					) 
				ELSE
					null
				END`.as("plant_types_available"),
			})
			.from(users)
			.groupBy(users.id)
			.innerJoin(
				plants,
				and(
					eq(plants.userId, users.id),
					eq(plants.speciesId, speciesId),
					isNull(plants.deletedAt),
				),
			)
			.innerJoin(tradeablePlants, eq(plants.id, tradeablePlants.plantId));
		const usersThatWantIt = await dbManager.db
			.selectDistinctOn([users.id], {
				id: users.id,
				username: users.username,
				tradeablePlantsCount: countDistinct(tradeablePlants.plantId),
			})
			.from(users)
			.where(
				and(
					not(eq(users.id, user.id)),
					or(
						eq(speciesInterests.speciesId, speciesId),
						eq(genusInterests.genusId, spec.genusId),
						eq(familyInterests.familyId, spec.familyId),
					),
					not(
						exists(
							dbManager.db
								.select({ id: plants.id })
								.from(plants)
								.where(
									and(
										eq(plants.userId, users.id),
										eq(plants.speciesId, speciesId),
									),
								)
								.limit(1),
						),
					),
				),
			)
			.innerJoin(
				plants,
				and(eq(plants.userId, users.id), isNull(plants.deletedAt)),
			)
			.innerJoin(tradeablePlants, eq(tradeablePlants.plantId, plants.id))
			.leftJoin(speciesInterests, eq(speciesInterests.userId, users.id))
			.leftJoin(genusInterests, eq(genusInterests.userId, users.id))
			.leftJoin(familyInterests, eq(familyInterests.userId, users.id))
			.groupBy(users.id);

		const recommendedTradeUsersResult = userOwnsSpecies
			? usersThatWantIt
			: usersThatHaveItAvailable;

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

		const recommendedTradeUsers = await dbManager.db
			.select({
				id: users.id,

				// select matching interest to taxon. so we have matchingFamilyInterests, matchingGenusInterests, matchingSpeciesInterests as select columns here
			})
			.from(users)
			.where(
				and(
					inArray(
						users.id,
						recommendedTradeUsersResult.map((u) => u.id),
					),
					requireSomeInterests,
				),
			)
			.leftJoin(speciesInterests, eq(speciesInterests.userId, users.id))
			.leftJoin(genusInterests, eq(genusInterests.userId, users.id))
			.leftJoin(familyInterests, eq(familyInterests.userId, users.id));

		const { scientificPortions, name: fullName } =
			await taxonomyService.getScientificallySplitName(speciesId);
		return {
			recommendedTradeUserIds: recommendedTradeUsers.map((u) => u.id),
			usersThatHaveItAvailable,
			usersThatWantIt,
			name: { scientificPortions, fullName },
		};
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
						isNull(plants.deletedAt),
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
		const excludeStatuses = await dbManager.db
			.select({ id: tradeStatusTypes.id })
			.from(tradeStatusTypes)
			.where(
				inArray(tradeStatusTypes.value, [
					"accepted",
					"cancelled",
					"completed",
					"declined",
				]),
			);

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
			.leftJoin(
				plants,
				and(eq(plants.userId, users.id), isNull(plants.deletedAt)),
			)
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
										inArray(
											tradeStatusChanges.statusId,
											excludeStatuses.map((x) => x.id),
										),
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

		await this.updateUsersTradeNotifications([
			user.id,
			suggestion.subjectUserId,
		]);
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

		await this.updateUsersTradeNotifications([
			user.id,
			suggestion.subjectUserId,
		]);
	}

	public async completeTrade(tradeId: number, user: TUser): Promise<void> {
		const accepted = await dbManager.db.query.tradeStatusTypes.findFirst({
			where: eq(tradeStatusTypes.value, "accepted"),
		});
		if (!accepted) {
			throw new AppError("Status not found");
		}
		const trade = await dbManager.db.query.trades.findFirst({
			where: and(
				eq(trades.id, tradeId),
				or(
					eq(trades.receivingUserId, user.id),
					eq(trades.requestingUserId, user.id),
				),
				or(
					not(trades.completedByReceivingUser),
					not(trades.completedByRequestingUser),
				),
			),
			with: {
				suggestions: {
					orderBy: [desc(tradeSuggestions.createdAt)],
					with: {
						suggestionPlants: {
							with: {
								plant: true,
							},
						},
					},
					limit: 1,
					where: isNotNull(tradeSuggestions.acceptedAt),
				},
			},
		});
		if (
			!trade ||
			!trade.suggestions.length ||
			!trade.suggestions[0]?.suggestionPlants
		) {
			throw new AppError("Not found", 404);
		}
		const completed = await dbManager.db.query.tradeStatusTypes.findFirst({
			where: eq(tradeStatusTypes.value, "completed"),
		});
		if (!completed) {
			throw new AppError("Status not found");
		}
		await dbManager.db.transaction(async (trx) => {
			await trx
				.insert(tradeStatusChanges)
				.values({ tradeId, statusId: completed.id });

			await trx
				.update(trades)
				.set({ statusId: completed.id })
				.where(eq(trades.id, tradeId));

			const finalSuggestion = trade.suggestions[0];
			if (!finalSuggestion) {
				throw new AppError("suggestion missing");
			}

			const { requestingUserId, receivingUserId } = trade;
			const inserts: InferInsertModel<typeof plants>[] = [];

			for (const { plant } of finalSuggestion.suggestionPlants) {
				const newUserId =
					plant.userId === requestingUserId
						? receivingUserId
						: requestingUserId;
				const plantArgs: InferInsertModel<typeof plants> = {
					userId: newUserId,
					speciesId: plant.speciesId,
					type: plant.type,
				};
				inserts.push(plantArgs);
			}

			await trx.insert(plants).values(inserts);
		});
	}

	public async cancelTrade(tradeId: number, user: TUser): Promise<void> {
		const trade = await dbManager.db.query.trades.findFirst({
			where: and(
				eq(trades.id, tradeId),
				or(
					eq(trades.receivingUserId, user.id),
					eq(trades.requestingUserId, user.id),
				),
			),
		});
		if (!trade) {
			throw new AppError("Not found", 404);
		}

		const cancelledStatus = await dbManager.db.query.tradeStatusTypes.findFirst(
			{ where: eq(tradeStatusTypes.value, "cancelled") },
		);
		if (!cancelledStatus) {
			throw new AppError("Status not found", 404);
		}
		await dbManager.db.transaction(async (trx) => {
			await trx
				.insert(tradeStatusChanges)
				.values({ tradeId, statusId: cancelledStatus.id });
			await trx.update(trades).set({ statusId: cancelledStatus.id });
		});
	}

	public async getTradeData(
		tradeId: number,
		user: TUser,
	): Promise<
		TTrade & {
			suggestions: HydratedTradeSuggestion[];
			statusHistory: TradeStatusChange[];
		}
	> {
		const trade = await dbManager.db.query.trades.findFirst({
			where: and(
				eq(trades.id, tradeId),
				or(
					eq(trades.receivingUserId, user.id),
					eq(trades.requestingUserId, user.id),
				),
			),
			with: {
				statusHistory: {
					with: {
						statusType: true,
					},
					orderBy: desc(tradeStatusChanges.changedAt),
				},
				statusType: true,
				suggestions: {
					orderBy: [desc(tradeSuggestions.createdAt)],
					with: {
						suggestionPlants: true,
					},
				},
			},
		});
		if (!trade) {
			throw new AppError("Could not find trade", 404);
		}

		const suggestions: (TradeSuggestion & {
			suggestionPlants: CollectedPlant[];
		})[] = [];

		let i = 0;
		for (const suggestion of trade.suggestions) {
			const hydratedPlants = await Promise.all(
				suggestion.suggestionPlants.map(async (p) => {
					const plant = await dbManager.db.query.plants.findFirst({
						where: eq(plants.id, p.plantId),
					});
					if (!plant) {
						throw new AppError("missing plant?!");
					}

					return plantService.getCollectedPlant(plant, user.id);
				}),
			);

			suggestions[i] = {
				...trade.suggestions[i],
				suggestionPlants: hydratedPlants,
			} as TradeSuggestion & {
				suggestionPlants: CollectedPlant[];
			};
			i++;
		}
		return { ...trade, suggestions };
	}

	public async tradeCleanup(
		tradeId: number,
		plantIds: number[],
		user: TUser,
	): Promise<void> {
		await dbManager.db.transaction(async (trx) => {
			const trade = await this.tradeModel.getById(tradeId, true);
			if (![trade.requestingUserId, trade.receivingUserId].includes(user.id)) {
				throw new AppError("Not found", 404);
			}
			if (plantIds.length) {
				await Promise.all(
					plantIds.map((id) => {
						return plantService.deletePlant(id, user);
					}),
				);
			}

			const col =
				trade.receivingUserId === user.id
					? "completedByReceivingUser"
					: "completedByRequestingUser";
			await dbManager.db
				.update(trades)
				.set({ [col]: true })
				.where(eq(trades.id, tradeId));
		});
	}

	public async sendTradeMessage(
		tradeId: number,
		content: string,
		senderUser: TUser,
		suggestionId?: number,
	): Promise<TTradeMessage> {
		/**
		 * @todo
		 * - how to handle syncing client to server
		 * (websockets...? polling...?) i think websockets is almost the best way to do it honestly?
		 *
		 *
		 */
		const trade = await dbManager.db.query.trades.findFirst({
			where: and(
				eq(trades.id, tradeId),
				or(
					eq(trades.receivingUserId, senderUser.id),
					eq(trades.requestingUserId, senderUser.id),
				),
			),
			with: {
				suggestions: true,
			},
		});

		if (!trade) {
			throw new AppError("Not found", 404);
		}

		if (suggestionId) {
			const suggestion = trade.suggestions.find(
				(suggestion) => suggestion.id === suggestionId,
			);
			if (!suggestion) {
				throw new AppError("Trade suggestion not found", 404);
			}
		}

		const recipientUserId =
			trade.receivingUserId === senderUser.id
				? trade.requestingUserId
				: trade.receivingUserId;
		const [message, ..._] = await dbManager.db
			.insert(tradeMessages)
			.values({
				recipientUserId,
				senderUserId: senderUser.id,
				content,
				type: "text",
				tradeId,
				suggestionId,
			})
			.returning();

		if (!message) {
			throw new AppError("Unknown error occured while creating message", 500);
		}

		await this.updateUserTradeMessageNotifications(message.recipientUserId);
		return message;
	}

	public async readMessage(
		messageId: number,
		tradeId: number,
		user: TUser,
	): Promise<void> {
		const trade = await dbManager.db.query.trades.findFirst({
			where: and(
				eq(trades.id, tradeId),
				or(
					eq(trades.receivingUserId, user.id),
					eq(trades.requestingUserId, user.id),
				),
			),
			with: {
				messages: {
					where: and(
						eq(tradeMessages.id, messageId),
						eq(tradeMessages.recipientUserId, user.id),
					),
				},
			},
		});

		if (!trade) {
			throw new AppError("Trade not found", 404);
		}

		const [message] = trade.messages;
		if (!message) {
			throw new AppError("Message not found", 404);
		}

		await dbManager.db
			.update(tradeMessages)
			.set({ readAt: new Date() })
			.where(eq(tradeMessages.id, messageId));
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
	completedByUser: boolean;
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

export type HydratedTradeSuggestion = TradeSuggestion & {
	suggestionPlants: CollectedPlant[];
};

export interface TradeStatusChange {
	id: number;
	changedAt: Date;
	statusType: TradeStatus;
}

export interface TaxonTradeInfo {
	recommendedTradeUserIds: number[];
	usersThatHaveItAvailable: {
		id: number;
		username: string | null;
		plantTypesAvailable: PlantTypeCol[] | null;
	}[];
	usersThatWantIt: {
		id: number;
		username: string | null;
		tradeablePlantsCount: number;
	}[];
	name: { fullName: string; scientificPortions: string[] };
}
