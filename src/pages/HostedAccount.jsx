import React, { useState } from "react";
import { Feedback, useAction } from "../ui.jsx";
export default function HostedAccount({ db, refresh }) {
  const [task, set] = useState("login");
  const a = useAction(refresh);
  return (
    <>
      <h1>Staging account</h1>
      <p>
        Complete confirmation and recovery links on this origin. After
        confirming a guest email, use Set password to finish registration.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.target);
          a.run(async () => {
            const email = f.get("email"),
              password = f.get("password");
            if (task === "reset") await db.auth.reset(email);
            else if (task === "password") await db.auth.password(password);
            else await db.auth[task](email, password);
            await db.signIn();
          }, "Account request completed. Check your inbox if confirmation is required.");
        }}
      >
        <label>
          Account action
          <select value={task} onChange={(e) => set(e.target.value)}>
            <option value="login">Sign in</option>
            <option value="signup">Register or convert guest</option>
            <option value="reset">Request password reset</option>
            <option value="password">Set password</option>
          </select>
        </label>
        {task !== "password" && (
          <label>
            Email
            <input type="email" name="email" required />
          </label>
        )}
        {task !== "reset" && (
          <label>
            Password
            <input
              type="password"
              minLength="8"
              name="password"
              required
              autoComplete={
                task === "login" ? "current-password" : "new-password"
              }
            />
          </label>
        )}
        <button disabled={a.busy}>Continue</button>
      </form>
      {db.identity() !== "visitor" && (
        <button onClick={() => a.run(db.signOut)}>Sign out</button>
      )}
      <Feedback action={a} />
    </>
  );
}
