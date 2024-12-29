import {
	InferColumnsDataTypes,
	type InferInsertModel,
	type InferSelectModel,
	and,
	between,
	eq,
	inArray,
	sql,
} from "drizzle-orm";
import dbManager from "../db";
import { species, userSpeciesSubmissions, users } from "../db/schema";
import { PlantTypeCol } from "../services/plant";
import { AppError } from "../utils/errors";

export type RawSpecies = InferSelectModel<typeof species>;
export type TSpeciesCreateArgs = InferInsertModel<typeof species>;
export type TSpecies = RawSpecies;

// export interface ShallowPlant {
//     name: string
//     {
//         genusName: string;
//         speciesName?: string;
//         varietyName?: string;
//         name1a?: {
//             species: boolean;
//             name: string;
//         };
//         name1b?: {
//             species: boolean;
//             name: string;
//         };

//         name2a?: {
//             species: boolean;
//             name: string;
//         };

//         name2b?: {
//             species: boolean;
//             name: string;
//         };
//     },
//     fromTrader?: number | null,
//     location?: string,
//     type?: PlantTypeCol,
//     image?: string,
//     fontSize: string
//     // ETC
// }

// export interface DeepPlant extends ShallowPlant {
//     id: string,
// }

export default class SpeciesModel {
	public static factory(params: RawSpecies): TSpecies {
		const {
			id,
			name,
			gbifKey,
			vernacularNames,
			familyId,
			genusId,
			gbifGenusKey,
			gbifFamilyKey,
			rank,
			userSubmitted,
			parentSpeciesId,
			speciesName,
			cultivarName,
			crossMomId,
			crossDadId,
			createdAt,
		} = params;
		return {
			id,
			name,
			gbifKey,
			vernacularNames,
			familyId,
			genusId,
			speciesName,
			cultivarName,
			crossMomId,
			crossDadId,
			gbifGenusKey,
			gbifFamilyKey,
			rank,
			userSubmitted,
			parentSpeciesId,
			createdAt,
		};
	}

	public async create(args: TSpeciesCreateArgs): Promise<TSpecies> {
		const query = dbManager.db
			.insert(species)
			.values(args)
			.returning()
			.prepare(`createSpecies${new Date().getTime()}`);

		const [result, ..._] = await query.execute();
		if (!result) {
			throw new AppError("Something went wrong while creating species", 400);
		}

		return result;
	}

	public async getById<B extends boolean = true>(
		id: number,
		require: B,
	): Promise<TSpecies>;
	public async getById(id: number): Promise<TSpecies | undefined>;
	public async getById<B extends boolean = false>(id: number, require?: B) {
		const query = dbManager.db.select().from(species).where(eq(species.id, id));

		const [result, ..._] = await query.execute();

		if (result) {
			const plant = SpeciesModel.factory(result);
			return plant;
		}
		if (require) throw new AppError("Species not found", 404);
		return undefined;
	}

	public async getByUserId(userId: number): Promise<TSpecies[]> {
		const [user, ..._] = await dbManager.db
			.select()
			.from(users)
			.where(eq(users.id, userId))
			.execute();
		if (!user) {
			throw new AppError("missing user", 404);
		}
		const submissions: { speciesId: number }[] = await dbManager.db
			.select({ speciesId: userSpeciesSubmissions.speciesId })
			.from(userSpeciesSubmissions)
			.rightJoin(
				userSpeciesSubmissions,
				eq(userSpeciesSubmissions.userId, userId),
			)
			.execute();
		const userSpecies = await dbManager.db
			.select()
			.from(species)
			.where(
				inArray(
					species.id,
					submissions.map((x) => x.speciesId),
				),
			)
			.execute();
		return userSpecies;
	}

	/**
	 * @fråga LLM om hur man bäst strukturerar relations queries
	 */

	//     public async update(id: number, { name, fontSize, fromTrader, location, type }: Partial<InferInsertModel<typeof plants>>): Promise<TPlant> {
	//         const updateObject: Partial<InferInsertModel<typeof plants>> = {}
	//         if (name) updateObject.name = name
	//         if (fontSize) updateObject.fontSize = fontSize
	//         if (fromTrader || fromTrader === null) updateObject.fromTrader = fromTrader
	//         if (location || location === '' || location === null) updateObject.location = location
	//         if (type) updateObject.type = type

	//         const query = dbManager.db.update(plants)
	//             .set(updateObject)
	//             .where(eq(plants.id, id))
	//             .returning()
	//             .prepare('updatePlant' + new Date().getTime())

	//         const [result, ..._] = await query.execute()

	//         if (!result) {
	//             throw new AppError('Plant not found', 404)
	//         }
	//         return result
	//     }
	// }
}
