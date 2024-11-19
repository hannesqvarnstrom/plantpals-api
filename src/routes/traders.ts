// import { Router } from "express";
// import { requireJwt } from "../middleware/jwt";
// import userService from "../services/user";

// import {
//     postTraderSchema,
//     putTraderSchema,
// } from "./schemas";
// import { validateRequest } from "zod-express-middleware";
// import { validateOwnershipTraders } from "../middleware/ownership";
// import traderService from "../services/trader";

// const tradersRouter = Router();

// tradersRouter.use("/", requireJwt, async (req, _res, next) => {
//     const userId = req.jwtPayload?.userId;
//     if (!userId) {
//         return next(401); // jwt malformed
//     }

//     const user = await userService.getById(userId);
//     req.user = user;

//     next();
// });

// tradersRouter.get("/", async (req, res, next) => {
//     try {
//         const traders = await traderService.getByUser(req.user!);
//         return res.send(traders);
//     } catch (error) {
//         return next(error);
//     }
// });

// tradersRouter.post(
//     "/",
//     validateRequest({ body: postTraderSchema }),
//     async (req, res, next) => {
//         try {
//             const { location, name } = req.body;
//             const newTrader = await traderService.createTrader({
//                 name,
//                 createdBy: req.user!.id,
//                 location,
//             });

//             return res.status(201).send(newTrader);
//         } catch (error) {
//             console.log("error:", error);
//             return next(error);
//         }
//     }
// );

// tradersRouter.put(
//     "/:traderId",
//     validateRequest({ body: putTraderSchema }),
//     validateOwnershipTraders, // fix this
//     async (req, res, next) => {
//         try {
//             const { location, name } = req.body;
//             const updatedTrader = await traderService.updateTrader(
//                 req.params.traderId,
//                 { location, name }
//             );
//             return res.status(201).send(updatedTrader);
//         } catch (err) {
//             console.error("err", err);
//             return next(err);
//         }
//     }
// );

// export default tradersRouter;
