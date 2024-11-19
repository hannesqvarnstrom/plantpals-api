const path = require('path')
const { configDotenv } = require('dotenv')
const fs = require('fs').promises
configDotenv()
async function make() {
    try {
        const migrationsFolder = path.resolve(__dirname, './drizzle')
        const filesProm = await fs.readdir(migrationsFolder)
        const sqlFiles = filesProm.filter(file => file.endsWith('.sql') && !file.includes('.down.sql'))
        const files = filesProm.filter(file => file.endsWith('.down.sql'))
        
        for (const file of sqlFiles) {
            const searchName = file.slice(0, file.length-4)
            console.log('searchName:', searchName)

            const downFileExists = files.find(fileName => fileName.includes(searchName))
            if (!downFileExists) {
                const downFile = file.replace('.sql', '.down.sql')
                const downFilePath = path.join(migrationsFolder, downFile)
                await fs.writeFile(downFilePath, '@TODO WRITE A DOWN MIGRATION FOR THIS ONE')
                console.info('created file for down migration at path ' + downFilePath)
            }
        }
    } catch (e) {
        console.error('something went wrong during make-down-migrations', e)
    }
}

make()