import UserModel, { RawUser, TUser, TUserCreateArgs } from "../models/user";
import { SchemaInterface, updateMeSchema } from "../routes/schemas";
import { AppError } from "../utils/errors";
import { AuthenticationService } from "./authentication";

class UserService {
    model: UserModel

    constructor() {
        this.model = new UserModel()
    }

    public async getById(id: number): Promise<TUser & { logOverdue: boolean }> {
        const user = await this.model.getById(id, true)
        const logOverdue = await this.shouldUserLog(user.id, new Date())
        return { ...user, logOverdue }
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

    public async shouldUserLog(id: number, now: Date): Promise<boolean> {
        const user = await this.model.getRawById(id)
        return this.logOverdue(user, now)
    }

    public logOverdue(user: TUser | RawUser, now: Date): boolean {
        return user.lastLogAt === null || now.toDateString() !== new Date(user.lastLogAt).toDateString()
    }

    /**
     * Updates a user by a certain ID.
     * Second function argument is list of optional parameters. 
     * If updating password, oldPassword + newPassword are required.
     *      - newPasswordConfirmation is available as parameter, but is assumed to be validated at route level
     */
    public async updateById(id: number, { oldPassword, newPassword }: SchemaInterface<typeof updateMeSchema>) {
        const user = await this.model.getRawById(id)

        const payload: UpdateUserPayload = {}
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
}

const userService = new UserService()

export default userService

export interface UpdateUserPayload {
    password?: string
}