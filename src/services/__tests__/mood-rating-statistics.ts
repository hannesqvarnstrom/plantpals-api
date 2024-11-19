// import { MAX_RATING_VALUE, TMoodRating } from "../../models/mood-rating"
// import { AverageMoodRatingForDay, MoodRatingStatistics } from "../mood-rating"

// describe('MoodRatingStatistics', () => {
//     it('ratingIsAverage can tell difference between ratings and average ratings', () => {
//         const rating: TMoodRating = { value: 3, timestamp: new Date(), id: 1, userId: 1 }
//         const isAverage = MoodRatingStatistics.ratingIsAverage(rating)
//         expect(isAverage).toBe(false)

//         const averageRating: AverageMoodRatingForDay = { date: new Date().toDateString(), rating: 3 }
//         const isAverage2 = MoodRatingStatistics.ratingIsAverage(averageRating)
//         expect(isAverage2).toBe(true)
//     })

//     it('getAverageRatingPerDay returns average rating for each day', () => {
//         const ratings = moodRatingFactory()
//         const averageRatings = MoodRatingStatistics.getAverageRatingPerDay(ratings)
//         for (const averageRating of averageRatings) {
//             const { date, rating } = averageRating
//             const dateOfRating = new Date(date)
//             const dayRatings = ratings.filter(rating => rating.timestamp.toDateString() === dateOfRating.toDateString())
//             const average = dayRatings.reduce((acc, rating) => acc + (rating?.value ?? 0), 0) / dayRatings.length
//             expect(average).toBe(rating)
//         }
//     })

//     it('getAverageRatingPerDay returns empty array if no ratings', () => {
//         const averageRatings = MoodRatingStatistics.getAverageRatingPerDay([])
//         expect(averageRatings.length).toBe(0)
//     })

//     // it('fillEmptyDays fills with empty ratings for regular MoodRatings', async () => {

//     // })

//     it('fillEmptyDays fills with empty average ratings for average ratings', async () => {
//         const spottyRatingStatistics: AverageMoodRatingForDay[] = [
//             { date: 'Thu Jul 27 2023', rating: 3 },
//             { date: 'Sun Jul 30 2023', rating: 6.333333333333333 },
//             { date: 'Tue Aug 01 2023', rating: 5 },
//             { rating: 5.1, date: 'Thu Aug 03 2023' }
//         ]

//         const expectedResultAfterFill: AverageMoodRatingForDay[] = [
//             { date: 'Thu Jul 27 2023', rating: 3 },
//             { date: 'Fri Jul 28 2023', rating: null },
//             { date: 'Sat Jul 29 2023', rating: null },
//             { date: 'Sun Jul 30 2023', rating: 6.333333333333333 },
//             { date: 'Mon Jul 31 2023', rating: null },
//             { date: 'Tue Aug 01 2023', rating: 5 },
//             { date: 'Wed Aug 02 2023', rating: null },
//             { date: 'Thu Aug 03 2023', rating: 5.1 }
//         ]

//         const actualFillResult = MoodRatingStatistics.insertMissingDays(spottyRatingStatistics)

//         expect(actualFillResult).toEqual(expectedResultAfterFill)
//     })
// })

// function moodRatingFactory(dateRange = 7, userId: number = 1): TMoodRating[] {
//     const weekOfRatings: TMoodRating[] = []
//     let id = 1

//     for (let i = 0; i < dateRange; i++) {
//         const daysRatings: TMoodRating[] = []
//         const startOfDay = new Date()

//         startOfDay.setUTCHours(10, 0, 0, 0)
//         startOfDay.setDate(startOfDay.getDate() - i)

//         const amountOfRatings = Math.round(Math.random() * 3)
//         for (let j = 0; j < amountOfRatings; j++) {
//             const timestamp = new Date(startOfDay.getTime() + j * 60 * 60 * 1000)
//             const value = Math.round(Math.random() * MAX_RATING_VALUE)
//             daysRatings.push({ id, userId, timestamp, value })
//             id++
//         }
//         if (daysRatings.length) {
//             weekOfRatings.push(...daysRatings)
//         }
//     }

//     return weekOfRatings
// }
