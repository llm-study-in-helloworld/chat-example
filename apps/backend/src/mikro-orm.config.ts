import { Options } from "@mikro-orm/core";
import { MySqlDriver } from "@mikro-orm/mysql";
import {
  Mention,
  Message,
  MessageReaction,
  RefreshToken,
  Room,
  RoomUser,
  User,
} from "./entities";

const config: Options<MySqlDriver> = {
  driver: MySqlDriver,
  dbName: process.env.DB_NAME || "chat_app",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "password",
  entities: [
    User,
    Room,
    RoomUser,
    Message,
    MessageReaction,
    Mention,
    RefreshToken,
  ],
  entitiesTs: ["src/**/*.entity.ts"],
  debug: process.env.NODE_ENV !== "production",
  driverOptions: {
    connection: {
      charset: "utf8mb4",
    },
  },
  migrations: {
    tableName: "mikro_migrations",
    path: "dist/migrations",
    pathTs: "src/migrations",
  },
  schemaGenerator: {
    disableForeignKeys: true,
    createForeignKeyConstraints: true,
    ignoreSchema: [],
  },
  baseDir: process.cwd(),
  seeder: {
    path: "dist/seeders",
    pathTs: "src/seeders",
  },
  // TS: false로 설정하면 엔티티 불변성 체크를 하지 않아 ManyToOne에서 타입 오류 줄어듦
  strict: false,

  // Allow global context usage for WebSockets
  allowGlobalContext: true,
};

export default config;
