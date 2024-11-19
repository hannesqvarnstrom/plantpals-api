// import testManager from "../../utils/testing"
// import moodRatingService, { JSONTMoodRating } from "../../services/mood-rating"
// import userService from "../../services/user"
// import { postRatingSchema } from "../schemas"
// import { z } from "zod"

// describe('/ratings', () => {
//     beforeAll(async () => {
//         await testManager.setup()
//         await testManager.registerUser()
//     })

//     afterAll(async () => {
//         await testManager.cleanup()
//     })

//     const createMultipleRatingsForUser = async (userId: number) => {
//         const oneHourAgo = new Date()
//         const yesterday = new Date()
//         const dayBeforeYesterday = new Date()

//         oneHourAgo.setUTCHours(oneHourAgo.getUTCHours() - 1)
//         yesterday.setUTCDate(yesterday.getUTCDate() - 1)
//         dayBeforeYesterday.setUTCDate(yesterday.getUTCDate() - 1)

//         const createdRatings = [
//             await moodRatingService.createRating({
//                 userId,
//                 timestamp: dayBeforeYesterday,
//                 value: 1
//             }),
//             await moodRatingService.createRating({
//                 userId,
//                 timestamp: yesterday,
//                 value: 2
//             }),

//             await moodRatingService.createRating({
//                 userId,
//                 timestamp: oneHourAgo,
//                 value: 3
//             }),
//         ]

//         return createdRatings
//     }

//     const getOneMonthAgoAndNowISO = () => {
//         const from = new Date()
//         const to = new Date()

//         from.setMonth(from.getMonth() - 1)

//         return {
//             from: from.toISOString(),
//             to: to.toISOString()
//         }
//     }

//     describe('GET /', () => {
//         const dateStringIsWithinSpan = (dateStr: string, span: { from: string, to: string }) => {
//             const from = new Date(span.from).getTime()
//             const to = new Date(span.to).getTime()
//             const dateToVerify = new Date(dateStr).getTime()

//             return dateToVerify >= from && dateToVerify <= to
//         }

//         it('is protected by jwt', async () => {
//             await testManager.request()
//                 .get('/ratings')
//                 .expect(401)
//         })

//         it('gets ratings in the correct format for user', async () => {
//             const { body } = await testManager.loginUser()
//             const { token, userId } = body
//             const createdRatings = await createMultipleRatingsForUser(userId)

//             const { body: ratings } = await testManager.request()
//                 .get('/ratings')
//                 .query(getOneMonthAgoAndNowISO())
//                 .set('Authorization', 'Bearer ' + token)
//                 .expect(200)

//             for (let i = 0; i < ratings.length; i++) {
//                 const expectedRating = {
//                     ...createdRatings[i],
//                     timestamp: new Date(createdRatings[i]!.timestamp).toISOString()
//                 }
//                 expect(ratings[i]).toEqual(expectedRating)
//             }
//         })

//         it('gets latest ratings for the auth-ed user ONLY', async () => {
//             const secondUserDetails = { email: 'seconduser@test.com', password: '123456', passwordConfirmation: '123456' }
//             const { body: secondUser } = await testManager.registerUser({ payload: secondUserDetails })
//             const createdRatingsUser2 = await createMultipleRatingsForUser(secondUser.id)

//             // (Make sure there are other mood ratings so the test COULD fail)
//             const otherUser = await userService.getById(secondUser.id - 1)
//             const otherUsersRatings = await moodRatingService.getByUser(otherUser)
//             expect(otherUsersRatings.length >= 1)

//             const { body } = await testManager.loginUser({
//                 payload: {
//                     email: secondUserDetails.email,
//                     password: secondUserDetails.password
//                 }
//             })

//             const { body: fetchedRatings } = await testManager.request()
//                 .get('/ratings')
//                 .set('Authorization', 'Bearer ' + body.token)
//                 .query(getOneMonthAgoAndNowISO())
//                 .expect(200)

//             for (let i = 0; i < fetchedRatings.length; i++) {
//                 const expectedRating = {
//                     ...createdRatingsUser2[i],
//                     timestamp: createdRatingsUser2[i]!.timestamp.toISOString()
//                 }
//                 expect(fetchedRatings[i]).toEqual(expectedRating)
//                 expect(fetchedRatings[i].userId).toBe(secondUser.id) // double ensure

//             }
//         })

//         it('gets ratings for the timespan specifically', async () => {
//             const oldTimeStamp = new Date()
//             oldTimeStamp.setTime(100) // way back in the 70s
//             const newRating = await moodRatingService.createRating({
//                 userId: 1,
//                 timestamp: oldTimeStamp,
//                 value: 10
//             })

//             const allRatings = await moodRatingService.getByUser(1)
//             expect(allRatings.find((r) => r.id === newRating.id)).toBeTruthy()

//             const { body: loginBody } = await testManager.loginUser()
//             const dateSpanStrings = getOneMonthAgoAndNowISO()
//             const response = await testManager.request().get('/ratings')
//                 .set('Authorization', 'Bearer ' + loginBody.token)
//                 .query(dateSpanStrings)
//                 .expect(200)

//             /**
//              * @todo rename this and maybe just change it
//              */
//             const ratings: JSONTMoodRating[] = response.body

//             for (const rating of ratings) {
//                 expect(typeof rating.id === 'number').toBeTruthy()
//                 expect(rating.id !== newRating.id).toBeTruthy()
//                 expect(dateStringIsWithinSpan(rating.timestamp, dateSpanStrings)).toBeTruthy()
//             }
//         })
//     })

//     /**
//      * @note
//      * The actual averages and outputs are tested within MoodRatingService test suite
//      */
//     describe('GET /average', () => {
//         it('is protected by jwt', async () => {
//             await testManager.request()
//                 .get('/ratings/average')
//                 .expect(401)
//         })

//         it('gets ratings in the correct format for user', async () => {
//             const { body } = await testManager.loginUser()
//             const { token, userId } = body

//             const createdRatings = await createMultipleRatingsForUser(userId)

//             const { body: ratings } = await testManager.request()
//                 .get('/ratings/average')
//                 .query(getOneMonthAgoAndNowISO())
//                 .set('Authorization', 'Bearer ' + token)
//                 .expect(200)

//             const expectedValues = [
//                 { date: createdRatings[0]!.timestamp.toDateString(), rating: 1 },
//                 { date: createdRatings[1]!.timestamp.toDateString(), rating: 2 },
//                 { date: createdRatings[2]!.timestamp.toDateString(), rating: 3 },
//             ]

//             for (let i = 0; i < ratings.length; i++) {
//                 const rating = ratings[i]
//                 expect(rating).toHaveProperty('date')
//                 expect(rating).toHaveProperty('rating')
//                 expect(rating).toEqual(expectedValues[i])
//             }
//         })
//     })

//     describe('POST', () => {
//         it('is protected by jwt', async () => {
//             await testManager.request()
//                 .post('/ratings')
//                 .expect(401)
//         })

//         it('creates a new rating for the auth-ed user', async () => {
//             const { body } = await testManager.loginUser()
//             const { token } = body

//             const newRatingBody: z.infer<typeof postRatingSchema> = { value: 10 }

//             await testManager.request().post('/ratings')
//                 .set('Authorization', 'Bearer ' + token)
//                 .send(newRatingBody)
//                 .expect(201)
//         })

//         it('returns the new rating', async () => {
//             const { body } = await testManager.loginUser()
//             const { token, userId } = body

//             const newRatingBody: z.infer<typeof postRatingSchema> = { value: 10 }

//             const { body: newRating } = await testManager.request().post('/ratings')
//                 .set('Authorization', 'Bearer ' + token)
//                 .send(newRatingBody)

//             expect(newRating.value).toBe(newRatingBody.value)
//             expect(newRating.userId).toBe(userId)

//             expect(newRating.timestamp).toBeTruthy()
//             expect(newRating.id).toBeTruthy()
//         })

//         it('validates the request body', async () => {
//             const { body } = await testManager.loginUser()
//             const { token } = body

//             const badRequestBodies = [
//                 {},
//                 { value: '' },
//                 { value: 12 },
//                 { value: 0 },
//                 { value: -1 },
//                 { value: null },
//                 { value: 5, otherKey: 'SomeWeirdValue' },
//                 { otherKey: 'SomeWeirdValue' },
//             ]

//             for (const badReqBody of badRequestBodies) {
//                 await testManager.request().post('/ratings')
//                     .send(badReqBody)
//                     .set('Authorization', 'Bearer ' + token)
//                     .expect(400)
//             }
//         })

//         it('sets the users lastLogAt to a new time', async () => {
//             const { body } = await testManager.loginUser()
//             const { token, userId } = body

//             const { lastLogAt: lastLogAtBefore } = await userService.getById(userId)
//             expect(lastLogAtBefore).toBeTruthy()
//             const newRatingBody: z.infer<typeof postRatingSchema> = { value: 10 }

//             await testManager.request().post('/ratings')
//                 .set('Authorization', 'Bearer ' + token)
//                 .send(newRatingBody)
//                 .expect(201)

//             const { lastLogAt: lastLogAtAfter } = await userService.getById(userId)
//             expect(lastLogAtAfter).toBeTruthy()

//             expect(lastLogAtAfter!.getTime()).toBeGreaterThan(lastLogAtBefore!.getTime())
//         })
//     })

// })