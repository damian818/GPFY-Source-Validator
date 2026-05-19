function isValidDecimal(value, precision, scale) {
  if (value === undefined || value === null || value === "") return false;
  const strValue = String(value).replace(/,/g, "").trim();
  if (!/^-?\d*(\.\d*)?$/.test(strValue)) return false;
  const parts = strValue.split(".");
  const integerPart = parts[0].replace(/^-/, "");
  const decimalPart = parts.length > 1 ? parts[1] : "";
  console.log({value, strValue, integerPart, decimalPart, precision, scale, res: integerPart.length <= precision - scale && decimalPart.length <= scale});
  return integerPart.length <= precision - scale && decimalPart.length <= scale;
}
isValidDecimal("112.33", 16, 2);
isValidDecimal(" 112.33 ", 16, 2);
isValidDecimal("$112.33", 16, 2);
isValidDecimal("112.33", "16", "2");
