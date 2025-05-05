import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.2.0/index.js";
import { sleep } from "k6";
import { getBaseUrls, loginUser, registerUser } from "./common/api";
import { realisticOptions } from "./common/options";

export const options = realisticOptions;

export default function () {
  // Get API base URL
  const { API_BASE_URL } = getBaseUrls(true);

  // Scenario 1: User Registration
  const newUser = registerUser(API_BASE_URL);
  sleep(randomIntBetween(1, 2));

  // Scenario 2: User Login (if registration was successful)
  if (newUser) {
    const credentials = loginUser(
      API_BASE_URL,
      newUser.email,
      newUser.password,
    );

    // Log results if successful
    if (credentials) {
      console.log(
        `Login successful with token: ${credentials.token.substring(0, 10)}...`,
      );
      console.log(`User ID: ${credentials.userId}`);
    }
  }

  // Short pause between iterations
  sleep(randomIntBetween(1, 3));
}
