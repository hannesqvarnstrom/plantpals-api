import QueryStream from "pg-query-stream";
import dbManager from "../../db";
import { species } from "../../db/schema";
import { TSpecies } from "../../models/species";
import { eq } from "drizzle-orm";


// run locally at 19 dec 2024
export default async function initSpeciesNames() {

    const SQL = dbManager.db.select().from(species).toSQL()
    const stream = new QueryStream(SQL.sql, SQL.params)
    const client = await dbManager.pool.connect()
    const queryStream = client.query(stream)
    const updatedSpecies: { id: number, speciesName: string }[] = []
    for await (const s of queryStream) {
        const { name, id, rank } = s as TSpecies
        let speciesName = ''

        speciesName = name.split(' ')[1] ?? ''


        if (speciesName) {
            updatedSpecies.push({ id, speciesName })
        }
    }

    for (const { id, speciesName } of updatedSpecies) {
        await dbManager.db.update(species).set({ id, speciesName }).where(eq(species.id, id))
    }
    return
}