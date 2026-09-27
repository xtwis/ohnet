export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface TokenStorage {
  get: () => TokenPair | undefined
  set: (pair: TokenPair) => void
  clear: () => void
}

export function createTokenStorage(initial?: TokenPair): TokenStorage {
  let current: TokenPair | undefined = initial
  return {
    get: () => current,
    set: (pair) => { current = pair },
    clear: () => { current = undefined },
  }
}
