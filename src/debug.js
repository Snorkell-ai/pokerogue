/**
 * Retrieves data from local storage and decodes it.
 * @throws {Error} If data is not found in local storage.
 * @returns {Object|null} The decoded data, or null if no data is found.
 */
export function getData() {
  const dataStr = localStorage.getItem('data');
  if (!dataStr)
    return null;
  return JSON.parse(atob(dataStr), (k, v) => k.endsWith('Attr') && ![ 'natureAttr', 'abilityAttr', 'passiveAttr' ].includes(k) ? BigInt(v) : v);
}

/**
 * Retrieves the session data from the local storage.
 * @throws {Error} If the session data is not found in the local storage.
 * @returns {Object} The session data object.
 */
export function getSession() {
  const sessionStr = localStorage.getItem('sessionData');
  if (!sessionStr)
    return null;
  return JSON.parse(atob(sessionStr));
}