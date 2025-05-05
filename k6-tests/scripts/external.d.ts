// Type definitions for external k6 modules
declare module 'https://jslib.k6.io/k6-utils/*' {
  export function randomIntBetween(min: number, max: number): number;
  export function randomItem<T>(array: T[]): T;
  export function randomString(length: number): string;
}

declare const __ENV: Record<string, string>; 