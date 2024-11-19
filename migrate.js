const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");
const { migrate } = require("drizzle-orm/node-postgres/migrator");
const { configDotenv } = require("dotenv");
configDotenv();
const connString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: connString,
});

const db = drizzle(pool);
console.log(db);
migrate(db, {
  migrationsFolder: "./drizzle",
}).then((result) => {
  console.log("Result:", result);
  process.exit(0);
});
