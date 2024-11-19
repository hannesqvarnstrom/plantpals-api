import { InferInsertModel } from "drizzle-orm";
import PlantModel, { ShallowPlant } from "../models/plant";
import { TPlant, TPlantCreateArgs } from "../models/plant";
import UserModel, { TUser } from "../models/user";
import { plants } from "../db/schema";
// import TraderModel from "../models/trader";
import { AppError } from "../utils/errors";

class PlantService {
    model: PlantModel;
    userModel: UserModel;
    //     traderModel: TraderModel;

    constructor() {
        this.model = new PlantModel();
        this.userModel = new UserModel();
        // this.traderModel = new TraderModel()
    }

    //     /**
    //      * @param user The id of the user whose ratings to get
    //      * @returns
    //      */
    //     public async getByUser(userId: number): Promise<TPlant[]>;
    //     /**
    //      * @param user The user whose ratings to get
    //      * @returns
    //      */
    //     public async getByUser(user: TUser): Promise<TPlant[]>;
    //     public async getByUser(user: TUser | number): Promise<TPlant[]> {
    //         let userId: number;
    //         if (typeof user === "number") {
    //             userId = user;
    //         } else {
    //             userId = user.id;
    //         }
    //         const ratings = await this.model.getByUserId(userId);
    //         return ratings;
    //     }

    public async getById(id: string): Promise<TPlant> {
        const plant = await this.model.getById(Number(id), true);
        return plant;
    }

    //     /**
    //      * @param args The payload to create a new plant
    //      * @returns the newly created plant
    //      */
    //     public async createPlant(args: TPlantCreateArgs): Promise<TPlant> {
    //         if (args.fromTrader) {
    //             const trader = await this.traderModel.getById(args.fromTrader);
    //             if (trader?.createdBy !== args.userId) {
    //                 throw new AppError("Trader userId and userId mismatch");
    //             }
    //         }

    //         const newRating = await this.model.create(args);
    //         return newRating;
    //     }

    //     public async updatePlant(
    //         id: string,
    //         plantUpdateArgs: PlantUpdateArgs
    //     ): Promise<TPlant> {
    //         const newPlant = await this.model.update(Number(id), plantUpdateArgs);
    //         return newPlant;
    //     }
    // }
    // // function fillWithDefaultValues(name: ShallowPlant['name']) {
    // //     const {name1a, name1b, name2a, name2b} = name
    // // }
    // const plantService = new PlantService();
    // export default plantService;
}
export type PlantTypeCol = "cutting" | "seed" | "rhizome" | 'none' | 'plant';
// export interface PlantUpdateArgs {
//     name?: ShallowPlant["name"];
//     fontSize?: string;
//     location?: string | null;
//     fromTrader?: number | null;
//     type?: PlantTypeCol;
// }