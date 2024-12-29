import { eq } from "drizzle-orm";
import dbManager from "../db";
import {
	families,
	familyInterests,
	genera,
	genusInterests,
	species,
	speciesInterests,
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
import type { SchemaInterface, updateMeSchema } from "../routes/schemas";
import { AppError } from "../utils/errors";
import { AuthenticationService } from "./authentication";
import { PlantTypeCol } from "./plant";
import taxonomyService from "./taxonomy";

class UserService {
	model: UserModel;

	constructor() {
		this.model = new UserModel();
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
		{
			oldPassword,
			newPassword,
			username,
		}: SchemaInterface<typeof updateMeSchema>,
	) {
		const user = await this.model.getRawById(id);

		const payload: UpdateUserPayload = { username };
		if (oldPassword) {
			if (!user.password) {
				throw new AppError("User does not use passwords", 400);
			}

			const oldPasswordMatches = await AuthenticationService.compare(
				oldPassword,
				user.password,
			);
			if (!oldPasswordMatches) {
				throw new AppError("Old password seems to be wrong", 400);
			}

			if (!newPassword) {
				throw new AppError("New password is missing entirely", 400);
			}

			const newPasswordHash =
				await AuthenticationService.hashPassword(newPassword);
			payload.password = newPasswordHash;
		}

		const result = await this.model.updateById(id, payload);

		return result;
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
			const { name, scientificPortions } =
				await taxonomyService.getScientificallySplitName(interest.speciesId);

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
