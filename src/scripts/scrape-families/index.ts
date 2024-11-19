import axios from "axios";
import axiosRetry from "axios-retry";
import * as cheerio from 'cheerio'
import fs from 'fs/promises'
import dbManager from "../../db";
import { species, families, genera } from "../../db/schema";
import { eq } from "drizzle-orm";


axiosRetry(axios, {
    // specify max amount of retries:
    retries: 3,
    // create a delay between each request base don retry count:
    retryDelay: (retryCount) => { return retryCount * 1000 },
    // print message on retry:
    onRetry: (count, err, req) => { console.log(`retry attempt #${count} got ${err}`); },
    retryCondition: axiosRetry.isNetworkOrIdempotentRequestError,  // default: retries status code 5xx and Network errors
})
export const makeRequest = axios
export const scraper = cheerio
export const SCRAPING_URLS = {
    family_wikipedia: "https://en.wikipedia.org/wiki/List_of_plant_family_names_with_etymologies",
} as const

const getDataFromID = (id: string | number) => `https://api.gbif.org/v1/species/${id}`
const getAllChildrenURL = (id: string | number) => `https://api.gbif.org/v1/species/${id}/childrenAll`

export async function scrapeFamilyDataAll() {
    const fileName = __dirname + '/families.json'
    const familyNames: string[] = await fs.readFile(fileName).then(data => JSON.parse(data.toString()))

    const searchUrl = "https://techdocs.gbif.org/en/openapi/v1/species#/Searching%20names/searchNames"
    const familyData: unknown[] = []
    let i = 0;
    const max = familyNames.length
    for (const familyName of familyNames) {
        console.log(`${i + 1}/${max}`)
        console.log('making request for ' + familyName)
        const { data: familyRequestData } = await makeRequest("https://api.gbif.org/v1/species/search?datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c&q=" + familyName)
        console.log('request complete')
        const likelyFamilyData = familyRequestData.results[0]
        familyData.push(likelyFamilyData)
        i++
    }
    console.log('writing to file...')
    const familyDataFileName = __dirname + '/extracted-family-data.json'

    await fs.writeFile(familyDataFileName, JSON.stringify(familyData))
    console.log('family data written')
}

async function selectOrCreateFamily(familyData: TaxonomicRecord) {
    const [family, ..._] = await dbManager.db.select().from(families).where(eq(families.gbifKey, familyData.key.toString()))
    if (family) {
        return family
    } else {
        const [createdFamily, ..._] = await dbManager.db.insert(families).values({ name: familyData.canonicalName, gbifKey: familyData.key.toString(), vernacularNames: familyData.vernacularNames }).returning()
        if (createdFamily) {
            return createdFamily
        } else {
            throw new Error('could not create family with name ' + familyData.canonicalName)
        }
    }
}

async function selectOrCreateGenus(genusData: TaxonomicRecord, familyId: number) {
    const [genus, ..._] = await dbManager.db.select().from(genera).where(eq(genera.gbifKey, genusData.key.toString()))
    if (genus) {
        return genus
    } else {
        try {

            const [createdGenus, ..._] = await dbManager.db.insert(genera).values({ name: genusData.canonicalName, gbifKey: genusData.key.toString(), vernacularNames: genusData.vernacularNames, familyId, gbifFamilyKey: genusData.familyKey.toString() }).returning()
            if (createdGenus) {
                return createdGenus
            } else {
                throw new Error('could not create genus with name ' + genusData.canonicalName)
            }
        } catch (e) {
            console.error(genusData)
            throw new Error('genus creation failed with error ' + e)
        }
    }
}

export async function scrapeFamilySpecific(familyName: string) {

    /**
     * 1. Create family
    */
    const familiesData: TaxonomicRecord[] = await fs.readFile(__dirname + '/extracted-family-data.json').then(data => JSON.parse(data.toString()))
    const familySpecificData = familiesData.find(family => family.canonicalName.toLowerCase() === familyName.toLowerCase())
    if (!familySpecificData) {
        throw new Error('could not find family')
    }
    const family = await selectOrCreateFamily(familySpecificData)

    const { data: shallowGenera } = await makeRequest(getAllChildrenURL(family.gbifKey)) as { data: TaxonomicRecord[] }

    const createdGenera: unknown[] = []

    /**
     * For genus in shallowGenera
     */
    for (const genus of shallowGenera) {
        /**
         * create genus if valid
         */
        const { data: genusData } = await makeRequest(getDataFromID(genus.key)) as { data: TaxonomicRecord }
        if (genusData.taxonomicStatus === 'ACCEPTED' && genusData.rank === 'GENUS') {
            const genusInDB = await selectOrCreateGenus(genusData, family.id)

            // console.log(genusData)
            // let [genusInDB, ..._] = await dbManager.db.select().from(genera).where(eq(genera.gbifKey, genusData.key.toString()))
            // if (genusInDB) {
            //     console.warn('genus already in db, skipping creation')
            // } else {
            //     const [creationResult, ..._1] = await dbManager.db.insert(genera).values({ familyId: family.id, gbifKey: genusData.key.toString(), gbifFamilyKey: genusData.familyKey.toString(), name: genusData.canonicalName, vernacularNames: genusData.vernacularNames }).returning()
            //     if (!creationResult) {
            //         throw new Error('unable to create genus')
            //     }
            //     console.log('created genus: ' + creationResult.name + ', key: ' + creationResult.gbifKey)
            //     createdGenera.push(creationResult)
            //     genusInDB = creationResult
            // }

            const createdSpecies: unknown[] = []

            const { data: genusChildData } = await makeRequest(getAllChildrenURL(genusData.key))

            for (const speciesItem of genusChildData) {
                /**
                 * create species if valid
                 * dont forget to use RANK here
                 */
                const nestedSpeciesData = createSpeciesAndChildren(speciesItem.key, genusInDB.id, family.id)
                if (nestedSpeciesData) {
                    createdSpecies.push(nestedSpeciesData)
                }
            }
        }
    }
}

function validateSpecies(speciesData: TaxonomicRecord) {
    const requiredCols = ["canonicalName", "key", "genusKey", "familyKey", "rank", "taxonomicStatus"]
    const acceptedRanks = ["SPECIES", "VARIETY", "SUBSPECIES"]
    return requiredCols.every(col => !!speciesData[col as keyof typeof speciesData]) && acceptedRanks.includes(speciesData.rank)
}

async function createSpeciesAndChildren(speciesKey: number, genusId: number, familyId: number, relatedSpeciesId?: number) {
    const [speciesCreated, ..._] = await dbManager.db.select().from(species).where(eq(species.gbifKey, String(speciesKey))).execute()
    if (speciesCreated) {
        console.warn('skipping duplicate species')
        return { "species": speciesCreated, "children": [] }
    } else {
        const { data: speciesData } = await makeRequest(getDataFromID(speciesKey))
        if (speciesData.taxonomicStatus === 'ACCEPTED') {
            const acceptedRanks = ['SPECIES', 'VARIETY', 'SUBSPECIES']
            if (!acceptedRanks.includes(speciesData.rank)) {
                console.warn('species rank ' + speciesData.rank + ' is not permitted')
                return
            }

            const validationResult = validateSpecies(speciesData)
            if (!validationResult) {
                console.error('could not validate species', { key: speciesData.key, name: speciesData.canonicalName })
                return
            }
            let createdSpecies
            try {

                const [creationResult, ..._] = await dbManager.db.insert(species).values({
                    name: speciesData.canonicalName,
                    genusId: genusId,
                    familyId: familyId,
                    gbifKey: speciesData.key.toString(),
                    gbifGenusKey: (speciesData.genusKey as number).toString(),
                    gbifFamilyKey: speciesData.familyKey.toString(),
                    vernacularNames: speciesData.vernacularNames,
                    rank: speciesData.rank as 'SPECIES' | 'VARIETY' | 'SUBSPECIES',
                    parentSpeciesId: relatedSpeciesId
                }).returning()

                if (!creationResult) {
                    console.error('failed to create species')
                    console.log({
                        name: speciesData.canonicalName,
                        genusId: genusId,
                        familyId: familyId,
                        gbifKey: speciesData.key.toString(),
                        gbifGenusKey: (speciesData.genusKey as number).toString(),
                        gbifFamilyKey: speciesData.familyKey.toString(),
                        vernacularNames: speciesData.vernacularNames,
                        rank: speciesData.rank as 'SPECIES' | 'VARIETY' | 'SUBSPECIES',
                        parentSpeciesId: relatedSpeciesId
                    })
                    return
                }
                createdSpecies = creationResult
            } catch (e) {
                console.error('crash during species creation', e)
                return
            }

            console.log('created species: ' + createdSpecies?.name + ', key: ' + createdSpecies?.gbifKey)
            if (speciesData.numDescendants) {
                const { data: subSpeciesData } = await makeRequest(getAllChildrenURL(String(speciesKey)))
                const children: unknown[] = []
                for (const child of subSpeciesData) {
                    const result = await createSpeciesAndChildren(child.key, genusId, familyId, createdSpecies?.id)
                    children.push(result)
                }
                return { species: createdSpecies, children }
            } else {
                return { species: createdSpecies, children: [] }
            }
        } else {
            // in an 'else' here we could do logic on synonyms.
            // but maybe we can skip that for now.
            // we can do a synonym parsing step in the future instead.
            // -> search for key, parse out synonyms, do whatever
            console.warn('skipping synonym with name : ' + speciesData.canonicalName + ', key: ' + speciesData.key)
            return
        }
    }
}

export async function scrapeFamilyNames() {
    const { data } = await makeRequest(SCRAPING_URLS.family_wikipedia)
    const fileName = __dirname + '/families.json'
    const loadedStuff = scraper.load(data)
    // console.log(loadedStuff)
    const familiesTable = loadedStuff('table tbody tr th a').get()
    const families: string[] = []
    for (const { attribs: properties } of familiesTable) {
        try {
            const { title } = properties
            if (title) {
                families.push(title)
            } else {
                throw new Error('undefined title')
            }
        } catch (e) {

            console.error(`could not get title from element`, { error: e, properties })
        }
    }

    await fs.writeFile(fileName, JSON.stringify(families))
}

export async function scrapeAllBase() {
    /**
     * 1. Create family
    */
    const familiesData: TaxonomicRecord[] = await fs.readFile(__dirname + '/extracted-family-data.json').then(data => JSON.parse(data.toString()))

    for (const familyData of familiesData) {
        const family = await selectOrCreateFamily(familyData)

        const { data: shallowGenera } = await makeRequest(getAllChildrenURL(family.gbifKey)) as { data: TaxonomicRecord[] }

        /**
         * For genus in shallowGenera
         */
        for (const genus of shallowGenera) {
            /**
             * create genus if valid
             */
            const { data: genusData } = await makeRequest(getDataFromID(genus.key)) as { data: TaxonomicRecord }
            if (genusData.taxonomicStatus === 'ACCEPTED' && genusData.rank === 'GENUS' && genusData.canonicalName) {
                const genusInDB = await selectOrCreateGenus(genusData, family.id)
                const createdSpecies: unknown[] = []

                const { data: genusChildData } = await makeRequest(getAllChildrenURL(genusData.key))

                for (const speciesItem of genusChildData) {
                    const nestedSpeciesData = createSpeciesAndChildren(speciesItem.key, genusInDB.id, family.id)
                }
            }
        }
    }
}

interface Description {
    description: string;
}

interface VernacularName {
    vernacularName: string;
    language?: string; // Optional since some records lack "language"
}

interface HigherClassificationMap {
    [key: string]: string;
}

interface TaxonomicRecord {
    key: number;
    nameKey: number;
    datasetKey: string;
    constituentKey: string;
    nubKey: number;
    parentKey: number;
    parent: string;
    kingdom: string;
    phylum: string;
    order: string;
    family: string;
    genus?: string; // Optional for records that may not have "genus"
    kingdomKey: number;
    phylumKey: number;
    classKey: number;
    orderKey: number;
    familyKey: number;
    genusKey?: number; // Optional for records that may not have "genusKey"
    scientificName: string;
    canonicalName: string;
    authorship: string;
    publishedIn: string;
    nameType: string;
    taxonomicStatus: string;
    rank: string;
    origin: string;
    numDescendants: number;
    numOccurrences: number;
    extinct: boolean;
    habitats: string[];
    nomenclaturalStatus: string[];
    threatStatuses: string[];
    descriptions: Description[];
    vernacularNames: VernacularName[];
    higherClassificationMap: HigherClassificationMap;
    synonym: boolean;
    class: string;
}