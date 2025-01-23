import {
    type InferInsertModel,
    type InferSelectModel,
    eq,
} from "drizzle-orm";
import dbManager from "../db/index";
import { speciesScientificNames, } from "../db/schema";
import { AppError } from "../utils/errors";

export type RawSpeciesScientificName = InferSelectModel<typeof speciesScientificNames>;
export type TSpeciesScientificNameCreateArgs = InferInsertModel<typeof speciesScientificNames>;
export type TSpeciesScientificName = RawSpeciesScientificName;


export default class SpeciesScientificNameModel {
    public static factory(params: RawSpeciesScientificName): TSpeciesScientificName {
        const {
            id,
            scientificPortions,
            updatedAt,
            name,
            speciesId
        } = params;
        return {
            id,
            name,
            scientificPortions,
            updatedAt,
            speciesId
        };
    }

    public async create(args: TSpeciesScientificNameCreateArgs): Promise<TSpeciesScientificName> {
        const query = dbManager.db
            .insert(speciesScientificNames)
            .values(args)
            .returning()
            .prepare(`createSpecies${new Date().getTime()}`);

        const [result, ..._] = await query.execute();
        if (!result) {
            throw new AppError("Something went wrong while creating species scientific name", 400);
        }

        return result;
    }

    public async getById<B extends boolean = true>(
        id: number,
        require: B,
    ): Promise<TSpeciesScientificName>;
    public async getById(id: number): Promise<TSpeciesScientificName | undefined>;
    public async getById<B extends boolean = false>(id: number, require?: B) {
        const query = dbManager.db.select().from(speciesScientificNames).where(eq(speciesScientificNames.id, id));

        const [result, ..._] = await query.execute();

        if (result) {
            const plant = SpeciesScientificNameModel.factory(result);
            return plant;
        }
        if (require) throw new AppError("Species sci name not found", 404);
        return undefined;
    }


}
