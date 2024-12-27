import { and, eq, ilike, inArray, not, or, sql } from "drizzle-orm";
import type { z } from "zod";
import dbManager from "../db";
import {
	families,
	genera,
	plants,
	species,
	speciesInterests,
	tradeablePlants,
	users,
} from "../db/schema";
import FamilyModel, { type TFamily } from "../models/family";
import GenusModel, { type TGenus } from "../models/genus";
import SpeciesModel, {
	type RawSpecies,
	type TSpecies,
	type TSpeciesCreateArgs,
} from "../models/species";
import type { TUser } from "../models/user";
import UserSpeciesSubmissionModel, {
	type TUserSpeciesSubmission,
} from "../models/user-species-submissions";
import type {
	getNamePreviewSchema,
	postSpeciesSubmissionSchema,
	speciesSearchSchema,
} from "../routes/schemas";
import { AppError } from "../utils/errors";
import plantService, {
	type CollectedPlant,
	type PerfectMatchTrade,
	PossibleTrades,
} from "./plant";
import userService from "./user";

type SearchArguments = z.infer<typeof speciesSearchSchema>;

class TaxonomyService {
	speciesModel: SpeciesModel;
	genusModel: GenusModel;
	familyModel: FamilyModel;
	speciesSubmissionModel: UserSpeciesSubmissionModel;

	constructor() {
		this.speciesModel = new SpeciesModel();
		this.genusModel = new GenusModel();
		this.familyModel = new FamilyModel();
		this.speciesSubmissionModel = new UserSpeciesSubmissionModel();
	}

	public async search({
		q,
		page,
		familyId,
		genusId,
		speciesId,
		onlyAccepted,
		excludeRank,
	}: SearchArguments): Promise<RawSpecies[]> {
		const query = `%${q}%`;
		const speciesQuery = await dbManager.db
			.selectDistinctOn([species.id])
			.from(species)
			.where(
				excludeRank
					? and(ilike(species.name, query), not(eq(species.rank, excludeRank)))
					: ilike(species.name, query) || ilike(species.vernacularNames, query),
			)
			.limit(30)
			.offset(page ? page * 30 : 0);
		// .query.species.findMany({
		//     where: (species) => ilike(species.name, query) || ilike(species.vernacularNames, query)
		// })

		// if (familyId) {
		//     speciesQuery
		// }

		console.log("speciesQuery:", speciesQuery);

		return speciesQuery;
	}

	public async hydratedGenusSearch(
		{
			q,
			page,
			familyId,
			onlyAccepted,
		}: Omit<SearchArguments, "genusId" | "speciesId">,
		userId?: number,
	): Promise<HydratedGenusSearchResult[]> {
		const query = `%${q}%`;
		const results = await dbManager.db
			.selectDistinctOn([genera.id], {
				id: genera.id,
				name: genera.name,
				familyId: genera.familyId,
				familyName: families.name,
			})

			.from(genera)
			.where(ilike(genera.name, query))
			.innerJoin(families, eq(families.id, genera.familyId))
			.execute();

		return results;
	}
	public async hydratedSearch(
		{
			q,
			page,
			familyId,
			genusId,
			speciesId,
			onlyAccepted,
			excludeRank,
		}: SearchArguments,
		userId?: number,
	): Promise<HydratedSpeciesSearchResult[]> {
		const searchTerms = q.toLowerCase().trim().split(/\s+/);

		// Create individual ILIKE conditions for each term
		const searchConditions = searchTerms.map((term) => {
			const termQuery = `%${term === "x" ? "×" : term}%`;
			return or(
				// Search in the main name
				ilike(species.name, termQuery),
				// Search in vernacular names
				// ilike(species.vernacularNames, termQuery),
				sql`EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements_text(${species.vernacularNames}) as vname
                    WHERE vname ILIKE ${termQuery}
                )`,
				// Search in cultivar name
				ilike(species.cultivarName, termQuery),
				// Search in genus name
				ilike(genera.name, termQuery),
			);
		});

		// Combine all conditions with AND to ensure all terms are found
		const searchWhere = and(...searchConditions);
		const finalWhere = excludeRank
			? and(searchWhere, not(eq(species.rank, excludeRank)))
			: searchWhere;

		const results = await dbManager.db
			.selectDistinctOn([species.id], {
				id: plants.id,
				speciesId: species.id,
				type: plants.type,
				name: species.name,
				genusId: species.genusId,
				familyId: species.familyId,
				gbifKey: species.gbifKey,
				gbifFamilyKey: species.gbifFamilyKey,
				gbifGenusKey: species.gbifGenusKey,
				vernacularNames: species.vernacularNames,
				rank: species.rank,
				collectedByUser: userId
					? sql<boolean>`${userId} in (${plants.userId})`
					: sql<boolean>`false`,
				createdAt: species.createdAt,
				speciesName: species.speciesName,
				cultivarName: species.cultivarName,
				crossMomId: species.crossMomId,
				crossDadId: species.crossDadId,
				parentSpeciesId: species.parentSpeciesId,
				userSubmitted: species.userSubmitted,
				genusName: genera.name,
				familyName: families.name,
				openForTrade: sql<boolean>`(${tradeablePlants.id}) IS NOT NULL`,
			})
			.from(species)
			.leftJoin(plants, eq(plants.speciesId, species.id))
			.leftJoin(tradeablePlants, eq(tradeablePlants.plantId, plants.id))
			.innerJoin(genera, eq(species.genusId, genera.id))
			.innerJoin(families, eq(species.familyId, families.id))
			.where(finalWhere)
			.limit(30)
			.offset(page ? page * 30 : 0);

		const mappedResults: HydratedSpeciesSearchResult[] = [];
		for (const item of results) {
			const nameData = await this.getScientificallySplitName(item.speciesId);
			mappedResults.push({
				...item,
				fullName: nameData.name,
				scientificPortions: nameData.scientificPortions,
			});
		}
		return mappedResults;
	}

	public async setNewInterest(speciesId: number, user: TUser): Promise<void> {
		const [interestSpecies, ..._] = await dbManager.db
			.select({
				id: species.id,
				interested: sql<boolean>`(${speciesInterests.id}) IS NOT NULL`,
			})
			.from(species)
			.where(eq(species.id, speciesId))
			.leftJoin(
				speciesInterests,
				and(
					eq(speciesInterests.speciesId, speciesId),
					eq(speciesInterests.userId, user.id),
				),
			);

		if (!interestSpecies) {
			throw new AppError("species not found", 404);
		}

		if (interestSpecies.interested) {
			return;
		}

		const [createResult, ..._2] = await dbManager.db
			.insert(speciesInterests)
			.values({ speciesId, userId: user.id })
			.returning();

		if (!createResult) {
			throw new AppError("unable to make create interest");
		}
	}

	public async removeInterest(speciesId: number, user: TUser): Promise<void> {
		const [interestSpecies, ..._] = await dbManager.db
			.select({
				id: species.id,
				interested: sql<boolean>`(${speciesInterests.id}) IS NOT NULL`,
				interestId: speciesInterests.id,
			})
			.from(species)
			.where(eq(species.id, speciesId))
			.leftJoin(
				speciesInterests,
				and(
					eq(speciesInterests.speciesId, speciesId),
					eq(speciesInterests.userId, user.id),
				),
			);

		if (!interestSpecies) {
			throw new AppError("species not found", 404);
		}

		if (!interestSpecies.interested || !interestSpecies.interestId) {
			return;
		}

		const [createResult, ..._2] = await dbManager.db
			.delete(speciesInterests)
			.where(eq(speciesInterests.id, interestSpecies.interestId))
			.returning();

		if (!createResult) {
			throw new AppError("unable to make delete interest");
		}
	}

	// public async getPossibleTradesForUser(speciesId: number, user: TUser): Promise<PossibleTrades> {
	public async getPossibleTradesForUser(
		speciesId: number,
		user: TUser,
	): Promise<PerfectMatchTrade[]> {
		const [plant, ..._] = await dbManager.db
			.select()
			.from(plants)
			.where(and(eq(plants.speciesId, speciesId), eq(plants.userId, user.id)));

		if (!plant) {
			throw new AppError("plant does not exist for user", 404);
		}

		const requestingUserInterests = await userService.getInterests(user.id);

		const perfectMatchQuery = dbManager.db
			.select({
				id: plants.id,
				speciesId: species.id,
				userId: users.id,
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
				userSubmitted: species.userSubmitted,
				genusName: genera.name,
				familyName: families.name,
				type: plants.type,
			})
			.from(plants)
			.innerJoin(species, eq(species.id, plants.speciesId))
			.innerJoin(genera, eq(species.genusId, genera.id))
			.innerJoin(families, eq(species.familyId, families.id))
			.innerJoin(tradeablePlants, eq(tradeablePlants.plantId, plants.id))
			.innerJoin(users, eq(users.id, plants.userId))
			.innerJoin(speciesInterests, eq(speciesInterests.userId, users.id))
			.where(
				and(
					inArray(
						plants.speciesId,
						requestingUserInterests.species.map(
							(interest) => interest.speciesId,
						),
					),
					eq(speciesInterests.speciesId, speciesId),
				),
			)
			.prepare("perfectMatchQuery1");

		const perfectMatches = await perfectMatchQuery.execute();
		const perfectMatchTrades: PerfectMatchTrade[] = [];
		for (const matchPlant of perfectMatches) {
			const obj: PerfectMatchTrade = {
				requestingUser: user,
				requestingUsersPlant: await plantService.getCollectedPlant(
					plant,
					user.id,
				),
				receivingUser: await userService.getById(matchPlant.userId),
				receivingUsersPlant: await plantService.getCollectedPlant(
					matchPlant,
					user.id,
				),
			};
			perfectMatchTrades.push(obj);
		}

		return perfectMatchTrades;
	}

	// public async getPossibleTradesForUserToGetSpecies(speciesId: number, user: TUser): Promise<PossibleTrades> {
	public async getPossibleTradesForUserToGetSpecies(
		speciesId: number,
		user: TUser,
	): Promise<PerfectMatchTrade[]> {
		const userPlants = await plantService.getUserCollection(user.id);
		const perfectMatchQuery = dbManager.db
			.select({
				id: plants.id,
				speciesId: species.id,
				userId: users.id,
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
				userSubmitted: species.userSubmitted,
				matchingInterestSpeciesId: speciesInterests.speciesId,
				genusName: genera.name,
				familyName: families.name,
				type: plants.type,
			})
			.from(plants)
			.innerJoin(species, eq(species.id, plants.speciesId))
			.innerJoin(genera, eq(species.genusId, genera.id))
			.innerJoin(families, eq(species.familyId, families.id))
			.innerJoin(tradeablePlants, eq(tradeablePlants.plantId, plants.id))
			.innerJoin(users, eq(users.id, plants.userId))
			.innerJoin(speciesInterests, eq(speciesInterests.userId, users.id))
			.where(
				and(
					eq(plants.speciesId, speciesId),
					inArray(
						speciesInterests.speciesId,
						userPlants.map((plant) => plant.speciesId),
					),
				),
			)
			.prepare("perfectMatchQuery2");

		const perfectMatches = await perfectMatchQuery.execute();

		const perfectMatchTrades: PerfectMatchTrade[] = [];
		for (const matchPlant of perfectMatches) {
			const requestingUserPlantId = matchPlant.matchingInterestSpeciesId;
			const [plant, ..._] = await dbManager.db
				.select()
				.from(plants)
				.where(
					and(
						eq(plants.speciesId, requestingUserPlantId),
						eq(plants.userId, user.id),
					),
				);
			if (!plant) {
				console.error("could not locate matching plant for trading user");
				continue;
			}
			const obj: PerfectMatchTrade = {
				requestingUser: user,
				requestingUsersPlant: await plantService.getCollectedPlant(
					plant,
					user.id,
				),
				receivingUser: await userService.getById(matchPlant.userId),
				receivingUsersPlant: await plantService.getCollectedPlant(
					matchPlant,
					user.id,
				),
			};
			perfectMatchTrades.push(obj);
		}

		return perfectMatchTrades;
	}

	public async getFullSpeciesName(speciesId: number): Promise<string> {
		const species = await this.speciesModel.getById(speciesId);
		if (!species) {
			throw new Error(`cant find species with id ${speciesId}`);
		}
		let name = "";
		if (species.rank === "SPECIES") {
			name = species.name; // genus + speciesName
		} else if (species.rank === "CULTIVAR") {
			const parentTaxon = species.parentSpeciesId
				? await this.speciesModel.getById(species.parentSpeciesId)
				: await this.genusModel.getById(species.genusId);

			const parentName = species.parentSpeciesId
				? await this.getFullSpeciesName(species.parentSpeciesId)
				: parentTaxon?.name;
			if (!species.cultivarName) {
				throw new AppError("species cultivar name must be defined");
			}

			name = `${parentName} '${capitalizeFirstLetterInWords(
				species.cultivarName,
			)}'`;
		} else if (species.rank === "CROSS") {
			const { crossMomId, crossDadId } = species;
			if (!crossMomId || !crossDadId) {
				throw new Error(`cant find parents for cross with id ${species.id}`);
			}

			const mom = await this.speciesModel.getById(crossMomId);
			const dad = await this.speciesModel.getById(crossDadId);

			const genus = await this.genusModel.getById(species.genusId);

			const valid =
				mom &&
				dad &&
				genus &&
				mom.genusId === dad.genusId &&
				mom.genusId === genus.id;
			if (!valid) {
				throw new Error(
					`wrong structure for cross parents for species with id ${species.id}`,
				);
			}

			const momName = getCrossParentName(mom);
			const dadName = getCrossParentName(dad);

			name = `${genus.name} ${momName} × ${dadName}`;
		} else {
			/**
			 * @todo things left
			 * - subspecies
			 * - varieties
			 * - intergeneric hybrids
			 */
			name = species.name;
		}
		return name;
	}

	public async createSpeciesSubmission(
		args: Zod.infer<typeof postSpeciesSubmissionSchema>,
		user: TUser,
	): Promise<{ newSpecies: TSpecies; submission: TUserSpeciesSubmission }> {
		console.log("args:", args);
		const { valid, reason } = await this.validateSpeciesSubmission(args);
		if (!valid) {
			throw new AppError(reason, 400);
		}
		const speciesCreateArgs: TSpeciesCreateArgs =
			await this.getSpeciesSubmissionData(args);
		const newSpecies = await this.speciesModel.create(speciesCreateArgs);
		const submission = await this.speciesSubmissionModel.create({
			userId: user.id,
			speciesId: newSpecies.id,
		});
		return { newSpecies, submission };
	}

	private async validateSpeciesSubmission({
		submissionType,
		closestTaxonomicParent,
		closestTaxonomicParentType,
		crossMomId,
		crossDadId,
		name,
	}: Zod.infer<typeof postSpeciesSubmissionSchema>): Promise<
		{ valid: false; reason: string } | { valid: true; reason: null }
	> {
		switch (submissionType) {
			case "species": {
				if (!closestTaxonomicParent) {
					throw new AppError("closest taxonomic parent is required");
				}
				// expect closest taxonomic parent to be a genus
				const parentGenus = await this.genusModel.getById(
					closestTaxonomicParent,
				);
				if (!parentGenus) {
					throw new AppError("closest parent must be a genus", 400);
				}
				if (!name) {
					throw new AppError("species name must be supplied");
				}
				// require name
				break;
			}
			case "cultivar": {
				if (!closestTaxonomicParent) {
					throw new AppError("closest taxonomic parent is required");
				}
				if (!closestTaxonomicParentType) {
					throw new AppError("closest taxonomic parent type is required");
				}

				const parent =
					closestTaxonomicParentType === "species"
						? await this.speciesModel.getById(closestTaxonomicParent)
						: await this.genusModel.getById(closestTaxonomicParent);

				if (!parent) {
					throw new AppError("closest parent must exist", 400);
				}
				if (!name) {
					throw new AppError("cultivar name must be supplied", 400);
				}
				// expect closest taxonomic parent to be a species or genus
				// if parent == species, expect species to have species rank and not cultivar
				// require name

				if (
					closestTaxonomicParentType === "species" &&
					(parent as TSpecies).rank === "CROSS"
				) {
					throw new AppError("cultivar parent must not be a cross");
				}
				break;
			}

			// @note / todo
			// add subspecies adding here. parent = species.
			// subspecies should have a column sub_species_name?
			// when rendered,add ssp. between parent name and subspecies name

			case "cross": {
				if (!crossMomId || !crossDadId) {
					throw new AppError(
						"both parents must be supplied to create a cross",
						400,
					);
				}
				const momSpecies = await this.speciesModel.getById(crossMomId);
				const dadSpecies = await this.speciesModel.getById(crossDadId);

				if (!momSpecies || !dadSpecies) {
					throw new AppError("both parents must exist to create a cross", 400);
				}

				if (momSpecies.genusId !== dadSpecies.genusId) {
					throw new AppError(
						"both parents must be within the selected genus",
						400,
					);
				}

				if (name) {
					throw new AppError(
						"name must not be supplied while creating a cross",
						400,
					);
				}
				// expect cross parents to be species within a genus
				// NO NAME ACCEPTED
				break;
			}

			// @note this should be in a 'create genus' function.
			// and then it can become a parent in other steps instead
			// case "intergeneric_cross":
			// expect cross parents to be genera within a family
			//
			// break
			default:
				return {
					valid: false,
					reason: `Invalid submission type: ${submissionType}`,
				};
		}

		return { valid: true, reason: null };
	}

	private async getSpeciesSubmissionData(
		args: Zod.infer<typeof postSpeciesSubmissionSchema>,
	): Promise<TSpeciesCreateArgs> {
		let name = "";
		let speciesName = "";
		let cultivarName = "";
		let parentSpeciesId: number | undefined = undefined;
		let genusId: number | undefined = undefined;
		let familyId: number | undefined = undefined;
		let crossMomId: number | undefined = undefined;
		let crossDadId: number | undefined = undefined;

		switch (args.submissionType) {
			case "species": {
				if (!args.closestTaxonomicParent) {
					throw new AppError("closest parent must be set for species");
				}

				const closestParentGenus = await this.genusModel.getById(
					args.closestTaxonomicParent,
				);
				if (!closestParentGenus) {
					throw new AppError("closest parent cannot be found");
				}
				speciesName = args.name as string;
				name = `${closestParentGenus.name} ${speciesName}`;
				genusId = closestParentGenus.id;
				familyId = closestParentGenus.familyId;
				break;
			}
			case "cultivar": {
				if (!args.closestTaxonomicParent) {
					throw new AppError("closest parent must be set for cultivar");
				}
				if (!args.closestTaxonomicParentType) {
					throw new AppError("closest parent type must be set for cultivar");
				}

				const closestParent =
					args.closestTaxonomicParentType === "genus"
						? await this.genusModel.getById(args.closestTaxonomicParent)
						: await this.speciesModel.getById(args.closestTaxonomicParent);

				if (!closestParent) {
					throw new AppError("closest parent cannot be found");
				}
				cultivarName = args.name as string;
				speciesName = (closestParent as TSpecies).speciesName as string;
				if (args.closestTaxonomicParentType === "species") {
					parentSpeciesId = closestParent.id;
				}

				genusId =
					args.closestTaxonomicParentType === "species"
						? (closestParent as TSpecies).genusId
						: closestParent.id;
				familyId = (closestParent as TSpecies).familyId;

				let root = "";
				if (args.closestTaxonomicParentType === "genus") {
					root = closestParent.name;
				} else {
					root = await this.getFullSpeciesName(closestParent.id);
				}
				name = `${root} '${capitalizeFirstLetterInWords(cultivarName)}'`;
				break;
			}
			case "cross": {
				crossMomId = args.crossMomId as number;
				crossDadId = args.crossDadId as number;
				const mom = await this.speciesModel.getById(crossMomId);
				const dad = await this.speciesModel.getById(crossDadId);
				if (!mom || !dad) {
					throw new AppError("mom and dad are required");
				}

				genusId = mom.genusId;
				const genus = await this.genusModel.getById(genusId);
				if (!genus) {
					throw new AppError("could not find genus", 400);
				}

				const momName = getCrossParentName(mom);
				const dadName = getCrossParentName(dad);

				familyId = genus.familyId;
				name = `${genus.name} ${momName} × ${dadName}`;
				speciesName = `(${momName} × ${dadName})`;
				break;
			}
			default:
				throw new AppError("invalid submission type");
		}

		// @todo EXPAND THIS TO ALL RANKS?!
		const rank =
			args.submissionType === "cultivar"
				? "CULTIVAR"
				: args.submissionType === "cross"
					? "CROSS"
					: "SPECIES";
		return {
			name,
			speciesName,
			userSubmitted: true,
			genusId,
			parentSpeciesId,
			crossDadId,
			crossMomId,
			cultivarName,
			rank,
			familyId,
		};
	}

	public async getNamePreview(
		args: z.infer<typeof getNamePreviewSchema>,
	): Promise<{ name: string; scientificPortions: string[] }> {
		let name = "";
		switch (args.submissionType) {
			case "species": {
				if (!args.closestTaxonomicParent) {
					throw new AppError("closest parent must be set for species");
				}
				if (!args.name) {
					throw new AppError("name is required");
				}

				const closestParentGenus = await this.genusModel.getById(
					args.closestTaxonomicParent,
				);
				name = `${closestParentGenus?.name} ${args.name}`;
				// scientificPortions.push(closestParentGenus!.name, args.name)
				break;
			}
			case "cross": {
				if (!args.crossMomId || !args.crossDadId) {
					throw new AppError("cross mom and dad are required");
				}
				const mom = await this.speciesModel.getById(args.crossMomId);
				const dad = await this.speciesModel.getById(args.crossDadId);
				if (!mom || !dad) {
					throw new AppError("couldnt get mom or dad");
				}
				const genus = await this.genusModel.getById(mom?.genusId);

				if (mom?.genusId !== dad?.genusId) {
					throw new AppError("cross parents must share a genus", 400);
				}

				const momName = getCrossParentName(mom);
				const dadName = getCrossParentName(dad);

				name = `${genus?.name} ${momName} × ${dadName}`;
				break;
			}
			case "cultivar": {
				if (!args.closestTaxonomicParent) {
					throw new AppError("closest parent must be set for cultivar");
				}
				if (!args.closestTaxonomicParentType) {
					throw new AppError("closest parent type must be set for cultivar");
				}

				const closestParent =
					args.closestTaxonomicParentType === "genus"
						? await this.genusModel.getById(args.closestTaxonomicParent)
						: await this.speciesModel.getById(args.closestTaxonomicParent);

				if (!closestParent) {
					throw new AppError("closest parent cannot be found");
				}
				const cultivarName = args.name as string;

				let root = "";
				if (args.closestTaxonomicParentType === "genus") {
					root = closestParent.name;
				} else {
					root = await this.getFullSpeciesName(closestParent.id);
				}

				name = `${root} '${capitalizeFirstLetterInWords(cultivarName)}'`;
				break;
			}
			default:
				throw new AppError("unreachable case");
		}

		return { name, scientificPortions: getScientificPartsOfName(name) };
	}

	public async getScientificallySplitName(
		speciesId: number,
	): Promise<{ name: string; scientificPortions: string[] }> {
		const fullName = await this.getFullSpeciesName(speciesId);

		const scientificPortions = getScientificPartsOfName(fullName);
		return { name: fullName, scientificPortions };
	}

	public async getClassification(
		taxonId: number,
		taxonType: "species" | "genus" | "family",
	): Promise<Classification> {
		let family: TFamily | undefined = undefined;
		let genus: TGenus | undefined = undefined;
		const classification: Classification = [];

		if (taxonType === "family") {
			family = await this.familyModel.getById(taxonId);
			if (!family) {
				throw new AppError("starting taxon not found");
			}
			return [
				{
					type: "family",
					id: family.id,
					name: family.name,
					scientificPortions: [],
				},
			];
		}
		const taxon =
			taxonType === "genus"
				? await this.genusModel.getById(taxonId)
				: await this.speciesModel.getById(taxonId);
		if (!taxon) {
			throw new AppError("starting taxon not found");
		}
		if (taxonType === "genus") {
			genus = taxon as TGenus;
		} else {
			genus = await this.genusModel.getById((taxon as TSpecies).genusId);
		}

		family = await this.familyModel.getById(taxon.familyId);
		if (!family) {
			throw new AppError("family not found");
		}
		classification.push({
			type: "family",
			id: family.id,
			name: family.name,
			scientificPortions: [],
		});
		if (!genus) {
			throw new AppError("genus not found");
		}
		// const classification: Classification = {
		// 	family: { type: "family", id: family.id, name: family.name },
		// 	genus: { type: "genus", id: genus.id, name: genus.name },
		// };
		classification.push({
			type: "genus",
			id: genus.id,
			name: genus.name,
			scientificPortions: [genus.name],
		});
		if (taxonType === "genus") {
			return classification;
		}

		const spec: TSpecies = taxon as TSpecies;
		if (spec.rank === "CROSS") {
			const { scientificPortions } = await this.getScientificallySplitName(
				spec.id,
			);
			classification.push({
				type: "species",
				name: spec.name,
				id: spec.id,
				rank: spec.rank,
				scientificPortions,
			});
			return classification;
		}

		if (spec.rank === "SPECIES") {
			const { scientificPortions } = await this.getScientificallySplitName(
				spec.id,
			);
			classification.push({
				type: "species",
				name: spec.name,
				id: spec.id,
				rank: spec.rank,
				scientificPortions: scientificPortions,
			});
			return classification;
		}

		const parentSpeciesList = await this.getParentSpeciesList(spec);
		parentSpeciesList.reverse();

		classification.push(...parentSpeciesList);
		return classification;
	}
	// public async getImmediateFamily(taxonId: number, taxonType: 'species' | 'genus' | 'family'): Promise<ImmediateFamily> {

	// }
	private async getParentSpeciesList(
		spec: TSpecies,
		list: AbbreviatedTaxon[] = [],
	): Promise<AbbreviatedTaxon[]> {
		if (!spec.parentSpeciesId) {
			return list;
		}
		const parent = await this.speciesModel.getById(spec.parentSpeciesId);
		if (!parent) {
			throw new AppError(`cannot find parent for species ${spec.id}`);
		}
		const { scientificPortions } = await this.getScientificallySplitName(
			parent.id,
		);

		list.push({
			type: "species",
			name: parent.name,
			id: parent.id,
			rank: parent.rank as AbbreviatedTaxon["rank"],
			scientificPortions,
		});
		return this.getParentSpeciesList(parent, list);
	}
}

interface AbbreviatedTaxon {
	type: "family" | "genus" | "species";
	id: number;
	name: string;
	rank?: "CROSS" | "SPECIES" | "VARIETY" | "SUBSPECIES" | "CULTIVAR";
	scientificPortions: string[];
}
type Classification = AbbreviatedTaxon[];

// interface Classification {
// 	family: AbbreviatedTaxon;
// 	genus?: AbbreviatedTaxon;
// 	species?: AbbreviatedTaxon;
// 	subSpecies?: AbbreviatedTaxon;
// 	variety?: AbbreviatedTaxon;
// 	cross?: AbbreviatedTaxon;
// 	cultivar?: AbbreviatedTaxon;
// }

type Taxon = TSpecies | TGenus | TFamily;
// interface ImmediateFamily {
// 	self: Taxon
// 	siblings: Taxon[]
// 	parents: Taxon[]
// 	children: Taxon[]
// }

function capitalizeFirstLetterInWords(s: string): string {
	return s
		.split("")
		.map((x, i, arr) => (i === 0 || arr[i - 1] === " " ? x.toUpperCase() : x))
		.join("");
}

const taxonomyService = new TaxonomyService();
export default taxonomyService;

export type HydratedSpeciesSearchResult = Omit<CollectedPlant, "id"> & {
	id: number | null;
};

export interface HydratedGenusSearchResult {
	name: string;
	id: number;
	familyId: number;
	familyName: string;
}

function getScientificPartsOfName(name: string): string[] {
	const splitName = name.split(/\s+(?=(?:[^']*'[^']*')*[^']*$)/);
	const scientificPortions: string[] = [];
	for (let substr of splitName) {
		substr = substr.replace(/\(|\)/g, "");
		console.log("substr", substr);
		const isScientific =
			!substr.startsWith("'") && !substr.endsWith("'") && substr !== "×";
		if (isScientific) {
			scientificPortions.push(substr);
		}
	}

	return scientificPortions;
}

function getCrossParentName(species?: TSpecies): string {
	if (!species) {
		throw new AppError("species not defined");
	}
	let name = "";
	const { speciesName, cultivarName } = species;
	if (speciesName) {
		name = speciesName;
	}
	if (cultivarName) {
		name += ` '${capitalizeFirstLetterInWords(cultivarName)}'`;
	}
	if (!name) {
		throw new AppError(
			`cross parent name not defined for species with id: ${species.id}`,
		);
	}
	return name;
}
