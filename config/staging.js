// Source review and merchant approval precede adding any independent sandbox binding.
export const approvedBindings = Object.freeze([]);
export function publicBinding(mode, bindings = approvedBindings) {
  if (mode !== "staging") return null;
  const b = bindings[0];
  if (
    !b ||
    !/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(b.origin) ||
    !/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(b.url) ||
    b.url !== "https://" + b.project + ".supabase.co" ||
    !/^sb_publishable_[A-Za-z0-9_-]+$/.test(b.publishable)
  )
    throw Error("Sandbox release gate closed");
  return b;
}
