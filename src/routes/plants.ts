// import { Router } from 'express'
// import { requireJwt } from '../middleware/jwt'
// import userService from '../services/user'
// import plantService, { PlantUpdateArgs } from '../services/plant'
// import { postPlantSchema, putPlantSchema } from './schemas'
// import { validateRequest } from 'zod-express-middleware'
// import { validateOwnership } from '../middleware/ownership'
// import { ShallowPlant } from '../models/plant'
// import { AppError } from '../utils/errors'

// const plantsRouter = Router()

// plantsRouter.use('/', requireJwt, async (req, _res, next) => {
//     const userId = req.jwtPayload?.userId
//     if (!userId) {
//         return next(401) // jwt malformed
//     }

//     const user = await userService.getById(userId)
//     req.user = user

//     next()
// })

// plantsRouter.get('/', async (req, res, next) => {
//     try {
//         const plants = await plantService.getByUser(req.user!)
//         return res.send(plants)
//     } catch (error) {
//         return next(error)
//     }
// })

// plantsRouter.post('/',
//     // validateRequest({ body: postPlantSchema }),
//     async (req, res, next) => {
//         try {
//             const { fontSize, name, location, fromTrader, type } = postPlantSchema.parse(req.body)// req.body
//             const newPlant = await plantService.createPlant({
//                 fontSize, name, userId: req.user!.id, location, fromTrader:
//                     (!fromTrader || fromTrader === 'none') ? null : Number(fromTrader),
//                 type
//             })

//             return res.status(201).send(newPlant)
//         } catch (error) {
//             console.log('error:', error)
//             return next(error)
//         }
//     })

// plantsRouter.put('/:plantId',
//     // validateRequest({ body: putPlantSchema }),
//     validateOwnership,
//     async (req, res, next) => {
//         try {
//             const { fontSize, name, location, fromTrader, type } = putPlantSchema.parse(req.body)//req.body
//             let validatedName
//             if (name) {
//                 validatedName = validateName(name as ClientNamePayload)
//             }
//             const updateArgs: PlantUpdateArgs = {
//                 fontSize, type,
//             }

//             if (fromTrader === 'none') {
//                 updateArgs.fromTrader = null
//             } else if (fromTrader) {
//                 updateArgs.fromTrader = Number(fromTrader)
//             }

//             if (name) {
//                 updateArgs.name = validateName(name as ClientNamePayload)
//             }
//             if (location || location === null || location === '') {
//                 updateArgs.location = location
//             }

//             const updatedPlant = await plantService.updatePlant(req.params.plantId, updateArgs)
//             return res.status(200).send(updatedPlant)
//         } catch (err) {
//             console.error('err', err)
//             return next(err)
//         }
//     })

// export default plantsRouter

// type ClientNamePayload = Partial<ShallowPlant['name']> & {
//     name1a?: {
//         species?: boolean,
//         name?: string
//     },
//     name1b?: {
//         species?: boolean,
//         name?: string
//     },
//     name2a?: {
//         species?: boolean,
//         name?: string
//     },
//     name2b?: {
//         species?: boolean,
//         name?: string
//     },
// }

// function validateName(name: Partial<ShallowPlant['name']>): ShallowPlant['name'] {
//     const { genusName, speciesName, varietyName, name1a, name1b, name2a, name2b } = name
//     if (!genusName) throw new AppError('Missing genus name', 400)

//     const validatedName: ShallowPlant['name'] = {
//         genusName,
//         speciesName,
//         varietyName,
//     }

//     const name1aValidated = name1a
//     if (name1aValidated) {
//         const name1aValid = name1aValidated.name && name1aValidated.species !== undefined
//         if (!name1aValid) {
//             throw new AppError('Name1a invalid', 400)
//         }
//         validatedName.name1a = name1aValidated
//     }

//     const name1bValidated = name1b
//     if (name1bValidated) {
//         const name1bValid = name1bValidated.name && name1bValidated.species !== undefined
//         if (!name1bValid) {
//             throw new AppError('Name1b invalid', 400)
//         }
//         validatedName.name1b = name1bValidated
//     }

//     const name2aValidated = name2a
//     if (name2aValidated) {
//         const name2aValid = name2aValidated.name && name2aValidated.species !== undefined
//         if (!name2aValid) {
//             throw new AppError('Name2a invalid', 400)
//         }
//         validatedName.name2a = name2aValidated
//     }

//     const name2bValidated = name2b
//     if (name2bValidated) {
//         const name2bValid = name2bValidated.name && name2bValidated.species !== undefined
//         if (!name2bValid) {
//             throw new AppError('Name2b invalid', 400)
//         }
//         validatedName.name2b = name2bValidated
//     }

//     return validatedName
// }

