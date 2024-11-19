// authored by ChatGPT 3.5
const { Pool } = require('pg');
const { configDotenv } = require('dotenv');
const fs = require('fs');
const path = require('path');
configDotenv();

const connString = process.env.DATABASE_URL;
const pool = new Pool({
    connectionString: connString,
});

async function rollback() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Load down migrations
        const migrationsFolder = path.resolve(__dirname, './drizzle');
        const files = fs.readdirSync(migrationsFolder).filter(file => file.endsWith('.sql')).sort().reverse();

        for (const file of files) {
            const downFile = file.replace('.sql', '.down.sql');
            const downFilePath = path.join(migrationsFolder, downFile);

            if (fs.existsSync(downFilePath)) {
                const downMigration = fs.readFileSync(downFilePath, 'utf-8');
                await client.query(downMigration);
                console.log(`Rolled back ${file}`);
                break; // Only roll back the latest migration
            }
        }

        await client.query('COMMIT');
        console.log('Rollback completed');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Failed to roll back:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

rollback();
