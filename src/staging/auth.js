export function hostedAuth(auth, origin) {
  const checked = async (promise) => {
    const { data, error } = await promise;
    if (error) throw Error("Account request could not be completed");
    return data;
  };
  return {
    session: async () => (await checked(auth.getSession())).session,
    guest: () => checked(auth.signInAnonymously()),
    login: (email, password) =>
      checked(auth.signInWithPassword({ email, password })),
    async signup(email, password) {
      const session = (await checked(auth.getSession())).session;
      if (session?.user.is_anonymous)
        return checked(
          auth.updateUser({ email }, { emailRedirectTo: origin + "/auth" }),
        );
      return checked(
        auth.signUp({
          email,
          password,
          options: { emailRedirectTo: origin + "/auth" },
        }),
      );
    },
    reset: (email) =>
      checked(
        auth.resetPasswordForEmail(email, { redirectTo: origin + "/auth" }),
      ),
    password: (password) => checked(auth.updateUser({ password })),
    logout: () => checked(auth.signOut()),
  };
}
