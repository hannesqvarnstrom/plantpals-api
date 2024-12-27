
import { and, desc, eq, inArray, not, Subquery } from "drizzle-orm";
import dbManager from "../db";
import { trades, tradeStatusChanges, tradeStatusTypes, users } from "../db/schema";
import TradeModel, { TTrade, TTradeCreateArgs } from "../models/trade";
import UserModel, { TUser } from "../models/user";
import { AppError } from "../utils/errors";
import userService from "./user";
import plantService from "./plant";
import { TTradeStatusType } from "../models/trade-status-type";

const TRADE_STATUS_VALUES = {
    pending: 'pending',
    accepted: 'accepted',
    in_transit: 'in_transit',
    completed: 'completed',
    declined: 'declined',
    cancelled: 'cancelled'
} as const
class TradingService {
    tradeModel: TradeModel
    userModel: UserModel

    constructor() {
        this.tradeModel = new TradeModel()
        this.userModel = new UserModel()
    }


    public async createTrade(args: Omit<TTradeCreateArgs, 'statusId' | 'receivingUserId'>): Promise<Trade> {
        const [status, ..._] = await dbManager.db.select().from(tradeStatusTypes).where(eq(tradeStatusTypes.value, TRADE_STATUS_VALUES.pending))
        if (!status) {
            throw new AppError('missing pending status', 500)
        }

        const allUserPlants = await plantService.getByUser(args.requestingUserId)
        const desiredPlant = await plantService.getById(args.plantDesiredId)
        const desiredPlantUpForTrade = await plantService.checkTradability(args.plantDesiredId)



        const tradeExists = await dbManager.db.select().from(trades).where(
            and(
                eq(trades.requestingUserId, args.requestingUserId),
                eq(trades.receivingUserId, desiredPlant.userId),
                eq(trades.plantDesiredId, desiredPlant.id),
                eq(trades.plantOfferedId, args.plantOfferedId),
            )
        )
            .rightJoin(tradeStatusTypes, and(eq(tradeStatusTypes.id, trades.statusId), not(inArray(tradeStatusTypes.value, ['declined', 'completed']))))
        const valid = !!allUserPlants.find(plant => plant.id === args.plantOfferedId) && desiredPlantUpForTrade && tradeExists
        if (!valid) {
            throw new AppError('trade is already active, cannot create new trade', 400)
        }

        const trade = await this.tradeModel.create({ ...args, statusId: status.id, receivingUserId: desiredPlant.userId })

        await dbManager.db.insert(tradeStatusChanges).values({ tradeId: trade.id, statusId: status.id })

        return { ...trade, status, history: [status] }

    }

    public async checkStatus(tradeId: number): Promise<TTradeStatusType> {
        // const trade = await this.tradeModel.getById(tradeId)
        console.log(dbManager.db.query)
        const trade = await dbManager.db.query.trades.findFirst({
            where: eq(trades.id, tradeId),
            with: {
                statusType: true
            }
        })
        if (!trade) {
            throw new AppError('could not find trade')
        }

        return trade.statusType
    }
    // @todo 

    // add column or something which is 'declined_at', if it has been declined recently, dont allow trading..?

    public async getTrades(userId: number): Promise<Trades | undefined> {
        const userTrades = await dbManager.db.query.users.findFirst({
            with: {
                tradesRequestedByUser: true,
                tradesReceivedByUser: true
            },
            where: eq(users.id, userId)
        }).execute()

        const trades: Trades = {
            inbox: [],
            inProgress: [],
            history: [],
        }
        if (!userTrades || !(userTrades.tradesRequestedByUser && userTrades.tradesReceivedByUser)) {
            return
        }
        for (const trade of [...userTrades.tradesRequestedByUser, ...userTrades.tradesReceivedByUser]) {
            const [status, ...history] = await dbManager.db.select({
                id: tradeStatusTypes?.id,
                name: tradeStatusTypes.name,
                value: tradeStatusTypes.value
            }).from(tradeStatusChanges).where(eq(tradeStatusChanges.tradeId, trade.id))
                .rightJoin(tradeStatusTypes, eq(tradeStatusTypes.id, tradeStatusChanges.statusId))
                .orderBy(desc(tradeStatusChanges.changedAt))
            if (!status) {
                throw new AppError('couldnt find status for a trade', 500)
            }

            const hydratedTrade: Trade = {
                ...trade,
                status,
                history
            }

            if (hydratedTrade.receivingUserId === userId) {
                if (hydratedTrade.status.value === 'pending') {
                    trades.inbox.push(hydratedTrade)
                }
            } else if (!['completed', 'declined', 'cancelled'].includes(hydratedTrade.status.value)) {
                trades.inProgress.push(hydratedTrade)
            } else {
                trades.history.push(hydratedTrade)
            }
        }
        return trades
    }
}

interface Trades {
    inbox: Trade[],
    inProgress: Trade[],
    history: Trade[]
}

interface Trade {
    id: number,
    receivingUserId: number
    requestingUserId: number
    plantDesiredId: number
    plantOfferedId: number
    status: TradeStatus
    history: TradeStatus[]
}

interface TradeStatus {
    id: number,
    name: string,
    value: 'pending' | 'accepted' | 'completed' | 'declined' | 'cancelled'
}

const tradingService = new TradingService()
export default tradingService
