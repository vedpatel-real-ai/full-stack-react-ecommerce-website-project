export function quote(lines, terms) {
  const subtotal = lines.reduce((sum, line) => {
    if (
      !Number.isSafeInteger(line.unit) ||
      line.unit < 1 ||
      line.unit > 10000000 ||
      !Number.isInteger(line.qty) ||
      line.qty < 1 ||
      line.qty > 20
    )
      throw Error("Invalid line");
    return sum + line.unit * line.qty;
  }, 0);
  if (
    lines.length > 40 ||
    !terms ||
    !Number.isInteger(terms.shipping) ||
    terms.shipping < 0 ||
    terms.shipping > 1000000 ||
    !Number.isInteger(terms.taxBps) ||
    terms.taxBps < 0 ||
    terms.taxBps > 10000
  )
    throw Error("Invalid price policy");
  const shipping = lines.length ? terms.shipping : 0,
    tax = Math.floor((subtotal * terms.taxBps + 5000) / 10000);
  return { subtotal, shipping, tax, total: subtotal + shipping + tax };
}
