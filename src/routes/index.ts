import { Router } from "express";

import envVars from "../utils/environment";
import authRouter from "./auth";
import interestsRouter from "./interests";
import plantsRouter from "./plants";
import taxonomyRouter from "./taxonomy";
import tradingRouter from "./trading";
import usersRouter from "./users";

const router = Router();

router.use((_req, res, next) => {
	res.set("content-type", "application/json");
	if (envVars.isDev()) {
		console.log("Getting request at url", _req.url);
	}

	next();
});

router.get("/", (_req, res) => {
	res.send({ message: "Welcome to MoodLogger!" });
});

router.use("/users", usersRouter);

router.use("/plants", plantsRouter);

router.use("/auth", authRouter);

router.use("/taxonomy", taxonomyRouter);

router.use("/trading", tradingRouter);

router.use("/interests", interestsRouter);

export default router;
