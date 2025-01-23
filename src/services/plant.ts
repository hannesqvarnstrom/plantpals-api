
import { and, eq, isNull, sql } from "drizzle-orm";
import dbManager from "../db/index";
import {
	families,
	genera,
	plants,
	species,
	speciesScientificNames,
	tradeablePlants,
} from "../db/schema";
import type { TFamily } from "../models/family";
import type { TGenus } from "../models/genus";
import PlantModel from "../models/plant";
import type { TPlant, TPlantCreateArgs } from "../models/plant";
import SpeciesModel, { type TSpecies } from "../models/species";
import UserModel, { type TUser } from "../models/user";
// import TraderModel from "../models/trader";
import { AppError } from "../utils/errors";
import taxonomyService from "./taxonomy";
import userService from "./user";

export interface CollectedPlant extends TSpecies {
	id: number; // this is plantId
	fullName: string;
	scientificPortions: string[];
	speciesId: number;
	genusName: string;
	familyName: string;
	type: PlantTypeCol;
	createdAt: Date;
	openForTrade: boolean;
	collectedByUser: boolean;
	userId?: number;
}
class PlantService {
	model: PlantModel;
	userModel: UserModel;
	speciesModel: SpeciesModel;

	constructor() {
		this.model = new PlantModel();
		this.userModel = new UserModel();
		this.speciesModel = new SpeciesModel();
	}

	public async getUserCollection(user: TUser | number): Promise<CollectedPlant[]> {
		const userId = typeof user === 'number' ? user : user.id;

		const result = await dbManager.db
			.select({
				id: plants.id,
				name: species.name,
				genusId: species.genusId,
				familyId: species.familyId,
				gbifKey: species.gbifKey,
				gbifFamilyKey: species.gbifFamilyKey,
				gbifGenusKey: species.gbifGenusKey,
				vernacularNames: species.vernacularNames,
				rank: species.rank,
				createdAt: species.createdAt,
				parentSpeciesId: species.parentSpeciesId,
				speciesName: species.speciesName,
				speciesId: species.id,
				cultivarName: species.cultivarName,
				crossMomId: species.crossMomId,
				crossDadId: species.crossDadId,
				userSubmitted: species.userSubmitted,
				genusName: genera.name,
				familyName: families.name,
				openForTrade: sql<boolean>`(${tradeablePlants.id}) IS NOT NULL`,
				fullName: speciesScientificNames.name,
				scientificPortions: speciesScientificNames.scientificPortions,
				type: plants.type,
			})
			.from(plants)
			.leftJoin(tradeablePlants, eq(tradeablePlants.plantId, plants.id))
			.innerJoin(species, eq(species.id, plants.speciesId))
			.innerJoin(speciesScientificNames, eq(species.id, speciesScientificNames.speciesId))
			.innerJoin(genera, eq(species.genusId, genera.id))
			.innerJoin(families, eq(species.familyId, families.id))
			.where(and(eq(plants.userId, userId), isNull(plants.deletedAt)));

		return result.map(plant => ({
			...plant,
			id: plant.id,
			speciesId: plant.speciesId,
			createdAt: plant.createdAt,
			type: plant.type,
			collectedByUser: true,
		}));
	}

	public async makePlantTradeable(plantId: number, user: TUser): Promise<void> {
		const [plant, ..._] = await dbManager.db
			.select({
				id: plants.id,
				tradeable: sql<boolean>`(${tradeablePlants.id}) IS NOT NULL`,
			})
			.from(plants)
			.where(and(eq(plants.userId, user.id), isNull(plants.deletedAt)))
			.leftJoin(tradeablePlants, eq(tradeablePlants.plantId, plantId));

		if (!plant) {
			throw new AppError("plant not found", 404);
		}

		if (plant.tradeable) {
			return;
		}

		const [createResult, ..._2] = await dbManager.db
			.insert(tradeablePlants)
			.values({ plantId, availableFrom: new Date() })
			.returning();

		if (!createResult) {
			throw new AppError("unable to make plant tradeable");
		}
	}

	public async makePlantUntradeable(
		plantId: number,
		user: TUser,
	): Promise<void> {
		const [plant, ..._] = await dbManager.db
			.select({
				id: plants.id,
				tradeable: sql<boolean>`(${tradeablePlants.id}) IS NOT NULL`,
				tradeId: tradeablePlants.id,
			})
			.from(plants)
			.where(and(eq(plants.userId, user.id), isNull(plants.deletedAt)))
			.leftJoin(tradeablePlants, eq(tradeablePlants.plantId, plantId));

		if (!plant) {
			throw new AppError("plant not found", 404);
		}

		if (!plant.tradeable || !plant.tradeId) {
			return;
		}

		const [deleteResult, ..._2] = await dbManager.db
			.delete(tradeablePlants)
			.where(eq(tradeablePlants.id, plant.tradeId))
			.returning();

		if (!deleteResult) {
			throw new AppError("unable to make plant untradeable");
		}
	}

	public async getCollectedPlant(
		plant: Omit<TPlant, "deletedAt">,
		requestingUserId: number,
	): Promise<CollectedPlant> {
		const q = dbManager.db
			.select({
				name: species.name,
				genusId: species.genusId,
				familyId: species.familyId,
				gbifKey: species.gbifKey,
				gbifFamilyKey: species.gbifFamilyKey,
				gbifGenusKey: species.gbifGenusKey,
				vernacularNames: species.vernacularNames,
				rank: species.rank,
				createdAt: species.createdAt,
				parentSpeciesId: species.parentSpeciesId,
				speciesName: species.speciesName,
				cultivarName: species.cultivarName,
				crossMomId: species.crossMomId,
				crossDadId: species.crossDadId,
				userSubmitted: species.userSubmitted,
				genusName: genera.name,
				familyName: families.name,
				openForTrade: sql<boolean>`(${tradeablePlants.id}) IS NOT NULL`,
				fullName: speciesScientificNames.name,
				scientificPortions: speciesScientificNames.scientificPortions,
			})
			.from(species)
			.leftJoin(tradeablePlants, eq(tradeablePlants.plantId, plant.id))
			.innerJoin(speciesScientificNames, eq(species.id, speciesScientificNames.speciesId))
			.innerJoin(genera, eq(species.genusId, genera.id))
			.innerJoin(families, eq(species.familyId, families.id))
			.where(eq(species.id, plant.speciesId));

		const [collectedPlant, ..._] = await q.execute()

		if (!collectedPlant) {
			throw new AppError("species not found", 404);
		}

		return {
			...collectedPlant,
			id: plant.id,
			speciesId: plant.speciesId,
			createdAt: plant.createdAt,
			type: plant.type,
			collectedByUser: plant.userId === requestingUserId,
			userId: plant.userId,
		};
	}

	public async getById(
		id: string | number,
		throwOnMissing?: true,
	): Promise<TPlant>;
	public async getById(
		id: string | number,
		throwOnMissing: false,
	): Promise<TPlant | undefined>;
	public async getById(id: string | number, throwOnMissing = true) {
		return this.model.getById(Number(id), throwOnMissing);
	}
	/**
	 * @param args The payload to create a new plant
	 * @returns the newly created plant
	 */
	public async createPlant(args: TPlantCreateArgs): Promise<TPlant> {
		const [existingWildcardPlantForUser, ..._] = await dbManager.db
			.select({ id: plants.id })
			.from(plants)
			.where(
				and(
					eq(plants.type, "none"),
					eq(plants.userId, args.userId),
					eq(plants.speciesId, args.speciesId),
					isNull(plants.deletedAt),
				),
			);

		if (existingWildcardPlantForUser) {
			await dbManager.db
				.update(plants)
				.set({ deletedAt: new Date() })
				.where(eq(plants.id, existingWildcardPlantForUser.id));
		}

		const newPlant = await this.model.create(args);
		return newPlant;
	}

	public async checkTradability(plantId: number | string): Promise<boolean> {
		const [available, ..._] = await dbManager.db
			.select()
			.from(tradeablePlants)
			.where(
				and(
					eq(tradeablePlants.plantId, Number(plantId)),
					isNull(plants.deletedAt),
				),
			);
		return !!available;
	}

	public async deletePlant(plantId: number, user: TUser): Promise<void> {
		await dbManager.db
			.update(plants)
			.set({ deletedAt: new Date() })
			.where(and(eq(plants.id, plantId), eq(plants.userId, user.id)));
	}
}

const plantService = new PlantService();
export default plantService;
export type PlantTypeCol =
	| "cutting"
	| "seed"
	| "rhizome"
	| "none"
	| "plant"
	| null;

/**
 * The user who is 'seeing' the trade, triggering the trade, getting the trade suggested.
 */
type RequestingUser = TUser;

/**
 * The user who is NOT 'seeing' the trade.
 */
type ReceivingUser = TUser;

/**
 * A perfect match for trading species between two users. Both of the users have a species that the other one wants.
 */
export interface PerfectMatchTrade {
	requestingUser: RequestingUser;
	receivingUser: ReceivingUser;
	requestingUsersPlant: CollectedPlant;
	receivingUsersPlant: CollectedPlant;
}

/**
 * A decent match, when a user wants a species but the available trades are not interesting on a species level, e.g. genus / family
 */
export interface DecentMatchTrade {
	requestingUser: RequestingUser;
	receivingUser: ReceivingUser;
	requestingUsersPlant: CollectedPlant;
	receivingUsersPlant: CollectedPlant;
	reason: {
		taxonomy_interest: TGenus | TFamily;
		type: "GENUS" | "FAMILY";
	};
}

/**
 * When a match is possible, cause the requesting user has something the receiving user wants, but the receiving user plant is not available for trade.
 */
export interface MaybePotentialTrade {
	requestingUser: RequestingUser;
	receivingUser: ReceivingUser;
	requestingUsersPlant: CollectedPlant;
	receivingUsersPlant: CollectedPlant;
}

/**
 * A poor match, but still some kind of match. A user has the species the requesting user wants, but no match was made as to what the requesting user has.
 */
export interface UnlikelyTrade {
	requestingUser: RequestingUser;
	receivingUser: ReceivingUser;
	receivingUserPlant: CollectedPlant;
}

export type PossibleTrades = {
	perfectMatches: PerfectMatchTrade[];
	decentMatches: DecentMatchTrade[];
	unlikelyMatches: UnlikelyTrade[];
};
