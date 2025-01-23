## PERFORMANCE
To handle the performance of the complex search queries, we need extra indexes not supplied by Drizzle.
The following needs to be run on the database in question.

```
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX ON species USING gin (name gin_trgm_ops);
CREATE INDEX ON species USING gin (species_name gin_trgm_ops);
CREATE INDEX ON species USING gin (cultivar_name gin_trgm_ops);
CREATE INDEX idx_plants_user_species ON plants(user_id, species_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_species_taxonomy ON species(id, genus_id, family_id);

CREATE INDEX idx_tradeable_plants_plant_id ON tradeable_plants(plant_id);
CREATE INDEX species_interests_user_id on species_interests(user_id);
CREATE INDEX genus_interests_user_id on genus_interests(user_id);
CREATE INDEX family_interests_user_id on family_interests(user_id);

CREATE INDEX deleted_plants_index on plants(deleted_at) where deleted_at is not null;
```


## Rollbacks
This is WIP.
Once a day, we should take a snapshot of the DB in production, and upload this "somewhere" (s3?).
When rolling back, we should create a NEW DB, into which we insert the backup. 
Trying to rollback into an existing DB will always be very annoying.
