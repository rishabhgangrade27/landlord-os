export function createClient() {
  const handler = {
    get(target: any, prop: string): any {
      if (prop === 'auth') return { getUser: async () => ({ data: { user: null } }) }
      if (prop === 'storage') return { from: () => ({ createSignedUrl: async () => ({ data: null }) }) }
      return (...args: any[]) => new Proxy({}, handler)
    },
    apply() {
      return Promise.resolve({ data: null, error: null })
    }
  }
  return new Proxy(function() {}, handler)
}
