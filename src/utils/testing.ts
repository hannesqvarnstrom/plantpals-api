import { Express } from 'express-serve-static-core'
import envVars from './environment'
import dbManager from '../db'
import makeServer from './server'
import sinon from 'ts-sinon'
import request from 'supertest'
import { SchemaInterface, loginSchema, registerSchema } from '../routes/schemas'

/**
 * Singleton class that is used in test suites.
 * Before using any other methods in the class, setup() must be awaited
 * 
 */
export class TestManager {
    public server: Express
    public running = false

    async resetDB() {
        await dbManager.refreshConnection()
        await dbManager.migrateLatest()
    }

    async resetEnvVars() {
        const testEnvVars = {
            'DB_CONNECTION': envVars.get('DB_TEST_CONNECTION'),
            'NODE_ENV': 'test'
        }

        envVars.overrideBulk(testEnvVars)
    }

    async setup(): Promise<TestManager> {
        await this.resetDB()
        await this.resetEnvVars()

        if (this.running) {
            return this
        }

        const server = await makeServer()
        this.server = server

        this.running = true
        return this
    }

    public async cleanup() {
        if (!this.running) { return }

        await dbManager.truncateTables()
        await dbManager.pool.end()
        envVars.restore()
        sinon.restore()
    }

    request() {
        if (!this.running) {
            throw new Error('TestManager.server not running. Exiting')
        }

        return request(this.server)
    }

    public async registerUser(
        options: TestRequestOptions<SchemaInterface<typeof registerSchema>> = {}
    ) {
        const defaultBody: SchemaInterface<typeof registerSchema> = { email: 'hejhej@something.se', password: '123456', passwordConfirmation: '123456' }

        const req = this.request().post('/register')
            .set('Content-Type', 'application/json')
            .send(options.payload || defaultBody)
            .expect(options.expectStatus || 201)

        return req
    }


    public async loginUser(options: TestRequestOptions<SchemaInterface<typeof loginSchema>> = {}) {
        const defaultBody: SchemaInterface<typeof loginSchema> = { email: 'hejhej@something.se', password: '123456' }
        const req = this.request().post('/login')
            .set('Content-Type', 'application/json')
            .send(options.payload || defaultBody)
            .expect(options.expectStatus || 200)

        return req
    }
}


interface TestRequestOptions<O extends object> {
    payload?: O,
    expectStatus?: number,
    queryParams?: Record<string, string>
}


const testManager = new TestManager()
export default testManager
