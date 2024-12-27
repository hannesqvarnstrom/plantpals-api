import { eq } from "drizzle-orm";
import dbManager from "../db";
import { familyInterests, genusInterests, species, speciesInterests } from "../db/schema";
import UserModel, { RawUser, TUser, TUserCreateArgs } from "../models/user";
import { SchemaInterface, updateMeSchema } from "../routes/schemas";
import { AppError } from "../utils/errors";
import { AuthenticationService } from "./authentication";
import { TSpeciesInterest } from "../models/species-interest";
import { TGenusInterest } from "../models/genus-interest";
import { TFamilyInterest } from "../models/family-interest";
import { PlantTypeCol } from "./plant";
import taxonomyService from "./taxonomy";

class UserService {
    model: UserModel

    constructor() {
        this.model = new UserModel()
    }

    public async getById(id: number): Promise<TUser> {
        const user = await this.model.getById(id, true)
        return user
    }

    public async getByEmail(email: string): Promise<TUser | undefined> {
        return this.model.getByEmail(email)
    }

    public async createUser(args: TUserCreateArgs): Promise<TUser> {
        if (args.password) {
            args.password = await AuthenticationService.hashPassword(args.password)
        }

        return this.model.create(args)
    }

    public async getUsersList() {
        return this.model.list({ limit: 50 })
    }

    /**
     * Updates a user by a certain ID.
     * Second function argument is list of optional parameters. 
     * If updating password, oldPassword + newPassword are required.
     *      - newPasswordConfirmation is available as parameter, but is assumed to be validated at route level
     */
    public async updateById(id: number, { oldPassword, newPassword, username }: SchemaInterface<typeof updateMeSchema>) {
        const user = await this.model.getRawById(id)

        const payload: UpdateUserPayload = { username }
        if (oldPassword) {
            if (!user.password) {
                throw new AppError('User does not use passwords', 400)
            }

            const oldPasswordMatches = await AuthenticationService.compare(oldPassword, user.password)
            if (!oldPasswordMatches) {
                throw new AppError('Old password seems to be wrong', 400)
            }

            if (!newPassword) {
                throw new AppError('New password is missing entirely', 400)
            }

            const newPasswordHash = await AuthenticationService.hashPassword(newPassword)
            payload.password = newPasswordHash
        }



        const result = await this.model.updateById(id, payload)

        return result

    }

    public async getInterests(userId: number): Promise<{
        species: SpeciesInterest[],
        genera: TGenusInterest[],
        families: TFamilyInterest[],
    }> {
        const userSpeciesInterests = await dbManager.db.select().from(speciesInterests).where(eq(speciesInterests.userId, userId))
        const mappedInterests: SpeciesInterest[] = []
        for (const interest of userSpeciesInterests) {
            const { name, scientificPortions } = await taxonomyService.getScientificallySplitName(interest.speciesId)

            mappedInterests.push({ ...interest, fullName: name, scientificPortions })
        }
        const userGenusInterests = await dbManager.db.select().from(genusInterests).where(eq(genusInterests.userId, userId))

        const userFamilyInterests = await dbManager.db.select().from(familyInterests).where(eq(familyInterests.userId, userId))

        return { species: mappedInterests, genera: userGenusInterests, families: userFamilyInterests }
    }
}

const userService = new UserService()

export default userService

export interface UpdateUserPayload {
    password?: string
    username?: string
}
export type SpeciesInterest = TSpeciesInterest & {
    fullName: string
    scientificPortions: string[]
    // type: PlantTypeCol
}