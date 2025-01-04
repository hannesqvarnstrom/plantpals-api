import type { NextFunction, Request, Response } from "express";
import type { ZodError } from "zod";
import envVars from "../utils/environment";

export const errorHandler = (
	err: any,
	_req: Request,
	res: Response,
	next: NextFunction,
) => {
	if (!err) {
		return next();
	}

	if (envVars.isDev()) {
		console.error("err:", err);
	}

	if (isValidationError(err)) {
		let message = "ValidationError: ";
		for (const errorItem of err.errors) {
			message += `${errorItem.path[0]}: ${errorItem.code}, `;
		}
		const status = 400;
		return res.status(status).json({
			status,
			message,
		});
	}
	err.status = err.status || "error";
	err.statusCode = err.statusCode || 500;

	return res.status(err.statusCode).send(JSON.stringify(err.message));
};

function isValidationError(err: unknown): err is ZodError {
	return !!(
		(err as { errors: unknown })?.errors && (err as { issues: unknown })?.issues
	);
}
