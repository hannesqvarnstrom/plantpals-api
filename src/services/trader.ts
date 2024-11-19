
// import UserModel, { TUser } from "../models/user";
// import TraderModel, { TTrader, TTraderCreateArgs } from "../models/trader";

// class TraderService {
//     model: TraderModel
//     userModel: UserModel

//     constructor() {
//         this.model = new TraderModel()
//         this.userModel = new UserModel()
//     }

//     /**
//      * @param user The id of the user whose ratings to get
//      * @returns 
//      */
//     public async getByUser(userId: number): Promise<TTrader[]>
//     /**
//      * @param user The user whose ratings to get
//      * @returns 
//      */
//     public async getByUser(user: TUser): Promise<TTrader[]>
//     public async getByUser(user: TUser | number): Promise<TTrader[]> {
//         let userId: number
//         if (typeof user === 'number') {
//             userId = user
//         } else {
//             userId = user.id
//         }
//         const ratings = await this.model.getByUserId(userId)
//         return ratings
//     }

//     public async getById(id: string): Promise<TTrader> {
//         const trader = await this.model.getById(Number(id), true)
//         return trader
//     }

//     /**
//      * @param args The payload to create a new plant
//      * @returns the newly created plant
//      */
//     public async createTrader(args: TTraderCreateArgs): Promise<TTrader> {
//         const newRating = await this.model.create(args)
//         return newRating
//     }

//     public async updateTrader(id: string, traderUpdateArgs: { name?: string, location?: string }): Promise<TTrader> {
//         const updatedTrader = await this.model.update(Number(id), traderUpdateArgs)
//         return updatedTrader
//     }
// }

// const traderService = new TraderService()
// export default traderService
