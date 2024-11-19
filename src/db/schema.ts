import { index, integer, jsonb, pgEnum, boolean, pgTable, serial, smallint, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm';
export const providerEnum = pgEnum('provider', ['GOOGLE', 'FACEBOOK'])

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    password: varchar('password'),
    lastLogAt: timestamp('last_log_at', { mode: 'date', }),
}, (users) => ({
    emailIdx: index('users_email_index').on(users.email),
}))

export const federatedIdentities = pgTable('federated_identities', {
    provider: providerEnum('provider').notNull(),
    providerId: varchar('providerId'), // user's ID in remote
    createdAt: timestamp('createdAt').defaultNow(),
    userId: integer('user_id').references(() => users.id).primaryKey() // user_id in our DB
})

export const plantTypeEnum = pgEnum('type', ['cutting', 'seed', 'rhizome', 'none', 'plant'])


export const speciesRankEnum = pgEnum('rank', ['VARIETY', 'SUBSPECIES', 'SPECIES', 'CULTIVAR'])

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
})

export const species = pgTable('species', {
    id: serial('id').primaryKey(),
    name: varchar('name').notNull(),
    familyId: integer('family_id').references(() => families.id).notNull(),
    genusId: integer('genus_id').references(() => genera.id).notNull(),
    gbifKey: varchar('gbif_key'),
    gbifFamilyKey: varchar('gbif_family_key'),
    gbifGenusKey: varchar('gbif_genus_key'),
    vernacularNames: jsonb('vernacular_names'),
    rank: speciesRankEnum('rank').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    parentSpeciesId: integer('parent_species_id'),
    userSubmitted: boolean('user_submitted').default(false),
}, (species) => ({
    familyIdIdx: index('species_family_index').on(species.familyId),
    genusIdIdx: index('species_genus_index').on(species.genusId),
    parentSpeciesIdIdx: index('species_parent_species_index').on(species.parentSpeciesId),
}))

export const speciesRelations = relations(species, ({ one }) => ({
    parentSpecies: one(species, {
        fields: [species.parentSpeciesId],
        references: [species.id],
    }),
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
    createdAt: timestamp('created_at').defaultNow(),
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
    // @todo figure out a nice structure for this
})

// export const plants = pgTable('plants', {
//     id: serial('id').primaryKey(),
//     name: jsonb('name').notNull(), // @todo add model validation for the jsonb object?
//     fontSize: varchar('font_size').default('13px'),
//     userId: integer('user_id').references(() => users.id).notNull(),

//     fromTrader: integer('from_trader').references(() => traders.id),
//     location: varchar('location'),
//     type: plantTypeEnum('type').notNull(),

//     createdAt: timestamp('createdAt').defaultNow(),
// }, (plants) => ({
//     userIdIndex: index('plants_user_id_index').on(plants.userId),
//     traderIdIndex: index('plants_trader_id_index').on(plants.fromTrader)
// }))

// export const traders = pgTable('traders', {
//     id: serial('id').primaryKey(),
//     name: varchar('name').notNull(),
//     createdBy: integer('created_by').references(() => users.id),
//     createdAt: timestamp('createdAt').defaultNow(),
//     location: varchar('location'),
// })
