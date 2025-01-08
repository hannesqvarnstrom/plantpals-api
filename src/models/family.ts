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
import { families } from "../db/schema";
import { PlantTypeCol } from "../services/plant";
import { AppError } from "../utils/errors";

export type RawFamily = InferSelectModel<typeof families>;
export type TFamilyCreateArgs = InferInsertModel<typeof families>;
export type TFamily = RawFamily;

export default class FamilyModel {
	constructor() {}

	public static factory(params: RawFamily): TFamily {
		const { id, name, gbifKey, vernacularNames, createdAt } = params;
		return { id, name, gbifKey, vernacularNames, createdAt };
	}

	public async create(args: TFamilyCreateArgs): Promise<TFamily> {
		const query = dbManager.db
			.insert(families)
			.values(args)
			.returning()
			.prepare("createFamily" + new Date().getTime());

		const [result, ..._] = await query.execute();
		if (!result) {
			throw new AppError("Something went wrong while creating family", 400);
		}

		return result;
	}

	public async getById<B extends boolean = true>(
		id: number,
		require: B,
	): Promise<TFamily>;
	public async getById(id: number): Promise<TFamily | undefined>;
	public async getById<B extends boolean = false>(id: number, require?: B) {
		const query = dbManager.db
			.select()
			.from(families)
			.where(eq(families.id, id))
			.prepare("getByFamilyId" + new Date().getTime());

		const [result, ..._] = await query.execute();

		if (result) {
			const plant = FamilyModel.factory(result);
			return plant;
		}
		if (require) throw new AppError("family not found", 404);
		return undefined;
	}
}
