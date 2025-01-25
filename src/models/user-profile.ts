
import {
    type InferInsertModel,
    type InferSelectModel,
    eq,
} from "drizzle-orm";
import type { z } from "zod";
import dbManager from "../db/index";
import { userProfiles } from "../db/schema";
import type { updateProfileSchema } from "../routes/schemas";
import { AppError } from "../utils/errors";

export type RawUserProfile = InferSelectModel<typeof userProfiles>;
export type TUserProfileCreateArgs = InferInsertModel<
    typeof userProfiles
>;
export type TUserProfile = RawUserProfile;

export default class UserProfileModel {
    public static factory(params: RawUserProfile): TUserProfile {
        const { id, bio, userId, country, city, preferredTradeMethod, tradesByPost, tradesInPerson } = params;
        return { id, bio, userId, country, city, preferredTradeMethod, tradesByPost, tradesInPerson };
    }

    public async create(
        args: TUserProfileCreateArgs,
    ): Promise<TUserProfile> {
        const query = dbManager.db
            .insert(userProfiles)
            .values(args)
            .returning()
            .prepare(`createUserProfile${new Date().getTime()}`);

        const [result, ..._] = await query.execute();
        console.log('result:', result)
        if (!result) {
            throw new AppError(
                "Something went wrong while creating user profile",
                400,
            );
        }

        return result;
    }

    public async getById<B extends boolean = true>(
        id: number,
        require: B,
    ): Promise<TUserProfile>;
    public async getById(id: number): Promise<TUserProfile | undefined>;
    public async getById<B extends boolean = false>(id: number, require?: B) {
        const query = dbManager.db
            .select()
            .from(userProfiles)
            .where(eq(userProfiles.id, id))
            .prepare(`getByUserProfileId${new Date().getTime()}`);

        const [result, ..._] = await query.execute();

        if (result) {
            const plant = UserProfileModel.factory(result);
            return plant;
        }
        if (require) throw new AppError("User profile not found", 404);
        return undefined;
    }

    public async getByUserId<B extends boolean = true>(
        userId: number,
        require: B,
    ): Promise<TUserProfile>;
    public async getByUserId(userId: number): Promise<TUserProfile | undefined>;
    public async getByUserId<B extends boolean = false>(userId: number, require?: B) {
        const profile = await dbManager.db.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userId) })
        if (profile) {
            return profile
        }
        if (require) throw new AppError('Could not find user profile', 404)
        return undefined
    }

    public async update(profile: TUserProfile, args: z.infer<typeof updateProfileSchema>): Promise<TUserProfile> {
        const [updatedProfile, ..._] = await dbManager.db.update(userProfiles).set(args).where(eq(userProfiles.id, profile.id)).returning()
        if (!updatedProfile) {
            throw new AppError('Something went wrong while updating profile', 500)
        }
        return updatedProfile
    }
}
