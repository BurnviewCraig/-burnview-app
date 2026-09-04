// This machine's router forwards DNS to a resolver that consistently fails
// (getaddrinfo ENOTFOUND) for some hostnames, including Neon's. `dns.setServers()`
// alone doesn't fix this: it only redirects the c-ares `dns.resolve*()` family,
// while `dns.lookup()` (what `net`/`tls`/pg actually call to connect) always
// goes through the OS resolver regardless of `setServers()`. So we monkey-patch
// `dns.lookup()` itself to resolve via public DNS (8.8.8.8 / 1.1.1.1) instead,
// falling back to the OS resolver for any hostname public DNS can't answer.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dnsModule = await import("dns");
    // The named-export namespace from a dynamic import is read-only live
    // bindings; `.default` is the actual mutable CJS module.exports object,
    // which is what `require("dns")` elsewhere in the process also sees.
    const dns = dnsModule.default;
    const resolver = new dns.Resolver();
    resolver.setServers(["8.8.8.8", "1.1.1.1"]);
    const originalLookup = dns.lookup;

    (dns as unknown as { lookup: typeof dns.lookup }).lookup = ((
      hostname: string,
      options: unknown,
      callback?: unknown
    ) => {
      let opts = options as (Record<string, unknown> & { all?: boolean }) | ((...a: unknown[]) => void);
      let cb = callback as ((...a: unknown[]) => void) | undefined;
      if (typeof opts === "function") {
        cb = opts;
        opts = {};
      }
      const done = cb as (err: NodeJS.ErrnoException | null, ...rest: unknown[]) => void;
      resolver.resolve4(hostname, (err, addrs) => {
        if (err || !addrs || !addrs.length) {
          return (originalLookup as unknown as (...a: unknown[]) => void)(hostname, opts, done);
        }
        if ((opts as { all?: boolean }).all) {
          return done(null, addrs.map((address) => ({ address, family: 4 })));
        }
        done(null, addrs[0], 4);
      });
    }) as typeof dns.lookup;
  }
}
