import { eq } from "drizzle-orm";
import QueryStream from "pg-query-stream";
import dbManager from "../../db";
import { species } from "../../db/schema";
import type { TSpecies } from "../../models/species";
import taxonomyService from "../../services/taxonomy";

// run locally at 19 dec 2024
export default async function setScientificNames() {
    const SQL = dbManager.db.select().from(species).toSQL();
    const stream = new QueryStream(SQL.sql, SQL.params);
    const client = await dbManager.pool.connect();
    const queryStream = client.query(stream);
    // const updatedSpecies: { id: number; speciesName: string }[] = [];
    let i = 1
    for await (const s of queryStream) {
        const { id } = s as TSpecies;
        console.log(`setting sci name of species nr ${i}`)
        await taxonomyService.updateScientificNameForSpecies(id)
        i++
    }
    return;
}
