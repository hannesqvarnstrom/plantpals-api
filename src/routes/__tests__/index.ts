import dbManager from '../../db'
import { federatedIdentities, users } from '../../db/schema'
import { SchemaInterface, updateMeSchema } from '../schemas'
import { and, eq } from 'drizzle-orm'
import oauthService from '../../services/oauth'
import sinon from 'ts-sinon'

import testManager from '../../utils/testing'

afterAll(async () => {
    await testManager.cleanup()
})


beforeAll(async () => {
    await testManager.setup()
})

describe('GET /', () => {
    it('should return a welcome message when getting root', async () => {
        const res = await testManager.request()
            .get('/')
            .expect('Content-Type', /json/)
            .expect(200)

        expect(res.body).toMatchObject({ message: 'Welcome to MoodLogger!' })
    })
})

describe('POST users', () => {
    it('create new user with password', async () => {
        const res = await testManager.request()
            .post('/register')
            .set('Content-Type', 'application/json')
            .send({ email: 'hejhej@something.se', password: '123456', passwordConfirmation: '123456' })
            .expect('Content-Type', /json/)
            .expect(201)

        expect(res.body.email).toBe('hejhej@something.se')
    })

    it('should throw on missing parameters', async () => {
        const data = [
            { email: 'hejhej@something.se', password: '123456' },
            { email: 'invalid_email' },
            { password: 'short' },
            { password: '123456', passwordConfirmation: '1234567', email: 'hejhej@something.se' },
            {},
        ]

        for (const body of data) {
            await testManager.request()
                .post('/register')
                .send(body)
                .expect('Content-Type', /json/)
                .expect(400)
        }
    })

})

describe('DatabaseManager', () => {
    it('should connect and be able to query successfully', async () => {
        await dbManager.truncateTables()
        const result = await dbManager.db.select().from(users)
        expect(result.length).toBe(0)
    })
})

describe('Authentication', () => {
    it('should return a valid payload when correctly logging in', async () => {
        await testManager.registerUser()
        const loginResult = await testManager.loginUser()

        const { expiresIn, expiresAt, token } = loginResult.body
        expect(![expiresIn, expiresAt, token].some(x => !x)).toBeTruthy()
        expect(expiresIn).toBe(3600 * 24)
        expect(expiresAt > new Date().getTime()).toBeTruthy()
        expect(token.length > 15).toBeTruthy() // idk
    })

    it('should require correct password when logging in', async () => {
        const badPasswords = [
            ' 123456', '1234567', 'a123456', '', ' '
        ]
        for (const pw of badPasswords) {
            await testManager.loginUser({ payload: { email: 'hejhej@something.se', password: pw }, expectStatus: 400 })
        }
    })

    it('should allow access to protected routes if token is valid', async () => {
        const loginResult = await testManager.loginUser()
        const protectedData = await testManager.request()
            .get('/me')
            .set('Content-Type', 'application/json')
            .set('Authorization', 'Bearer ' + loginResult.body.token)
            .expect(200)

        expect(!!protectedData.body.me.email).toBeTruthy()
    })
    it('should barr access to protected routes if token is (somehow) invalid', async () => {
        await testManager.request()
            .get('/me')
            .set('Content-Type', 'application/json')
            .set('Authorization', 'Bearer BADTOKEN123123')
            .expect(401)
    })

    describe('Oauth', () => {

        describe('Client initiated', () => {
            let oauthVerifyTokenStub: sinon.SinonStub
            const email = 'newuser@example.com'
            const providerToken = 'abc.abc.abc'
            const gId = '123'

            beforeAll(async () => {
                sinon.restore()
                oauthVerifyTokenStub = sinon.stub(oauthService, 'verifyGoogleToken').resolves({ email: email, id: gId })
            })
            afterAll(async () => {
                oauthVerifyTokenStub.restore()
            })

            beforeEach(async () => {
                await dbManager.truncateTables()
            })

            it('validates post body', async () => {
                const badPayloads = [
                    {},
                    { providerToken: '' },
                    { badKey: 'asd' },
                    { providerToken: 'abc' },
                    { providerToken: 'abc.abc' },
                ]

                for (const badPayload of badPayloads) {
                    await testManager.request()
                        .post('/auth/google')
                        .send(badPayload)
                        .expect(400)
                }
            })

            it('creates a new user + identity if completely new user', async () => {
                const existingUser = await dbManager.db.select().from(users).where(eq(users.email, email))
                expect(existingUser.length).toBe(0)

                await testManager.request()
                    .post('/auth/google')
                    .send({ providerToken })
                    .expect(200)

                const newUser = await dbManager.db.select().from(users).where(eq(users.email, email))
                expect(newUser.length).toBe(1)

                const newIdentity = await dbManager.db.select().from(federatedIdentities)
                    .where(
                        and(
                            eq(federatedIdentities.providerId, '123'),
                            eq(federatedIdentities.provider, 'GOOGLE'),
                            eq(federatedIdentities.userId, newUser[0]!.id)
                        )
                    )

                expect(newIdentity.length).toBe(1)
            })

            it('prompts normal login if user already exists', async () => {
                await testManager.registerUser({
                    payload: {
                        email,
                        password: '123456',
                        passwordConfirmation: '123456'
                    }
                })

                const userExists = await dbManager.db.select().from(users).where(eq(users.email, email))
                expect(userExists.length).toBe(1)

                const response = await testManager.request()
                    .post('/auth/google')
                    .send({ providerToken })
                    .expect(200)

                expect(response.body.action).toBe('prompt_normal_login')

                const wasIdentityCreated = await dbManager.db.select().from(federatedIdentities).where(and(eq(federatedIdentities.providerId, gId), eq(federatedIdentities.provider, 'GOOGLE'), eq(federatedIdentities.userId, userExists[0]!.id)))
                expect(wasIdentityCreated.length).toBe(0)
            })

            it('returns token if user + identity exists', async () => {
                const creationResponse = await testManager.request()
                    .post('/auth/google')
                    .send({ providerToken })
                    .expect(200)

                expect(creationResponse.body.token).toBeTruthy()

                const user = await dbManager.db.select().from(users).where(eq(users.email, email))
                expect(user.length).toBe(1)

                const identity = await dbManager.db.select().from(federatedIdentities).where(
                    and(
                        eq(federatedIdentities.providerId, gId),
                        eq(federatedIdentities.provider, 'GOOGLE'),
                        eq(federatedIdentities.userId, user[0]!.id),
                    ),
                )
                expect(identity.length).toBe(1)

                const loginResponse = await testManager.request()
                    .post('/auth/google')
                    .send({ providerToken })
                    .expect(200)

                expect(loginResponse.body.token).toBeTruthy()
            })
        })
    })
})

describe('/me', () => {
    let user: { email: string, password: string }

    beforeAll(async () => {
        user = {
            email: 'hejhej@something.se',
            password: '123456'
        }

        await testManager.registerUser({
            payload: {
                email: user.email,
                password: user.password,
                passwordConfirmation: user.password
            }
        })
    })
    it('GET', async () => {
        const loginResult = await testManager.loginUser()
        const protectedData = await testManager.request()
            .get('/me')
            .set('Content-Type', 'application/json')
            .set('Authorization', 'Bearer ' + loginResult.body.token)
            .expect(200)
        expect(protectedData.body.me.email).toBe('hejhej@something.se')
        expect(protectedData.body.me.id).toBeTruthy()
        expect(protectedData.body.me.lastLogAt).toBe(null)
    })

    it('PUT', async () => {
        const email = 'hejhej@something.se'
        const oldPassword = '123456'
        const newPassword = '1234567'
        const payload: SchemaInterface<typeof updateMeSchema> = { oldPassword, newPassword, newPasswordConfirmation: newPassword }

        await testManager.request()
            .put('/me')
            .send(payload)
            .expect(401)

        const loginData = await testManager.loginUser()
        const result = await testManager.request()
            .put('/me')
            .set('Authorization', 'Bearer ' + loginData.body.token)
            .send(payload)
            .expect(201)

        expect(result.body.updatedMe.email).toBe(email)

        await testManager.loginUser({ payload: { email, password: oldPassword }, expectStatus: 400 })

        return testManager.loginUser({ payload: { email, password: newPassword } })
    })

    it('PUT validation', async () => {
        const badPayloads = [
            {
                oldPassword: 'wrongOldPassword',
                newPassword: '123456',
                newPasswordConfirmation: '123456'
            },
            {
                // oldPassword missing
                newPassword: '123456',
                newPasswordConfirmation: '123456'
            },
            {
                oldPassword: '1234567',
                newPassword: '123456',
                newPasswordConfirmation: 'notTheSame'
            },
            {
                oldPassword: '1234567',
                // missing new
            },
            {
                oldPassword: '1234567',
                newPassword: '123456'
            },
            {
                oldPassword: '1234567',
                newPasswordConfirmation: '123456'
            }
        ]
        const loginData = await testManager.loginUser({ payload: { email: 'hejhej@something.se', password: '1234567' } })
        for (const badPayload of badPayloads) {
            await testManager.request()
                .put('/me')
                .send(badPayload)
                .set('Authorization', 'Bearer ' + loginData.body.token)
                .expect(400)
        }
    })
})
