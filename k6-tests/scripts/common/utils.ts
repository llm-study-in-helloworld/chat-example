import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

/**
 * Generates a random email address for testing
 */
export function generateRandomEmail(): string {
  return `test.${randomString(8)}@example.com`;
}

/**
 * Generates a random nickname for testing
 */
export function generateRandomNickname(): string {
  return `user_${randomString(6)}`;
}

/**
 * Generates a random sentence for chat messages
 * @param sentences Optional custom sentences to choose from
 */
export function generateRandomSentence(sentences?: string[]): string {
  const defaultSentences = [
    "Hello, how are you doing today?",
    "This is a test message for load testing.",
    "I'm testing the WebSocket functionality.",
    "Let's see how the system handles this message.",
    "Random message for testing purposes.",
    "Testing the chat application under load.",
    "Just another test message.",
    "How's the system performance looking?",
    "Testing, testing, 1, 2, 3.",
    "This is message number " + Math.floor(Math.random() * 1000) + ".",
  ];
  
  const options = sentences || defaultSentences;
  return options[Math.floor(Math.random() * options.length)];
} 