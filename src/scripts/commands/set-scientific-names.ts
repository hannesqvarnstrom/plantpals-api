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

    const promChunks: Promise<unknown>[][] = []
    let i = 0;
    for await (const s of queryStream) {
        const { id } = s as TSpecies;

        console.log('i:', i)
        if (promChunks[i]) {
            const chunks = promChunks[i] as Promise<unknown>[]

            if (chunks.length <= 15) {
                chunks.push(taxonomyService.updateScientificNameForSpecies(id))
            } else {
                promChunks.push([taxonomyService.updateScientificNameForSpecies(id)])
                i++
            }
        } else {
            promChunks[i] = [taxonomyService.updateScientificNameForSpecies(id)]
        }
    }

    let j = 1
    for (const chunk of promChunks) {
        console.log('j:', j)
        await Promise.all(chunk)
        j++
    }
    return;
}
