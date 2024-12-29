import {
	Subquery,
	and,
	desc,
	eq,
	exists,
	inArray,
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
	tradeablePlants,
	trades,
	users,
} from "../db/schema";
import TradeModel, { TTrade, type TTradeCreateArgs } from "../models/trade";
import type { TTradeStatusType } from "../models/trade-status-type";
import UserModel, { type TUser } from "../models/user";
import { AppError } from "../utils/errors";
import plantService from "./plant";
import userService from "./user";

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

	constructor() {
		this.tradeModel = new TradeModel();
		this.userModel = new UserModel();
	}

	public async createTrade(
		args: Omit<TTradeCreateArgs, "statusId" | "receivingUserId">,
	): Promise<Trade> {
		const [status, ..._] = await dbManager.db
			.select()
			.from(tradeStatusTypes)
			.where(eq(tradeStatusTypes.value, TRADE_STATUS_VALUES.pending));
		if (!status) {
			throw new AppError("missing pending status", 500);
		}

		const allUserPlants = await plantService.getByUser(args.requestingUserId);
		const desiredPlant = await plantService.getById(args.plantDesiredId);
		const desiredPlantUpForTrade = await plantService.checkTradability(
			args.plantDesiredId,
		);

		const tradeExists = await dbManager.db
			.select()
			.from(trades)
			.where(
				and(
					eq(trades.requestingUserId, args.requestingUserId),
					eq(trades.receivingUserId, desiredPlant.userId),
					eq(trades.plantDesiredId, desiredPlant.id),
					eq(trades.plantOfferedId, args.plantOfferedId),
				),
			)
			.rightJoin(
				tradeStatusTypes,
				and(
					eq(tradeStatusTypes.id, trades.statusId),
					not(inArray(tradeStatusTypes.value, ["declined", "completed"])),
				),
			);
		const valid =
			!!allUserPlants.find((plant) => plant.id === args.plantOfferedId) &&
			desiredPlantUpForTrade &&
			tradeExists;
		if (!valid) {
			throw new AppError(
				"trade is already active, cannot create new trade",
				400,
			);
		}

		const trade = await this.tradeModel.create({
			...args,
			statusId: status.id,
			receivingUserId: desiredPlant.userId,
		});

		await dbManager.db
			.insert(tradeStatusChanges)
			.values({ tradeId: trade.id, statusId: status.id });

		return { ...trade, status, history: [status] };
	}

	public async checkStatus(tradeId: number): Promise<TTradeStatusType> {
		// const trade = await this.tradeModel.getById(tradeId)
		console.log(dbManager.db.query);
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
	// @todo

	// add column or something which is 'declined_at', if it has been declined recently, dont allow trading..?

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
				.rightJoin(
					tradeStatusTypes,
					eq(tradeStatusTypes.id, tradeStatusChanges.statusId),
				)
				.orderBy(desc(tradeStatusChanges.changedAt));
			if (!status) {
				throw new AppError("couldnt find status for a trade", 500);
			}

			const hydratedTrade: Trade = {
				...trade,
				status,
				history,
			};

			if (hydratedTrade.receivingUserId === userId) {
				if (hydratedTrade.status.value === "pending") {
					trades.inbox.push(hydratedTrade);
				}
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
			.groupBy(users.id, users.username)
			.orderBy(desc(sql`"speciesMatches"`), desc(sql`"otherMatches"`));

		return usersQuery.execute();
	}
}

interface Trades {
	inbox: Trade[];
	inProgress: Trade[];
	history: Trade[];
}

interface Trade {
	id: number;
	receivingUserId: number;
	requestingUserId: number;
	plantDesiredId: number;
	plantOfferedId: number;
	status: TradeStatus;
	history: TradeStatus[];
}

interface TradeStatus {
	id: number;
	name: string;
	value: "pending" | "accepted" | "completed" | "declined" | "cancelled";
}

const tradingService = new TradingService();
export default tradingService;
