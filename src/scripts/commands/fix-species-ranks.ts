/**
 * 
 * GET 'https://api.gbif.org/v1/species/6306650/name' (species/:gbifKey/name)
 * -> 
 * {
  "key": 1639991,
  "scientificName": "Brassica oleracea subsp. oleracea",
  "type": "SCIENTIFIC",
  "genusOrAbove": "Brassica",
  "specificEpithet": "oleracea",
  "infraSpecificEpithet": "oleracea",
  "parsed": true,
  "parsedPartially": false,
  "canonicalName": "Brassica oleracea oleracea",
  "canonicalNameWithMarker": "Brassica oleracea subsp. oleracea",
  "canonicalNameComplete": "Brassica oleracea subsp. oleracea",
  "rankMarker": "subsp."
}

if hybrid -> canonicalNameWithMarker will have the speciesname beginning with an x
and the regular canonicalName will not have this.
can use the diff to tell


if variety:
{
  "key": 1640362,
  "scientificName": "Brassica oleracea var. oleracea",
  "type": "SCIENTIFIC",
  "genusOrAbove": "Brassica",
  "specificEpithet": "oleracea",
  "infraSpecificEpithet": "oleracea",
  "parsed": true,
  "parsedPartially": false,
  "canonicalName": "Brassica oleracea oleracea",
  "canonicalNameWithMarker": "Brassica oleracea var. oleracea",
  "canonicalNameComplete": "Brassica oleracea var. oleracea",
  "rankMarker": "var."
}

same as hybrid or subsp. -> can use the diff between ..WithMarker and regular canonicalName to parse out the logic
 */

/**
 * for each species in the db
 * if ranked cultivar / cross -> continue
 *
 * get name data from gbif
 * parse whether it is a hybrid, variant, ssp or something weird
 * if its a hybrid, format the name and speciesname (?) correctly
 * if its a variant, format the name and speciesname correctly
 * if its a ssp, format the name and speciesname correctly
 *
 * save the species as the correct rank.
 *
 */

/**
 *
 * family
 * genus
 *      species
 *          ssp
 *              var
 *              cultivar
 *          var
 *              cultivar
 *          cultivar
 *      cultivar
 *
 * everything under genus can be cross
 *
 *
 * species:
 *      genusname speciesname
 *      cross = genusname speciesname x ?
 *
 * genus cultivar:
 *      genusname cultivarname
 *      cross = genusname cultivarname x ?
 *
 * ssp 1:
 *  genusname speciesname ssp. ssp_name
 *  cross: genusname speciesname ssp. ssp_name x ?
 *  var:
 *      genusname speciesname ssp. ssp_name var var_name
 *      cross: genusname speciesname ssp. ssp_name var var_name x ?
 *  cultivar:
 *      genusname speciesname ssp. ssp_name 'cultivarname'
 *      cross:
 *          genusname speciesname ssp. ssp_name 'cultivarname' x ?
 *
 *
 * name =
 * genusname (always) + cross ? (not the same species ? mother's speciesname : nothing) + cultivarname (if exists?) x same thing for father?
 *  however, when calculating nested names, use parenthesis for hybridizations.
 *
 *
 * speciesName=
 * om species, artepitet som vanligt
 * om cultivar, ärver species name från förälder
 * om hybrid, (förälders speciesname eller cultivarname x förälders speciesname eller cultivarname)
 *vilket innebär att nested hybrider blir (A x B) x ((C x D) x E)
 * men... om man använder en cultivar som förälder borde det blir något strul?
 * och hur blir det i fall av subsp och eller var?
 *
 *
 */

import { eq, isNotNull } from "drizzle-orm";
import dbManager from "../../db";
import { species } from "../../db/schema";
import type { TSpecies } from "../../models/species";
import { AppError } from "../../utils/errors";
import { makeRequest } from "../scrape-families";

// run locally at 19 dec 2024
export default async function fixSpeciesRanks(start: number) {
	const speciesAll = await dbManager.db
		.select()
		.from(species)
		.where(isNotNull(species.gbifKey))
		// .limit(start + 10000)
		.orderBy(species.id)
		.execute();
	const chunkSize = 6;
	for (let i = start; i < speciesAll.length; i += chunkSize) {
		const chunk = speciesAll.slice(i, i + chunkSize);
		await Promise.all(
			chunk.map(async (s, j) => {
				console.log(`parsing number ${i + j} / ${speciesAll.length}`);
				const url = `https://api.gbif.org/v1/species/${s.gbifKey}/name`;
				const response = await makeRequest.get<NameResponse>(url);
				// console.log(response.data);
				const nameData = response.data;
				if (isSpecies(nameData)) {
					// console.log("skipping species");
					// console.log("SKIPPING", nameData);

					return Promise.resolve();
				}
				let name = s.name;
				let speciesName = s.speciesName;
				let marker = "";
				let rank = s.rank;

				let offset = 0;
				const hybrid = isHybrid(nameData);

				if (hybrid) {
					marker = "×";
					const parts = nameData.canonicalName.split(" ");
					parts.splice(1, 0, marker);
					name = parts.join(" ");
					speciesName = parts.slice(1).join(" ");
					offset = 1;
					// rank = "HYBRID";
				}

				const nameToReadFrom = hybrid ? name : nameData.canonicalName;

				// @todo
				// if isHybrid, use the hybrid name data as well / instead of the canonicalName
				if (isSubSpecies(nameData)) {
					marker = "ssp.";
					// const parts = nameData.canonicalName.split(" ");
					const parts = nameToReadFrom.split(" ");
					parts.splice(2 + offset, 0, marker);
					name = parts.join(" ");
					speciesName = parts.slice(1).join(" ");
					rank = "SUBSPECIES";
				} else if (isVariety(nameData)) {
					marker = "var.";
					const parts = nameToReadFrom.split(" ");
					parts.splice(2 + offset, 0, marker);
					name = parts.join(" ");
					speciesName = parts.slice(1).join(" ");
					rank = "VARIETY";
				}
				// if (name === s.name && speciesName === s.speciesName) {
				// 	return Promise.resolve();
				// }
				console.log("updating", {
					name,
					speciesName,
					rank,
					originalName: s.name,
					originalSpeciesName: s.speciesName,
					originalRank: s.rank,
				});
				// console.log("actually not updating right now. @todo");

				await dbManager.db
					.update(species)
					.set({ name, speciesName, rank })
					.where(eq(species.id, s.id));
			}),
		);
	}

	console.log("done!");

	process.exit(0);
}

function isSpecies(data: NameResponse): boolean {
	return (
		data.canonicalName === data.canonicalNameWithMarker &&
		data.rankMarker === "sp."
	);
}

function isHybrid(data: NameResponse): boolean {
	const { canonicalName, canonicalNameWithMarker } = data;
	const speciesName = canonicalName.split(" ")[1];
	const secondSpeciesName = canonicalNameWithMarker.split(" ")[1];
	if (speciesName && secondSpeciesName) {
		// console.log("speciesName:", speciesName[0]);
		// console.log("secondSpeciesName:", secondSpeciesName[0]);

		if (
			(speciesName[0] !== "×" && secondSpeciesName[0] === "×") ||
			(speciesName[0] !== "x" && secondSpeciesName[0] === "x")
		) {
			return true;
		}
	}
	return false;
}

function isSubSpecies({ canonicalNameWithMarker }: NameResponse): boolean {
	const expectedSspMarker = canonicalNameWithMarker.split(" ")[2];

	if (expectedSspMarker?.match(/subsp\.|ssp\./)) {
		return true;
	}
	return false;
}

function isVariety({ canonicalNameWithMarker }: NameResponse): boolean {
	const expectedVarMarker = canonicalNameWithMarker.split(" ")[2];

	if (expectedVarMarker?.match(/var\.|v\./)) {
		return true;
	}
	return false;
}

interface NameResponse {
	key: number;
	scientificName: string;
	genusOrAbove: string;
	specificEpithet: string;
	authorship: string;
	parsed: boolean;
	parsedPartially: boolean;
	canonicalName: string;
	canonicalNameWithMarker: string;
	canonicalNameComplete: string;
	rankMarker: string;
}
