/// <reference types="jest" />
import "@jest/globals";
import "jest-extended";

// Extend SQLite driver type with schema generator
declare module "@mikro-orm/sqlite" {
  interface SqliteDriver {
    getSchemaGenerator(): {
      createSchema(): Promise<void>;
      dropSchema(): Promise<void>;
    };
  }
}
