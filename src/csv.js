export function inboxCsv(rows, kind) {
  const columns =
    kind === "contact"
      ? ["id", "email", "message", "created_at"]
      : ["id", "email", "created_at"];
  const cell = (value) => {
    let text = String(value ?? "");
    if (/^[\s\uFEFF]*[=+@-]|^[\t\r\n]/u.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return (
    [columns, ...rows.map((row) => columns.map((key) => row[key]))]
      .map((row) => row.map(cell).join(","))
      .join("\r\n") + "\r\n"
  );
}
export function saveInboxPage(rows, kind, page) {
  const url = URL.createObjectURL(
    new Blob([inboxCsv(rows, kind)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = kind + "-page-" + (page + 1) + ".csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
