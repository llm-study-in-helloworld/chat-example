import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

describe("Simple Test (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [],
      controllers: [],
      providers: [],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should pass", () => {
    expect(true).toBe(true);
  });
});
