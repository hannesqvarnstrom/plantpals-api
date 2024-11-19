import { InferInsertModel } from "drizzle-orm";
import { z } from "zod";
// import { plants } from "../../db/schema";

// import { MAX_RATING_VALUE } from "../../models/mood-rating";


export type SchemaInterface<Schema extends Zod.ZodEffects<Zod.ZodObject<any, any, any, any, any>> | Zod.ZodObject<any, any, any, any, any>> = z.infer<Schema>

/**
 * @todo
 * - query parsing
 * - param parsing
 */

/**
 * @route /login
 * @method POST
 */
export const loginSchema = z.object({
    // body: z.object({
    email: z.string().email('Not a valid email'),
    password: z.string().min(6)
    // })
})

/**
 * @route /users
 * @method POST
 */
export const registerSchema = z.object({
    // body: z.object({
    email: z.string().email('Not a valid email'),
    password: z.string().min(6),
    passwordConfirmation: z.string().min(6)
    // })
}).superRefine(({ password, passwordConfirmation }, ctx) => {
    // const { } = body
    if (password !== passwordConfirmation) {
        ctx.addIssue({
            code: 'custom',
            message: 'Passwords did not match'
        })
    }
})

/**
 * @route /auth/google
 * @method POST
 */
export const oauthGooglePostSchema = z.object({
    providerToken: z.string()
}).superRefine(({ providerToken }, ctx) => {
    const isValidJwt = providerToken.split('.').length === 3
    if (!isValidJwt) {
        ctx.addIssue({
            code: 'custom',
            message: 'Invalid JWT'
        })
    }
})

/**
 * @route /me
 * @method PUT
 */
export const updateMeSchema = z.object({
    // body: z.object({
    oldPassword: z.string().min(6).optional(),
    newPassword: z.string().min(6).optional(),
    newPasswordConfirmation: z.string().min(6).optional()
    // })
}).superRefine(({ oldPassword, newPassword, newPasswordConfirmation }, ctx) => {
    const issues: z.IssueData[] = []
    // const { oldPassword, newPassword, newPasswordConfirmation } = body

    if (oldPassword) {
        if (!newPassword || !newPasswordConfirmation) {
            issues.push({ code: 'custom', message: 'Missing new replacement password' })
        }
        if (newPassword !== newPasswordConfirmation) {
            issues.push({ code: 'custom', message: 'New password confirmation does not match' })
        }
    } else if (newPassword && newPasswordConfirmation) {
        issues.push({ code: 'custom', message: 'Old password is required to select a new one' })
    }

    for (const issue of issues) {
        ctx.addIssue(issue)
    }
})


// getPlantSchema, 
// const x: InferInsertModel<typeof plants> = {}
// const z: ShallowPlant = {}
export const putPlantSchema = z.object({
    name: z.object({
        genusName: z.string({ required_error: 'Genus name is required' }),
        speciesName: z.string().optional(),
        varietyName: z.string().optional(),
        name1a: z.object({
            species: z.boolean().optional(),
            name: z.string().optional()
        }
        ).optional(),
        name1b: z.object({
            species: z.boolean().optional(),
            name: z.string().optional()
        }
        ).optional(),
        name2a: z.object({
            species: z.boolean().optional(),
            name: z.string().optional()
        }
        ).optional(),
        name2b: z.object({
            species: z.boolean().optional(),
            name: z.string().optional()
        }
        ).optional()
    }).optional().nullable(),
    // userId: z.number(),
    fontSize: z.string().optional(),
    fromTrader: z.string().optional().nullable(),
    type: z.enum(['cutting', 'seed', 'rhizome', 'none']).optional(),
    location: z.string().optional().nullable(),
})

export const postPlantSchema = z.object({
    name: z.object({
        genusName: z.string({ required_error: 'Genus name is required' }),
        speciesName: z.string().optional(),
        varietyName: z.string().optional(),
        name1a: z.object({
            species: z.boolean().optional(),
            name: z.string().optional()
        }
        ).optional(),
        name1b: z.object({
            species: z.boolean().optional(),
            name: z.string().optional()
        }
        ).optional(),
        name2a: z.object({
            species: z.boolean().optional(),
            name: z.string().optional()
        }
        ).optional(),
        name2b: z.object({
            species: z.boolean().optional(),
            name: z.string().optional()
        }
        ).optional()
    }),
    // userId: z.number(),
    fontSize: z.string().optional(),
    fromTrader: z.string().optional().nullable(),
    type: z.enum(['cutting', 'seed', 'rhizome', 'none']),
    location: z.string().nullable().optional(),

})
// export const getPlantSchema = z.object({
// @todo add search filters i guess?
// })

// export const getRatingsQuerySchema = z.object({
//     from: z.string(),
//     to: z.string(),
// })

// export const postRatingSchema = z.object({
//     value: z.number().min(1).max(MAX_RATING_VALUE),
// }).strict()

export const postTraderSchema = z.object({
    name: z.string(),
    location: z.string().optional()
})

export const putTraderSchema = z.object({
    name: z.string(),
    location: z.string().optional()
})