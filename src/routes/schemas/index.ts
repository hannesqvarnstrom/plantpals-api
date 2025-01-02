import { InferInsertModel } from "drizzle-orm";
import { z } from "zod";
// import { plants } from "../../db/schema";

// import { MAX_RATING_VALUE } from "../../models/mood-rating";

export type SchemaInterface<
	Schema extends // biome-ignore lint/suspicious/noExplicitAny: <explanation>
		| Zod.ZodEffects<Zod.ZodObject<any, any, any, any, any>>
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		| Zod.ZodObject<any, any, any, any, any>,
> = z.infer<Schema>;

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
	email: z.string().email("Not a valid email"),
	password: z.string().min(6),
	// })
});

/**
 * @route /users
 * @method POST
 */
export const registerSchema = z
	.object({
		// body: z.object({
		email: z.string().email("Not a valid email"),
		password: z.string().min(6),
		passwordConfirmation: z.string().min(6),
		username: z.string().min(4),
		// })
	})
	.superRefine(({ password, passwordConfirmation }, ctx) => {
		// const { } = body
		if (password !== passwordConfirmation) {
			ctx.addIssue({
				code: "custom",
				message: "Passwords did not match",
			});
		}
	});

/**
 * @route /auth/google
 * @method POST
 */
export const oauthGooglePostSchema = z
	.object({
		providerToken: z.string(),
	})
	.superRefine(({ providerToken }, ctx) => {
		const isValidJwt = providerToken.split(".").length === 3;
		if (!isValidJwt) {
			ctx.addIssue({
				code: "custom",
				message: "Invalid JWT",
			});
		}
	});

/**
 * @route /me
 * @method PUT
 */
export const updateMeSchema = z
	.object({
		// body: z.object({
		oldPassword: z.string().min(6).optional(),
		newPassword: z.string().min(6).optional(),
		newPasswordConfirmation: z.string().min(6).optional(),
		username: z.string().min(4),
		// })
	})
	.superRefine(({ oldPassword, newPassword, newPasswordConfirmation }, ctx) => {
		const issues: z.IssueData[] = [];
		// const { oldPassword, newPassword, newPasswordConfirmation } = body

		if (oldPassword) {
			if (!newPassword || !newPasswordConfirmation) {
				issues.push({
					code: "custom",
					message: "Missing new replacement password",
				});
			}
			if (newPassword !== newPasswordConfirmation) {
				issues.push({
					code: "custom",
					message: "New password confirmation does not match",
				});
			}
		} else if (newPassword && newPasswordConfirmation) {
			issues.push({
				code: "custom",
				message: "Old password is required to select a new one",
			});
		}

		for (const issue of issues) {
			ctx.addIssue(issue);
		}
	});

// getPlantSchema,
// const x: InferInsertModel<typeof plants> = {}
// const z: ShallowPlant = {}
export const putPlantSchema = z.object({
	name: z
		.object({
			genusName: z.string({ required_error: "Genus name is required" }),
			speciesName: z.string().optional(),
			varietyName: z.string().optional(),
			name1a: z
				.object({
					species: z.boolean().optional(),
					name: z.string().optional(),
				})
				.optional(),
			name1b: z
				.object({
					species: z.boolean().optional(),
					name: z.string().optional(),
				})
				.optional(),
			name2a: z
				.object({
					species: z.boolean().optional(),
					name: z.string().optional(),
				})
				.optional(),
			name2b: z
				.object({
					species: z.boolean().optional(),
					name: z.string().optional(),
				})
				.optional(),
		})
		.optional()
		.nullable(),
	// userId: z.number(),
	fontSize: z.string().optional(),
	fromTrader: z.string().optional().nullable(),
	type: z.enum(["cutting", "seed", "rhizome", "none"]).optional(),
	location: z.string().optional().nullable(),
});

export const postPlantSchema = z.object({
	// name: z.object({
	//     genusName: z.string({ required_error: 'Genus name is required' }),
	//     speciesName: z.string().optional(),
	//     varietyName: z.string().optional(),
	//     name1a: z.object({
	//         species: z.boolean().optional(),
	//         name: z.string().optional()
	//     }
	//     ).optional(),
	//     name1b: z.object({
	//         species: z.boolean().optional(),
	//         name: z.string().optional()
	//     }
	//     ).optional(),
	//     name2a: z.object({
	//         species: z.boolean().optional(),
	//         name: z.string().optional()
	//     }
	//     ).optional(),
	//     name2b: z.object({
	//         species: z.boolean().optional(),
	//         name: z.string().optional()
	//     }
	//     ).optional()
	// }),
	// userId: z.number(),
	// fontSize: z.string().optional(),
	// fromTrader: z.string().optional().nullable(),
	type: z.enum(["cutting", "seed", "rhizome", "none", "plant"]),
	speciesId: z.number(),
	// location: z.string().nullable().optional(),
});
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

/**
 * @route /taxonomy/species/search
 * @method GET
 */
export const speciesSearchSchema = z.object({
	q: z.string(),
	excludeRank: z.enum(["CROSS", "CULTIVAR", "SPECIES"]).optional(),
	page: z.number().optional(),
	familyId: z.number().optional(),
	genusId: z.number().optional(),
	speciesId: z.number().optional(),
	onlyAccepted: z.boolean().optional(),
});

export const genusSearchSchema = z.object({
	q: z.string(),
	page: z.number().optional(),
	familyId: z.number().optional(),
	genusId: z.number().optional(),
	speciesId: z.number().optional(),
	onlyAccepted: z.boolean().optional(),
});

export const getClassificationSchema = z.object({
	taxonId: z.string(),
	taxonType: z.enum(["family", "genus", "species"]),
});

export const getLowerTaxaSchema = z.object({
	taxonId: z.string(),
	taxonType: z.enum(["family", "genus", "species"]),
});

export const postTraderSchema = z.object({
	name: z.string(),
	location: z.string().optional(),
});

export const putTraderSchema = z.object({
	name: z.string(),
	location: z.string().optional(),
});

export const postTradeSchema = z.object({
	objectUserId: z.number(),
	subjectPlantIds: z.array(z.number()),
	objectPlantIds: z.array(z.number()),
});

export const postMakeTradeSuggestionSchema = z.object({
	suggestionId: z.number(),
	subjectPlantIds: z.array(z.number()),
	objectPlantIds: z.array(z.number()),
});

export const postSpeciesSubmissionSchema = z.object({
	closestTaxonomicParent: z.number().optional(),
	closestTaxonomicParentType: z.enum(["family", "genus", "species"]).optional(),
	submissionType: z.enum([
		"species",
		"cultivar",
		"cross",

		// "hybrid"
		/*'intergeneric_hybrid'*/
	]),
	crossMomId: z.number().optional(),
	crossDadId: z.number().optional(),
	name: z.string().optional(), // om submissionType == hybrid så är det optional

	// @todo add parents in same UI view, few clicks, made easy.
	// extra grouping here? grex or whatever?
});

export const getNamePreviewSchema = z.object({
	submissionType: z.enum(["cross", "species", "cultivar"]),
	crossMomId: z.number().optional(),
	crossDadId: z.number().optional(),
	closestTaxonomicParent: z.number().optional(),
	closestTaxonomicParentType: z.enum(["family", "genus", "species"]).optional(),
	name: z.string().optional(), // om submissionType == hybrid så är det optional
});

export const getMatchCheckSchema = z.object({
	objectUserId: z.string(),
});
