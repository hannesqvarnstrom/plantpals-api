import { and, eq, ilike, isNull, not, or } from "drizzle-orm";
import type { z } from "zod";
import dbManager from "../db";
import {
	families,
	familyInterests,
	favouriteUsers,
	genera,
	genusInterests,
	speciesInterests,
	speciesScientificNames,
	tradeMessages,
	users,
} from "../db/schema";
import { TFamily } from "../models/family";
import type { TFamilyInterest } from "../models/family-interest";
import type { TGenusInterest } from "../models/genus-interest";
import type { TSpeciesInterest } from "../models/species-interest";
import UserModel, {
	RawUser,
	type TUser,
	type TUserCreateArgs,
} from "../models/user";
import UserProfileModel, { type TUserProfile } from "../models/user-profile";
import type { SchemaInterface, updateMeSchema, updateProfileSchema } from "../routes/schemas";
import { AppError } from "../utils/errors";
import { AuthenticationService } from "./authentication";
import plantService, { type CollectedPlant } from "./plant";
import taxonomyService from "./taxonomy";

class UserService {
	model: UserModel;
	profileModel: UserProfileModel
	constructor() {
		this.model = new UserModel();
		this.profileModel = new UserProfileModel()
	}

	public async getById(id: number): Promise<TUser> {
		const user = await this.model.getById(id, true);
		return user;
	}

	public async getByEmail(email: string): Promise<TUser | undefined> {
		return this.model.getByEmail(email);
	}

	public async createUser(args: TUserCreateArgs): Promise<TUser> {
		if (args.password) {
			args.password = await AuthenticationService.hashPassword(args.password);
		}

		return this.model.create(args);
	}

	public async getUsersList() {
		return this.model.list({ limit: 50 });
	}

	/**
	 * Updates a user by a certain ID.
	 * Second function argument is list of optional parameters.
	 * If updating password, oldPassword + newPassword are required.
	 *      - newPasswordConfirmation is available as parameter, but is assumed to be validated at route level
	 */
	public async updateById(
		id: number,
		{ password, username }: SchemaInterface<typeof updateMeSchema>,
	) {
		const user = await this.model.getRawById(id);

		const payload: UpdateUserPayload = { username };
		if (password) {
			const newPasswordHash =
				await AuthenticationService.hashPassword(password);
			payload.password = newPasswordHash;
		}

		const result = await this.model.updateById(id, payload);

		return result;
	}

	public async getTradeablePlants(
		userId: number,
		requestingUserId: number,
	): Promise<CollectedPlant[]> {
		const collection = await plantService.getUserCollection(userId)

		return collection.filter(p => p.openForTrade);
	}

	public async getInterests(userId: number): Promise<{
		species: SpeciesInterest[];
		genus: GenusInterest[];
		family: FamilyInterest[];
	}> {
		const userSpeciesInterests = await dbManager.db
			.select()
			.from(speciesInterests)
			.where(eq(speciesInterests.userId, userId));
		const mappedInterests: SpeciesInterest[] = [];
		for (const interest of userSpeciesInterests) {
			const [sciName, ..._] = await dbManager.db.select().from(speciesScientificNames).where(eq(speciesScientificNames.speciesId, interest.speciesId))
			if (!sciName) {
				throw new AppError('Missing scientific name for species interest')
			}

			const { name, scientificPortions } = sciName
			mappedInterests.push({ ...interest, fullName: name, scientificPortions });
		}
		const userGenusInterests = await dbManager.db
			.select({
				id: genusInterests.id,
				genusId: genusInterests.genusId,
				fullName: genera.name,
			})
			.from(genusInterests)
			.where(eq(genusInterests.userId, userId))
			.innerJoin(genera, eq(genera.id, genusInterests.genusId));

		const userFamilyInterests = await dbManager.db
			.select({
				id: familyInterests.id,
				familyId: familyInterests.familyId,
				fullName: families.name,
			})
			.from(familyInterests)
			.where(eq(familyInterests.userId, userId))
			.innerJoin(families, eq(families.id, familyInterests.familyId));

		return {
			species: mappedInterests.sort((a, b) =>
				a.fullName.localeCompare(b.fullName),
			),
			genus: userGenusInterests
				.map((interest) => ({
					...interest,
					scientificPortions: [interest.fullName],
				}))
				.sort((a, b) => a.fullName.localeCompare(b.fullName)),
			family: userFamilyInterests
				.map((interest) => ({
					...interest,
					scientificPortions: [],
				}))
				.sort((a, b) => a.fullName.localeCompare(b.fullName)),
		};
	}

	public async getTradeMessages(userId: number) {
		const messages = await dbManager.db.query.tradeMessages.findMany({
			where: and(
				or(
					eq(tradeMessages.recipientUserId, userId),
					eq(tradeMessages.senderUserId, userId),
				),
				isNull(tradeMessages.deletedAt),
			),
			with: {
				suggestion: true,
				sender: true,
			},
		});
		return messages;
	}

	public async getProfileByUserId(userId: number): Promise<TUserProfile | undefined> {
		return this.profileModel.getByUserId(userId)
	}
	public async updateProfile(args: z.infer<typeof updateProfileSchema>, user: TUser): Promise<TUserProfile> {
		const profile = await this.profileModel.getByUserId(user.id)
		if (!profile) {
			return this.profileModel.create({ ...args, userId: user.id })
		}

		return this.profileModel.update(profile, args)
	}

	public async addFavourite(user: TUser, userId: number): Promise<{ id: number, username: string }> {
		const favouriteExists = await dbManager.db.query.favouriteUsers.findFirst({ where: and(eq(favouriteUsers.userId, user.id), eq(favouriteUsers.favouriteUserId, userId)) })
		console.log('favouriteExists:', favouriteExists)
		if (!favouriteExists) {
			await dbManager.db.insert(favouriteUsers).values({ userId: user.id, favouriteUserId: userId })
		}
		const favUser = await this.model.getById(userId, true)
		return { id: favUser.id, username: favUser.username ?? '' }
	}

	public async removeFavourite(user: TUser, userId: number): Promise<void> {
		await dbManager.db.delete(favouriteUsers).where(and(eq(favouriteUsers.userId, user.id), eq(favouriteUsers.favouriteUserId, userId)))
	}

	public async getFavourites(user: TUser): Promise<{ id: number, username: string }[]> {
		const favourites = await dbManager.db.query.favouriteUsers.findMany({ where: eq(favouriteUsers.userId, user.id), with: { favouriteUser: true } })


		return favourites.map(f => ({ id: f.favouriteUserId, username: f.favouriteUser.username ?? '' }))
	}

	public async search({ query }: { query: string }, user: TUser): Promise<{ id: number, username: string }[]> {
		const q = `%${query}%`
		const results = await dbManager.db.query.users.findMany({ where: and(ilike(users.username, q), not(eq(users.id, user.id))) })
		return results.map(user => ({ id: user.id, username: user.username ?? '' }))
	}
}

const userService = new UserService();

export default userService;

export interface UpdateUserPayload {
	password?: string;
	username?: string;
}
export type SpeciesInterest = TSpeciesInterest & {
	fullName: string;
	scientificPortions: string[];
	// type: PlantTypeCol
};

export type GenusInterest = Omit<TGenusInterest, "userId"> & {
	fullName: string;
	scientificPortions: string[];
	// type: PlantTypeCol
};

export type FamilyInterest = Omit<TFamilyInterest, "userId"> & {
	fullName: string;
	scientificPortions: string[];
};
