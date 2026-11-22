import { test } from "node:test";
import assert from "node:assert/strict";
import { inboxCsv } from "../src/csv.js";
test("staff CSV export quotes text, neutralizes formula-like fields and restricts columns", () => {
  const body = inboxCsv(
    [
      {
        id: 1,
        email: "sample@example.invalid",
        message: ' =3+4, "paper"',
        created_at: "today",
        private: "omitted",
      },
    ],
    "contact",
  );
  assert.equal(
    body,
    '"id","email","message","created_at"\r\n"1","sample@example.invalid","\' =3+4, ""paper""","today"\r\n',
  );
  assert(!inboxCsv([{ message: "sample" }], "newsletter").includes("message"));
});
