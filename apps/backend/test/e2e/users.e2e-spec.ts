import { EntityManager, MikroORM } from "@mikro-orm/core";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { User } from "../../src/entities";
import { LoggerService } from "../../src/logger/logger.service";
import { AppTestModule } from "../app-test.module";
import { TestUserHelper } from "./helpers";
import { mockLoggerService } from "./helpers/logger-mock";
import { TestUser } from "./helpers/test-user.type";

describe("UsersController (e2e)", () => {
  let app: INestApplication;
  let em: EntityManager;
  let orm: MikroORM;
  let userHelper: TestUserHelper;

  // Base test user data
  const baseTestUser = {
    password: "password123",
  };

  // For password change test
  const newPassword = "newPassword123";

  const testUserUpdate = {
    nickname: "UpdatedUser",
    imageUrl: "https://example.com/image.jpg",
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    })
      .overrideProvider(LoggerService)
      .useValue(mockLoggerService)
      .compile();

    app = moduleFixture.createNestApplication();
    em = app.get<EntityManager>(EntityManager);
    orm = app.get<MikroORM>(MikroORM);

    await orm.getSchemaGenerator().refreshDatabase();
    // Apply the same middleware and pipes as in main.ts
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    // Initialize the TestUserHelper
    userHelper = new TestUserHelper(app, {
      basePassword: baseTestUser.password,
      prefix: "users-",
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await orm.close();
  });

  // ATDD style - Acceptance criteria grouped by features
  describe("Feature: User Registration", () => {
    let testUser: TestUser;

    beforeAll(async () => {
      const result = await userHelper.createTestUser(1);
      testUser = result.user;
    });

    it("Scenario: User signs up with valid credentials", async () => {
      // Given a user with valid credentials
      const userData = {
        email: `new-${Date.now()}@example.com`,
        password: baseTestUser.password,
        nickname: `NewUser${Date.now()}`,
      };

      // When they sign up
      const response = await request(app.getHttpServer())
        .post("/api/auth/signup")
        .send(userData)
        .expect(201);

      // Then they should receive a successful response with user data
      expect(response.body).toBeDefined();
      expect(response.body.id).toBeDefined();
      expect(response.body.email).toBe(userData.email);
      expect(response.body.nickname).toBe(userData.nickname);
    });

    it("Scenario: User tries to sign up with existing email", async () => {
      // Given a user with an email that already exists

      // When they try to sign up
      const response = await request(app.getHttpServer())
        .post("/api/auth/signup")
        .send({
          email: testUser.email,
          password: testUser.password,
          nickname: testUser.nickname,
        })
        .expect(409); // Conflict

      // Then they should receive an error
      expect(response.body.message).toContain("already exists");
    });

    it("Scenario: User tries to sign up with invalid data", async () => {
      // Given invalid user data (missing required fields)
      const invalidUser = {
        email: "invalid@example.com",
        // Missing password and nickname
      };

      // When they try to sign up
      const response = await request(app.getHttpServer())
        .post("/api/auth/signup")
        .send(invalidUser)
        .expect(400); // Bad Request

      // Then they should receive validation errors
      expect(response.body.message).toBeInstanceOf(Array);
    });
  });

  describe("Feature: User Profile Management", () => {
    let testUser: TestUser;
    let authToken: string;

    beforeEach(async () => {
      const result = await userHelper.createTestUser(2);
      testUser = result.user;
      authToken = result.token;
    });

    it("Scenario: User updates their profile", async () => {
      // Given an authenticated user and update data
      const profileUpdate = {
        nickname: testUserUpdate.nickname,
        imageUrl: testUserUpdate.imageUrl,
        currentPassword: testUser.password,
      };

      // When they update their profile
      const response = await request(app.getHttpServer())
        .patch("/api/users/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .send(profileUpdate)
        .expect(200);

      // Then their profile should be updated
      expect(response.body).toBeDefined();
      expect(response.body.nickname).toBe(testUserUpdate.nickname);
      expect(response.body.imageUrl).toBe(testUserUpdate.imageUrl);
    });
  });

  describe("Feature: User Logout", () => {
    let testUser: TestUser;
    let authToken: string;

    beforeAll(async () => {
      const result = await userHelper.createTestUser(3);
      testUser = result.user;
      authToken = result.token;
    });

    it("Scenario: User logs out successfully", async () => {
      // When they log out
      const response = await request(app.getHttpServer())
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Then they should receive a success message
      expect(response.body.message).toContain("success");

      // And the cookie should be cleared
      const cookies = response.headers["set-cookie"] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(
        cookies.some(
          (cookie: string) =>
            cookie.includes("jwt=;") ||
            cookie.includes("Expires=Thu, 01 Jan 1970"),
        ),
      ).toBe(true);

      // And their token should be invalidated (they can't access protected endpoints)
      await request(app.getHttpServer())
        .get("/api/users/me")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(401);
    });
  });

  describe("Feature: Account Deletion", () => {
    let testUser: TestUser;
    let authToken: string;

    beforeEach(async () => {
      const result = await userHelper.createTestUser(4);
      testUser = result.user;
      authToken = result.token;
    });

    it("Scenario: User deletes their account with valid password", async () => {
      // When they delete their account
      const response = await request(app.getHttpServer())
        .delete("/api/auth/signout")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ password: testUser.password })
        .expect(200);

      // Then they should receive a success message
      expect(response.body.message).toContain("success");

      // And the cookie should be cleared
      const cookies = response.headers["set-cookie"] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(
        cookies.some(
          (cookie: string) =>
            cookie.includes("jwt=;") ||
            cookie.includes("Expires=Thu, 01 Jan 1970"),
        ),
      ).toBe(true);

      // And their account should no longer exist
      const user = await em.findOne(User, { email: testUser.email });
      expect(user).toBeNull();
    });

    it("Scenario: Deleted user tries to log in", async () => {
      // First delete the account
      await request(app.getHttpServer())
        .delete("/api/auth/signout")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ password: testUser.password })
        .expect(200);

      // When the deleted user tries to log in
      await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(401); // Unauthorized
    });
  });
});
