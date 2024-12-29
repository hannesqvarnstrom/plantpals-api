import fixSpeciesRanks from "./commands/fix-species-ranks";
import initSpeciesNames from "./commands/init-speciesnames";
import {
	scrapeAllBase,
	scrapeFamilyDataAll,
	scrapeFamilyNames,
	scrapeFamilySpecific,
} from "./scrape-families";

function run(scriptName: string, otherArgs?: string[]) {
	if (!scriptName) {
		throw new Error("argument for script name is required");
	}

	console.log("scriptName:", scriptName);
	switch (scriptName) {
		case "scrape-family-names":
			scrapeFamilyNames();
			break;
		case "scrape-family-all":
			scrapeFamilyDataAll();
			break;
		case "scrape-family":
			if (!otherArgs || !otherArgs.length) {
				throw new Error("specific family name needed");
			}
			console.log("otherArgs:", otherArgs);
			scrapeFamilySpecific(otherArgs[0] as string);
			break;
		case "scrape-genera-species-all":
			scrapeAllBase();
			break;
		case "init-species-names":
			initSpeciesNames();
			break;
		case "fix-species-ranks": {
			if (!otherArgs || !otherArgs.length) {
				throw new Error("specific family name needed");
			}
			const start: number = Number.parseInt(otherArgs[0] as string);

			fixSpeciesRanks(start);
			break;
		}
		default:
			throw new Error(`script name not recognized:${scriptName}`);
	}
}

run(process.argv[2] as string, process.argv.slice(3, process.argv.length));
