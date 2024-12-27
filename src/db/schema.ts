import { index, integer, jsonb, pgEnum, boolean, pgTable, serial, smallint, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm';
export const providerEnum = pgEnum('provider', ['GOOGLE', 'FACEBOOK'])

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    password: varchar('password'),
    username: varchar('userame'),
    lastLogAt: timestamp('last_log_at', { mode: 'date', }),
}, (users) => ({
    emailIdx: index('users_email_index').on(users.email),
}))

export const userRelations = relations(users, (helpers) => ({
    tradesRequestedByUser: helpers.many(trades, {
        relationName: 'tradesRequestedByUser'
    }),
    tradesReceivedByUser: helpers.many(trades, {
        relationName: 'tradesReceivedByUser'
    })
}))
export const federatedIdentities = pgTable('federated_identities', {
    provider: providerEnum('provider').notNull(),
    providerId: varchar('providerId'), // user's ID in remote
    createdAt: timestamp('createdAt').defaultNow(),
    userId: integer('user_id').references(() => users.id).primaryKey() // user_id in our DB
})

export const plantTypeEnum = pgEnum('type', ['cutting', 'seed', 'rhizome', 'none', 'plant'])


export const speciesRankEnum = pgEnum('rank', ['VARIETY', 'SUBSPECIES', 'SPECIES', 'CULTIVAR', 'HYBRID']) // 'intergeneric_hybrid', 'hybrid'?

export const families = pgTable('families', {
    id: serial('id').primaryKey(),
    name: varchar('name').notNull(),
    gbifKey: varchar('gbif_key').notNull(),
    vernacularNames: jsonb('vernacular_names'),
    createdAt: timestamp('created_at').defaultNow(),
})

export const genera = pgTable('genera', {
    id: serial('id').primaryKey(),
    name: varchar('name').notNull(),
    familyId: integer('family_id').references(() => families.id).notNull(),
    gbifKey: varchar('gbif_key').notNull(),
    gbifFamilyKey: varchar('gbif_family_key').notNull(),
    vernacularNames: jsonb('vernacular_names'),
    createdAt: timestamp('created_at').defaultNow(),
}, (genera) => ({
    generaNameIdx: index('genera_name_index').on(genera.name)
}))

export const species = pgTable('species', {
    id: serial('id').primaryKey(),
    name: varchar('name').notNull(),
    familyId: integer('family_id').references(() => families.id).notNull(),
    genusId: integer('genus_id').references(() => genera.id).notNull(),
    gbifKey: varchar('gbif_key'),
    gbifFamilyKey: varchar('gbif_family_key'),
    gbifGenusKey: varchar('gbif_genus_key'),
    vernacularNames: jsonb('vernacular_names'),
    speciesName: varchar('species_name'),
    cultivarName: varchar('cultivar_name'),
    rank: speciesRankEnum('rank').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    parentSpeciesId: integer('parent_species_id'),
    userSubmitted: boolean('user_submitted').default(false),
    hybridMomId: integer('hybrid_mom_id'),
    hybridDadId: integer('hybrid_dad_id'),
}, (species) => ({
    familyIdIdx: index('species_family_index').on(species.familyId),
    genusIdIdx: index('species_genus_index').on(species.genusId),
    parentSpeciesIdIdx: index('species_parent_species_index').on(species.parentSpeciesId),
    speciesNameIdx: index('species_name_index').on(species.name),
    hybridMomIdx: index('hybrid_mom_index').on(species.hybridMomId),
    hybridDadIdx: index('hybrid_dad_index').on(species.hybridDadId)
}))

export const speciesRelations = relations(species, ({ one }) => ({
    parentSpecies: one(species, {
        fields: [species.parentSpeciesId],
        references: [species.id],
    }),
    hybridMom: one(species, {
        fields: [species.hybridMomId],
        references: [species.id]
    }),
    hybridDad: one(species, {
        fields: [species.hybridDadId],
        references: [species.id]
    })
}));

export const userSpeciesSubmissions = pgTable('user_species_submissions', {
    id: serial('id').primaryKey(),
    speciesId: integer('species_id').references(() => species.id).notNull(),
    userId: integer('user_id').references(() => users.id).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
})

export const plants = pgTable('plants', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    speciesId: integer('species_id').references(() => species.id).notNull(),
    type: plantTypeEnum('type').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const tradeablePlants = pgTable('tradeable_plants', {
    id: serial('id').primaryKey(),
    plantId: integer('plant_id').references(() => plants.id),
    availableFrom: timestamp('available_from').defaultNow(),
})

export const familyInterests = pgTable('family_interests', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    familyId: integer('family_id').references(() => families.id).notNull(),
})

export const genusInterests = pgTable('genus_interests', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    genusId: integer('genus_id').references(() => genera.id).notNull(),
})

export const speciesInterests = pgTable('species_interests', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    speciesId: integer('species_id').references(() => species.id).notNull(),
})

export const trades = pgTable('trades', {
    id: serial('id').primaryKey(),
    requestingUserId: integer('requesting_user_id').references(() => users.id).notNull(),
    receivingUserId: integer('receiving_user_id').references(() => users.id).notNull(),
    plantOfferedId: integer('plant_offered_id').references(() => plants.id).notNull(),
    plantDesiredId: integer('plant_desired_id').references(() => plants.id).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    statusId: integer('status_id').references(() => tradeStatusTypes.id).notNull(),
    // @todo figure out a nice structure for this
})

export const statusTypeValueEnum = pgEnum('value', ['pending', 'accepted', 'completed', 'declined', 'cancelled'])

export const tradeStatusTypes = pgTable('trade_status_types', {
    id: serial('id').primaryKey(),
    name: varchar('name').notNull(),
    value: statusTypeValueEnum('value').notNull(),
})



export const tradeStatusChanges = pgTable('trade_status_changes', {
    id: serial('id').primaryKey(),
    tradeId: integer('trade_id').references(() => trades.id).notNull(),
    statusId: integer('trade_status_type_id').references(() => tradeStatusTypes.id).notNull(),
    changedAt: timestamp('changed_at').defaultNow().notNull(),
})

export const tradeRelations = relations(trades, (helpers) => ({
    statusType: helpers.one(tradeStatusTypes, {
        fields: [trades.statusId],
        references: [tradeStatusTypes.id]
    }),
    requestingUser: helpers.one(users, {
        fields: [trades.requestingUserId],
        references: [users.id],
        relationName: 'tradesRequestedByUser'
    }),
    receivingUser: helpers.one(users, {
        fields: [trades.receivingUserId],
        references: [users.id],
        relationName: 'tradesReceivedByUser'
    })
}))

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
    userSpeciesSubmissions,
    trades,
    tradeStatusTypes,
    tradeRelations,
    speciesRelations
}