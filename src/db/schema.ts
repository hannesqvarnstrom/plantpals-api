import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
export const providerEnum = pgEnum("provider", ["GOOGLE", "FACEBOOK"]);

export const users = pgTable(
	"users",
	{
		id: serial("id").primaryKey(),
		email: text("email").notNull(),
		password: varchar("password"),
		username: varchar("username"),
		lastLogAt: timestamp("last_log_at", { mode: "date" }),
		passwordSet: boolean("password_set").default(false),
		emailVerified: boolean("email_verified").default(false),
	},
	(users) => ({
		emailIdx: index("users_email_index").on(users.email),
	}),
);

export const userRelations = relations(users, (helpers) => ({
	tradesRequestedByUser: helpers.many(trades, {
		relationName: "tradesRequestedByUser",
	}),
	tradesReceivedByUser: helpers.many(trades, {
		relationName: "tradesReceivedByUser",
	}),
}));
export const federatedIdentities = pgTable("federated_identities", {
	provider: providerEnum("provider").notNull(),
	providerId: varchar("providerId"), // user's ID in remote
	createdAt: timestamp("createdAt").defaultNow(),
	userId: integer("user_id")
		.references(() => users.id)
		.primaryKey(), // user_id in our DB
});

export const plantTypeEnum = pgEnum("type", [
	"cutting",
	"seed",
	"rhizome",
	"none",
	"plant",
]);

export const speciesRankEnum = pgEnum("rank", [
	"VARIETY",
	"SUBSPECIES",
	"SPECIES",
	"CULTIVAR",
	"HYBRID",
	"CROSS",
]); // 'intergeneric_hybrid', 'hybrid'?

export const families = pgTable("families", {
	id: serial("id").primaryKey(),
	name: varchar("name").notNull(),
	gbifKey: varchar("gbif_key").notNull(),
	vernacularNames: jsonb("vernacular_names"),
	createdAt: timestamp("created_at").defaultNow(),
});

export const genera = pgTable(
	"genera",
	{
		id: serial("id").primaryKey(),
		name: varchar("name").notNull(),
		familyId: integer("family_id")
			.references(() => families.id)
			.notNull(),
		gbifKey: varchar("gbif_key").notNull(),
		gbifFamilyKey: varchar("gbif_family_key").notNull(),
		vernacularNames: jsonb("vernacular_names"),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(genera) => ({
		generaNameIdx: index("genera_name_index").on(genera.name),
	}),
);

export const species = pgTable(
	"species",
	{
		id: serial("id").primaryKey(),
		name: varchar("name").notNull(),
		familyId: integer("family_id")
			.references(() => families.id)
			.notNull(),
		genusId: integer("genus_id")
			.references(() => genera.id)
			.notNull(),
		gbifKey: varchar("gbif_key"),
		gbifFamilyKey: varchar("gbif_family_key"),
		gbifGenusKey: varchar("gbif_genus_key"),
		vernacularNames: jsonb("vernacular_names"),
		speciesName: varchar("species_name"),
		cultivarName: varchar("cultivar_name"),
		rank: speciesRankEnum("rank").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		parentSpeciesId: integer("parent_species_id"),
		userSubmitted: boolean("user_submitted").default(false),
		crossMomId: integer("cross_mom_id"),
		crossDadId: integer("cross_dad_id"),
	},
	(species) => ({
		familyIdIdx: index("species_family_index").on(species.familyId),
		genusIdIdx: index("species_genus_index").on(species.genusId),
		parentSpeciesIdIdx: index("species_parent_species_index").on(
			species.parentSpeciesId,
		),
		speciesNameIdx: index("species_name_index").on(species.name),
		crossMomIdx: index("cross_mom_index").on(species.crossMomId),
		crossDadIdx: index("cross_dad_index").on(species.crossDadId),
	}),
);

export const speciesRelations = relations(species, ({ one, many }) => ({
	parentSpecies: one(species, {
		fields: [species.parentSpeciesId],
		references: [species.id],
		relationName: "childSpecies",
	}),
	childSpecies: many(species, {
		relationName: "childSpecies",
	}),
	crossMom: one(species, {
		fields: [species.crossMomId],
		references: [species.id],
	}),
	crossDad: one(species, {
		fields: [species.crossDadId],
		references: [species.id],
	}),
	genus: one(genera, {
		fields: [species.genusId],
		references: [genera.id],
		relationName: "allSpecies",
	}),
}));

export const familyRelations = relations(families, ({ many }) => ({
	genera: many(genera, {
		relationName: "genera",
	}),
}));

export const generaRelations = relations(genera, ({ one, many }) => ({
	family: one(families, {
		fields: [genera.familyId],
		references: [families.id],
		relationName: "genera",
	}),
	allSpecies: many(species, {
		relationName: "allSpecies",
	}),
}));

export const userSpeciesSubmissions = pgTable("user_species_submissions", {
	id: serial("id").primaryKey(),
	speciesId: integer("species_id")
		.references(() => species.id)
		.notNull(),
	userId: integer("user_id")
		.references(() => users.id)
		.notNull(),
	createdAt: timestamp("created_at").defaultNow(),
});

export const plants = pgTable("plants", {
	id: serial("id").primaryKey(),
	userId: integer("user_id")
		.references(() => users.id)
		.notNull(),
	speciesId: integer("species_id")
		.references(() => species.id)
		.notNull(),
	type: plantTypeEnum("type").notNull(),
	deletedAt: timestamp("deleted_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tradeablePlants = pgTable("tradeable_plants", {
	id: serial("id").primaryKey(),
	plantId: integer("plant_id").references(() => plants.id, {
		onDelete: "cascade",
	}),
	availableFrom: timestamp("available_from").defaultNow(),
});

export const familyInterests = pgTable("family_interests", {
	id: serial("id").primaryKey(),
	userId: integer("user_id")
		.references(() => users.id)
		.notNull(),
	familyId: integer("family_id")
		.references(() => families.id)
		.notNull(),
});

export const genusInterests = pgTable("genus_interests", {
	id: serial("id").primaryKey(),
	userId: integer("user_id")
		.references(() => users.id)
		.notNull(),
	genusId: integer("genus_id")
		.references(() => genera.id)
		.notNull(),
});

export const speciesInterests = pgTable("species_interests", {
	id: serial("id").primaryKey(),
	userId: integer("user_id")
		.references(() => users.id)
		.notNull(),
	speciesId: integer("species_id")
		.references(() => species.id)
		.notNull(),
});

export const trades = pgTable("trades", {
	id: serial("id").primaryKey(),
	requestingUserId: integer("requesting_user_id")
		.references(() => users.id)
		.notNull(),
	receivingUserId: integer("receiving_user_id")
		.references(() => users.id)
		.notNull(),
	completedByRequestingUser: boolean("completed_by_requesting_user").default(
		false,
	),
	completedByReceivingUser: boolean("completed_by_receiving_user").default(
		false,
	),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	statusId: integer("status_id")
		.references(() => tradeStatusTypes.id)
		.notNull(),
	// @todo figure out a nice structure for this
});

export const statusTypeValueEnum = pgEnum("value", [
	"pending",
	"accepted",
	"completed",
	"declined",
	"cancelled",
]);

export const tradeStatusTypes = pgTable("trade_status_types", {
	id: serial("id").primaryKey(),
	name: varchar("name").notNull(),
	value: statusTypeValueEnum("value").notNull(),
});

export const tradeStatusChanges = pgTable("trade_status_changes", {
	id: serial("id").primaryKey(),
	tradeId: integer("trade_id")
		.references(() => trades.id)
		.notNull(),
	statusId: integer("trade_status_type_id")
		.references(() => tradeStatusTypes.id)
		.notNull(),
	changedAt: timestamp("changed_at").defaultNow().notNull(),
});

export const tradeStatusChangeRelations = relations(
	tradeStatusChanges,
	(helpers) => ({
		trade: helpers.one(trades, {
			fields: [tradeStatusChanges.tradeId],
			references: [trades.id],
			relationName: "statusHistory",
		}),
		statusType: helpers.one(tradeStatusTypes, {
			fields: [tradeStatusChanges.statusId],
			references: [tradeStatusTypes.id],
		}),
	}),
);

export const tradeRelations = relations(trades, (helpers) => ({
	statusType: helpers.one(tradeStatusTypes, {
		fields: [trades.statusId],
		references: [tradeStatusTypes.id],
	}),
	requestingUser: helpers.one(users, {
		fields: [trades.requestingUserId],
		references: [users.id],
		relationName: "tradesRequestedByUser",
	}),
	receivingUser: helpers.one(users, {
		fields: [trades.receivingUserId],
		references: [users.id],
		relationName: "tradesReceivedByUser",
	}),
	suggestions: helpers.many(tradeSuggestions, {
		relationName: "suggestions",
	}),
	statusHistory: helpers.many(tradeStatusChanges, {
		relationName: "statusHistory",
	}),
}));

export const tradeSuggestions = pgTable("trade_suggestions", {
	id: serial("id").primaryKey().notNull(),
	tradeId: integer("trade_id")
		.references(() => trades.id)
		.notNull(),
	subjectUserId: integer("subject_user_id")
		.references(() => users.id)
		.notNull(),
	objectUserId: integer("object_user_id")
		.references(() => users.id)
		.notNull(),
	acceptedAt: timestamp("accepted_at"),
	deniedAt: timestamp("denied_at"),
	respondedAt: timestamp("responded_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tradeSuggestionPlants = pgTable("trade_suggestion_plants", {
	id: serial("id").primaryKey().notNull(),
	tradeSuggestionId: integer("trade_suggestion_id")
		.references(() => tradeSuggestions.id)
		.notNull(),
	plantId: integer("plant_id")
		.references(() => plants.id, { onDelete: "cascade" })

		.notNull(),
});

export const tradeSuggestionRelations = relations(
	tradeSuggestions,
	(helpers) => ({
		suggestionPlants: helpers.many(tradeSuggestionPlants, {
			relationName: "suggestionPlants",
		}),
		trade: helpers.one(trades, {
			fields: [tradeSuggestions.tradeId],
			references: [trades.id],
			relationName: "suggestions",
		}),
	}),
);

export const tradeSuggestionPlantRelations = relations(
	tradeSuggestionPlants,
	(helpers) => ({
		tradeSuggestions: helpers.one(tradeSuggestions, {
			fields: [tradeSuggestionPlants.tradeSuggestionId],
			references: [tradeSuggestions.id],
			relationName: "suggestionPlants",
		}),
		plant: helpers.one(plants, {
			fields: [tradeSuggestionPlants.plantId],
			references: [plants.id],
		}),
	}),
);

export const Schema = {
	users,
	userRelations,
	federatedIdentities,
	plants,
	species,
	genera,
	families,
	speciesInterests,
	genusInterests,
	familyInterests,
	tradeablePlants,
	tradeSuggestions,
	tradeSuggestionPlants,
	tradeSuggestionRelations,
	tradeSuggestionPlantRelations,
	userSpeciesSubmissions,
	trades,
	tradeStatusTypes,
	tradeRelations,
	speciesRelations,
	familyRelations,
	generaRelations,
	tradeStatusChangeRelations,
	tradeStatusChanges,
};
