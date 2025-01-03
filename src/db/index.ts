import { sql } from "drizzle-orm";
import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import envVars from "../utils/environment";
import { Schema } from "./schema";

export type DB = NodePgDatabase<typeof Schema>;

export class DatabaseManager {
	db: DB;
	pool: Pool;

	constructor() {
		this.refreshConnection();
	}

	private connect(connectionString: string) {
		const pool = new Pool({ connectionString });
		this.pool = pool;
		this.db = drizzle(pool, { schema: Schema });
		return this;
	}

	public migrateLatest() {
		console.log("Migrating latest...");
		return migrate(this.db, {
			migrationsFolder: "./drizzle",
		});
	}

	/**
	 * Used when you have altered environment variables, and want to connect to another DB.
	 */
	public async refreshConnection() {
		this.connect(envVars.get("DATABASE_URL"));
	}

	public async truncateTables() {
		const env = envVars.get("NODE_ENV");
		if (env !== "test")
			throw new Error("Truncating tables not available outside of testing");

		const result = await this.db.execute(
			sql.raw(`
                select 
                    table_schema||'.'||table_name as table_fullname
                from 
                    information_schema."tables"
                where 
                    table_schema = 'public';`),
		);

		const tableNames = result.rows.map((row) => row.table_fullname).join(", ");
		const sqlStatement = `truncate ${tableNames} restart identity;`;
		await this.db.execute(sql.raw(sqlStatement));
		return;
	}
}

const dbManager = new DatabaseManager();
export default dbManager;
