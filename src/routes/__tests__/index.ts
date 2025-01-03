import { and, eq } from "drizzle-orm";
import sinon from "ts-sinon";
import dbManager from "../../db";
import { federatedIdentities, users } from "../../db/schema";
import oauthService from "../../services/oauth";
import type { SchemaInterface, updateMeSchema } from "../schemas";

import testManager from "../../utils/testing";

afterAll(async () => {
	await testManager.cleanup();
});

beforeAll(async () => {
	await testManager.setup();
});

describe("GET /", () => {
	it("should return a welcome message when getting root", async () => {
		const res = await testManager
			.request()
			.get("/")
			.expect("Content-Type", /json/)
			.expect(200);

		expect(res.body).toMatchObject({ message: "Welcome to MoodLogger!" });
	});
});

describe("POST users", () => {
	it("create new user with password", async () => {
		const res = await testManager
			.request()
			.post("/auth/register")
			.set("Content-Type", "application/json")
			.send({
				username: "someuser1223",
				email: "hejhej@something.se",
				password: "123456",
				passwordConfirmation: "123456",
			})
			.expect("Content-Type", /json/)
			.expect(201);
		console.log(res.body);

		expect(res.body.id).toBe(1);
		expect(res.body.username).toBe("someuser1223");
	});

	it("should throw on missing parameters", async () => {
		const data = [
			{ email: "hejhej@something.se", password: "123456" },
			{
				email: "hejhej@something.se",
				password: "123456",
				username: "someuser1223",
			},
			{ email: "invalid_email" },
			{ password: "short" },
			{
				password: "123456",
				passwordConfirmation: "1234567",
				email: "hejhej@something.se",
			},
			{},
		];

		for (const body of data) {
			await testManager
				.request()
				.post("/auth/register")
				.send(body)
				.expect("Content-Type", /json/)
				.expect(400);
		}
	});
});

describe("DatabaseManager", () => {
	it("should connect and be able to query successfully", async () => {
		await dbManager.truncateTables();
		const result = await dbManager.db.select().from(users);
		expect(result.length).toBe(0);
	});
});

describe("Authentication", () => {
	it("should return a valid payload when correctly logging in", async () => {
		await testManager.registerUser();
		const loginResult = await testManager.loginUser();

		const { token, userId, expiry } = loginResult.body;

		expect(token.length > 15).toBeTruthy(); // idk
		expect(new Date(expiry).getTime()).toBeGreaterThan(new Date().getTime());
		expect(userId).toBeDefined();
	});

	it("should require correct password when logging in", async () => {
		const badPasswords = [" 123456", "1234567", "a123456", "", " "];
		for (const pw of badPasswords) {
			await testManager.loginUser({
				payload: { email: "hejhej@something.se", password: pw },
				expectStatus: 400,
			});
		}
	});

	it("should allow access to protected routes if token is valid", async () => {
		const loginResult = await testManager.loginUser();
		const protectedData = await testManager
			.request()
			.get("/users/me")
			.set("Content-Type", "application/json")
			.set("Authorization", `Bearer ${loginResult.body.token}`)
			.expect(200);

		expect(!!protectedData.body.userInfo.id).toBeTruthy();
	});
	it("should barr access to protected routes if token is (somehow) invalid", async () => {
		await testManager
			.request()
			.get("/users/me")
			.set("Content-Type", "application/json")
			.set("Authorization", "Bearer BADTOKEN123123")
			.expect(401);
	});

	describe("Oauth", () => {
		describe("Client initiated", () => {
			let oauthVerifyTokenStub: sinon.SinonStub;
			const email = "newuser@example.com";
			const providerToken = "abc.abc.abc";
			const gId = "123";

			beforeAll(async () => {
				sinon.restore();
				oauthVerifyTokenStub = sinon
					.stub(oauthService, "verifyGoogleToken")
					.resolves({ email: email, id: gId });
			});
			afterAll(async () => {
				oauthVerifyTokenStub.restore();
			});

			beforeEach(async () => {
				await dbManager.truncateTables();
			});

			it("validates post body", async () => {
				const badPayloads = [
					{},
					{ providerToken: "" },
					{ badKey: "asd" },
					{ providerToken: "abc" },
					{ providerToken: "abc.abc" },
				];

				for (const badPayload of badPayloads) {
					await testManager
						.request()
						.post("/auth/google")
						.send(badPayload)
						.expect(400);
				}
			});

			it("creates a new user + identity if completely new user", async () => {
				const existingUser = await dbManager.db
					.select()
					.from(users)
					.where(eq(users.email, email));
				expect(existingUser.length).toBe(0);

				await testManager
					.request()
					.post("/auth/google")
					.send({ providerToken })
					.expect(200);

				const [newUser, ..._] = await dbManager.db
					.select()
					.from(users)
					.where(eq(users.email, email));

				expect(newUser).toBeDefined();
				const userId = newUser?.id as number;
				const newIdentity = await dbManager.db
					.select()
					.from(federatedIdentities)
					.where(
						and(
							eq(federatedIdentities.providerId, "123"),
							eq(federatedIdentities.provider, "GOOGLE"),
							eq(federatedIdentities.userId, userId),
						),
					);

				expect(newIdentity.length).toBe(1);
			});

			it("prompts normal login if user already exists", async () => {
				await testManager.registerUser({
					payload: {
						username: "someuser123",
						email,
						password: "123456",
						passwordConfirmation: "123456",
					},
				});

				const [userThatExists, ..._] = await dbManager.db
					.select()
					.from(users)
					.where(eq(users.email, email))
					.execute();

				expect(userThatExists).toBeDefined();
				const userId = userThatExists?.id as number;

				const response = await testManager
					.request()
					.post("/auth/google")
					.send({ providerToken })
					.expect(200);

				expect(response.body.action).toBe("prompt_normal_login");
				const wasIdentityCreated = await dbManager.db
					.select()
					.from(federatedIdentities)
					.where(
						and(
							eq(federatedIdentities.providerId, gId),
							eq(federatedIdentities.provider, "GOOGLE"),
							eq(federatedIdentities.userId, userId),
						),
					);
				expect(wasIdentityCreated.length).toBe(0);
			});

			it("returns token if user + identity exists", async () => {
				const creationResponse = await testManager
					.request()
					.post("/auth/google")
					.send({ providerToken })
					.expect(200);

				expect(creationResponse.body.token).toBeTruthy();

				const [user, ..._] = await dbManager.db
					.select()
					.from(users)
					.where(eq(users.email, email));
				expect(user).toBeDefined();
				const userId = user?.id as number;

				const identity = await dbManager.db
					.select()
					.from(federatedIdentities)
					.where(
						and(
							eq(federatedIdentities.providerId, gId),
							eq(federatedIdentities.provider, "GOOGLE"),
							eq(federatedIdentities.userId, userId),
						),
					);
				expect(identity.length).toBe(1);

				const loginResponse = await testManager
					.request()
					.post("/auth/google")
					.send({ providerToken })
					.expect(200);

				expect(loginResponse.body.token).toBeTruthy();
			});
		});
	});
});
