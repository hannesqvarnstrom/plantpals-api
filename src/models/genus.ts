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
import { genera } from "../db/schema";
import { PlantTypeCol } from "../services/plant";
import { AppError } from "../utils/errors";

export type RawGenus = InferSelectModel<typeof genera>;
export type TGenusCreateArgs = InferInsertModel<typeof genera>;
export type TGenus = RawGenus;

export default class GenusModel {
	constructor() {}

	public static factory(params: RawGenus): TGenus {
		const {
			id,
			name,
			gbifKey,
			vernacularNames,
			familyId,
			gbifFamilyKey,
			createdAt,
		} = params;
		return {
			id,
			name,
			gbifKey,
			vernacularNames,
			familyId,
			gbifFamilyKey,
			createdAt,
		};
	}

	public async create(args: TGenusCreateArgs): Promise<TGenus> {
		const query = dbManager.db
			.insert(genera)
			.values(args)
			.returning()
			.prepare("createGenus" + new Date().getTime());

		const [result, ..._] = await query.execute();
		if (!result) {
			throw new AppError("Something went wrong while creating genus", 400);
		}

		return result;
	}

	public async getById<B extends boolean = true>(
		id: number,
		require: B,
	): Promise<TGenus>;
	public async getById(id: number): Promise<TGenus | undefined>;
	public async getById<B extends boolean = false>(id: number, require?: B) {
		const query = dbManager.db
			.select()
			.from(genera)
			.where(eq(genera.id, id))
			.prepare("getByGenusId" + new Date().getTime());

		const [result, ..._] = await query.execute();

		if (result) {
			const plant = GenusModel.factory(result);
			return plant;
		}
		if (require) throw new AppError("genus not found", 404);
		return undefined;
	}
}
