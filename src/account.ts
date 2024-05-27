import { bypassLogin } from "./battle-scene";
import * as Utils from "./utils";

export interface UserInfo {
  username: string;
  lastSessionSlot: integer;
}

export let loggedInUser: UserInfo = null;
export const clientSessionId = Utils.randomString(32);

export function updateUserInfo(): Promise<[boolean, integer]> {
  // Return a new promise with a boolean for success status and an integer for HTTP status code
  return new Promise<[boolean, integer]>((resolve) => {
    // If bypassLogin is true, proceed with a guest session
    if (bypassLogin) {
      // Set default user to Guest and initialize lastSessionSlot as -1
      loggedInUser = { username: 'Guest', lastSessionSlot: -1 };
      let lastSessionSlot = -1;

      // Iterate through potential session slots (0 to 4)
      for (let s = 0; s < 5; s++) {
        // Check if session data exists for this slot and username in localStorage
        if (localStorage.getItem(`sessionData${s || ''}_${loggedInUser.username}`)) {
          lastSessionSlot = s;
          break;
        }
      }

      // Update the user's last session slot
      loggedInUser.lastSessionSlot = lastSessionSlot;

      // Migrate old data to a new format with username appended, for specific keys
      ['data', 'sessionData', 'sessionData1', 'sessionData2', 'sessionData3', 'sessionData4'].forEach(d => {
        // Check if the original key exists in localStorage
        if (localStorage.hasOwnProperty(d)) {
          // Check if the modified key exists, then back it up
          if (localStorage.hasOwnProperty(`${d}_${loggedInUser.username}`))
            localStorage.setItem(`${d}_${loggedInUser.username}_bak`, localStorage.getItem(`${d}_${loggedInUser.username}`));
          // Move data to the new key format
          localStorage.setItem(`${d}_${loggedInUser.username}`, localStorage.getItem(d));
          // Remove old data without username
          localStorage.removeItem(d);
        }
      });

      // Resolve the promise indicating success and a status code of 200
      resolve([true, 200]);
    } else {
      // Fetch user info from the API with authentication
      Utils.apiFetch('account/info', true).then(response => {
        // Check if the API response is not ok
        if (!response.ok) {
          // Resolve the promise indicating failure and the response status code
          resolve([false, response.status]);
          return;
        }
        // Convert the response to JSON
        return response.json();
      }).then(jsonResponse => {
        // Set the logged-in user to the response received
        loggedInUser = jsonResponse;
        // Resolve the promise indicating success and a status code of 200
        resolve([true, 200]);
      }).catch(err => {
        // Log error to the console
        console.error(err);
        // Resolve the promise indicating failure and a status code of 500
        resolve([false, 500]);
      });
    }
  });
}
