import { FileType, Rule } from "../rulesContext";

export interface ValidationError {
  row: number | string;
  column: string;
  field: string;
  message: string;
  solution: string;
  actualValue?: any;
  type?: "error" | "warning";
  isCrossCheck?: boolean;
}

export interface ValidationResponse {
  success: boolean;
  errors: ValidationError[];
  rowCount: number;
}

function isValidDate(dateString: string, fieldName: string) {
  if (!dateString) return false;
  let regex = /^\\d{4}-\\d{2}-\\d{2}$/;
  if (
    fieldName.toLowerCase() === "g_period" ||
    fieldName.toLowerCase() === "period"
  ) {
    regex = /^\\d{4}-\\d{2}-01$/;
    if (!regex.test(dateString)) return false;
    const parts = dateString.split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const date = new Date(year, month, 1);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === 1
    );
  } else if (
    fieldName.toLowerCase() === "invoice_date_created" ||
    fieldName.toLowerCase() === "g_invoice_date"
  ) {
    // Assuming invoice_date_created maps to g_invoice_date or similar if needed. It could be any.
    regex = /^\\d{4}-\\d{2}-\\d{2}( \\d{2}:\\d{2}:\\d{2})?$/;
    if (!regex.test(dateString)) return false;
    const datePart = dateString.split(" ")[0];
    const parts = datePart.split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
    );
  }

  if (!regex.test(dateString)) return false;
  const parts = dateString.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day
  );
}

function isValidDecimal(value: any, precision: number, scale: number) {
  if (value === undefined || value === null || value === "") return false;
  const strValue = String(value).replace(/,/g, "");
  if (!/^-?\\d*(\\.\\d*)?$/.test(strValue)) return false;
  const parts = strValue.split(".");
  const integerPart = parts[0].replace(/^-/, "");
  const decimalPart = parts.length > 1 ? parts[1] : "";
  return integerPart.length <= precision - scale && decimalPart.length <= scale;
}

function isValidInt(value: any, maxLength: number) {
  if (value === undefined || value === null || value === "") return false;
  const strValue = String(value).replace(/,/g, "");
  if (!/^-?\\d+$/.test(strValue)) return false;
  const digits = strValue.replace(/^-/, "");
  return digits.length <= maxLength;
}

function isValidEmail(email: any) {
  if (!email) return false;
  let str = typeof email === "string" ? email : String(email);
  // Correctly strip non-printable ASCII characters if any
  str = str.trim().replace(/[^\x20-\x7E]/g, "");
  if (!str) return false;
  // A standard, permissive regex for email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str);
}

export function validateData(
  fileType: FileType,
  csvData: any[],
  headers: string[],
  rules: Rule[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const headerLowercase = headers.map((h) => h.toLowerCase());
  const missingRequiredColumns: string[] = [];
  const missingWarningColumns: string[] = [];

  rules.forEach((rule) => {
    const fieldExists = headerLowercase.includes(rule.field.toLowerCase());
    if (!fieldExists) {
      if (rule.required === "Yes") {
        missingRequiredColumns.push(rule.field);
      } else if (
        rule.required === "Insights" ||
        rule.required === "Unapproved/Late"
      ) {
        missingWarningColumns.push(rule.field);
      }
    }
  });

  // If ANY required columns are missing, we should flag it clearly.
  // If MOST defined columns are missing, it's likely the wrong file type.
  const requiredRules = rules.filter((r) => r.required === "Yes");
  const missingRequiredCount = missingRequiredColumns.length;
  const totalRequiredCount = requiredRules.length;

  const totalDefinedColumns = rules.length;
  const missingDefinedColumns = rules.filter(
    (r) => !headerLowercase.includes(r.field.toLowerCase()),
  ).length;

  // Extra check: Identifiers that are almost unique to specific types
  const strongIdentiferMissing =
    (fileType === "coa" &&
      (!headerLowercase.includes("g_coa_type") ||
        !headerLowercase.includes("g_unique_key"))) ||
    (fileType === "vendors" && !headerLowercase.includes("g_email")) ||
    (fileType === "invoices" && !headerLowercase.includes("g_invoice_number")) ||
    (fileType === "transactions" &&
      !headerLowercase.includes("g_amount") &&
      !headerLowercase.includes("g_transaction_amount")) ||
    (fileType === "budget" && !headerLowercase.includes("g_subsidiary_amount")) ||
    (fileType === "fx_rates" && !headerLowercase.includes("g_rate"));

  // NEW: Identify if a file contains strong markers for a DIFFERENT type
  const belongsToDifferentType =
    (fileType !== "coa" &&
      headerLowercase.includes("g_coa_type") &&
      headerLowercase.includes("g_unique_key")) ||
    (fileType !== "vendors" &&
      headerLowercase.includes("g_email") &&
      !headerLowercase.includes("g_invoice_number") &&
      !headerLowercase.includes("g_po_number")) ||
    (fileType !== "invoices" && headerLowercase.includes("g_invoice_number")) ||
    (fileType !== "fx_rates" && headerLowercase.includes("g_rate") && headerLowercase.includes("g_from_currency"));

  if (
    missingRequiredColumns.length > 0 ||
    missingDefinedColumns > 0 ||
    strongIdentiferMissing ||
    belongsToDifferentType
  ) {
    const isMajorMismatch =
      strongIdentiferMissing ||
      belongsToDifferentType ||
      (totalRequiredCount > 0 &&
        missingRequiredCount / totalRequiredCount >= 0.3) ||
      (totalDefinedColumns > 0 &&
        missingDefinedColumns / totalDefinedColumns >= 0.5);

    if (missingRequiredColumns.length > 0 || isMajorMismatch) {
      errors.push({
        row: "Header",
        column: "N/A",
        field: "File Format",
        message: isMajorMismatch
          ? `MAJOR MISMATCH: The columns in this file (${headers.slice(0, 5).join(", ")}...) do not match the expected format for ${fileType.toUpperCase()}.`
          : "Missing required columns: " + missingRequiredColumns.join(", "),
        solution: isMajorMismatch
          ? `This file appears to be for a different category. Please verify you selected ${fileType.toUpperCase()} correctly.`
          : "Please add the missing columns to your CSV file",
        type: "error",
      });
    }

    // If it's a major mismatch, we skip row-level validation
    if (isMajorMismatch) {
      return [...errors, ...warnings];
    }
  }

  if (missingWarningColumns.length > 0) {
    warnings.push({
      row: "Header",
      column: "N/A",
      field: "Warning Columns",
      message:
        "Missing recommended columns: " + missingWarningColumns.join(", "),
      solution: "Adding these columns is recommended for better insights",
      type: "warning",
    });
  }

  const idOccurrences: Record<string, number> = {};

  for (let i = 0; i < csvData.length; i++) {
    const rowObj = csvData[i];
    const rowNum = i + 2; // Data rows start at 2 (1 is header)

    const duplicateCheckField =
      fileType === "coa" ? "g_unique_key" : "g_source_system_id";
    const dupIndex = headerLowercase.indexOf(duplicateCheckField);
    if (dupIndex !== -1) {
      const uniqueVal = rowObj[headers[dupIndex]]?.toString().trim();
      if (uniqueVal) {
        idOccurrences[uniqueVal] = (idOccurrences[uniqueVal] || 0) + 1;
        if (idOccurrences[uniqueVal] > 1) {
          errors.push({
            row: rowNum,
            column: duplicateCheckField,
            field: duplicateCheckField,
            message: `Duplicate ${duplicateCheckField} detected`,
            solution: `Each ${duplicateCheckField} must be unique.`,
            actualValue: uniqueVal,
            type: "error",
          });
        }
      }
    }

    for (let j = 0; j < headers.length; j++) {
      const value = rowObj[headers[j]];
      // Kept empty loop or could remove entirely if not needed.
      // We'll just remove the non-readable regex check to allow smart quotes etc.
    }

    rules.forEach((rule) => {
      const lowerRuleField = rule.field.toLowerCase();
      const originalHeaderIndex = headerLowercase.indexOf(lowerRuleField);
      if (originalHeaderIndex === -1) return;

      const value = rowObj[headers[originalHeaderIndex]];

      const isEmpty = value === undefined || value === null || value === "";

      if (rule.required === "No" && isEmpty) {
        return;
      }

      switch (rule.dataType) {
        case "string":
          if (isEmpty) {
            if (rule.required === "Yes") {
              errors.push({
                row: rowNum,
                column: rule.field,
                field: rule.field,
                message: "Required field is missing",
                solution: "Add a value for this field",
                actualValue: value,
                type: "error",
              });
            } else if (
              rule.required === "Insights" ||
              rule.required === "Unapproved/Late"
            ) {
              warnings.push({
                row: rowNum,
                column: rule.field,
                field: rule.field,
                message: `Field ${rule.field} is missing (${rule.required})`,
                solution:
                  "Gappify may still work, but adding it is recommended",
                actualValue: value,
                type: "warning",
              });
            }
          } else if (rule.maxLength && String(value).length > rule.maxLength) {
            errors.push({
              row: rowNum,
              column: rule.field,
              field: rule.field,
              message: "String exceeds maximum length of " + rule.maxLength,
              solution:
                "Shorten the text to " + rule.maxLength + " characters or less",
              actualValue: value,
              type: "error",
            });
          }

          if (
            rule.allowedValues &&
            rule.allowedValues.length > 0 &&
            value &&
            !rule.allowedValues.includes(String(value))
          ) {
            errors.push({
              row: rowNum,
              column: rule.field,
              field: rule.field,
              message:
                "Invalid value. Must be one of: " +
                rule.allowedValues.join(", "),
              solution:
                "Use an allowed value: " + rule.allowedValues.join(", "),
              actualValue: value,
              type: "error",
            });
          }

          if (
            rule.field.toLowerCase() === "g_email" &&
            value &&
            !isValidEmail(value)
          ) {
            errors.push({
              row: rowNum,
              column: rule.field,
              field: rule.field,
              message: "Invalid email format",
              solution: "Use a valid email format (e.g. user@domain.com)",
              actualValue: value,
              type: "error",
            });
          }
          if (rule.field.toLowerCase() === "g_cc_email" && value) {
            const separators = [";", ","];
            let emails: string[] = [String(value)];
            for (const sep of separators) {
              if (String(value).includes(sep)) {
                emails = String(value).split(sep);
                break;
              }
            }

            for (const email of emails) {
              if (email.trim() && !isValidEmail(email.trim())) {
                errors.push({
                  row: rowNum,
                  column: rule.field,
                  field: rule.field,
                  message: "Invalid email format in CC emails",
                  solution:
                    "Use valid email formats separated by semicolons or commas",
                  actualValue: value,
                  type: "error",
                });
                break;
              }
            }
          }

          if (
            [
              "g_currency",
              "g_currency_name",
              "g_from_currency",
              "g_to_currency",
            ].includes(rule.field.toLowerCase()) &&
            value
          ) {
            if (!/^[A-Z]{3}$/.test(String(value))) {
              errors.push({
                row: rowNum,
                column: rule.field,
                field: rule.field,
                message: "Invalid currency format",
                solution: "Use a valid ISO currency code (3 uppercase letters)",
                actualValue: value,
                type: "error",
              });
            }
          }
          break;

        case "int":
          if (isEmpty) {
            if (rule.required === "Yes") {
              errors.push({
                row: rowNum,
                column: rule.field,
                field: rule.field,
                message: "Required integer field is missing",
                solution: "Add an integer value",
                actualValue: value,
                type: "error",
              });
            } else if (
              rule.required === "Insights" ||
              rule.required === "Unapproved/Late"
            ) {
              warnings.push({
                row: rowNum,
                column: rule.field,
                field: rule.field,
                message: `Integer field ${rule.field} is missing (${rule.required})`,
                solution: "Adding an integer value is recommended",
                actualValue: value,
                type: "warning",
              });
            }
          } else if (
            value !== undefined &&
            value !== null &&
            value !== "" &&
            !isValidInt(value, rule.maxLength || 11)
          ) {
            errors.push({
              row: rowNum,
              column: rule.field,
              field: rule.field,
              message: "Invalid integer format or exceeds max length",
              solution: "Use a valid integer",
              actualValue: value,
              type: "error",
            });
          }
          break;

        case "decimal":
          if (isEmpty) {
            if (rule.required === "Yes") {
              errors.push({
                row: rowNum,
                column: rule.field,
                field: rule.field,
                message: "Required decimal field is missing",
                solution: "Add a decimal value",
                actualValue: value,
                type: "error",
              });
            } else if (
              rule.required === "Insights" ||
              rule.required === "Unapproved/Late"
            ) {
              warnings.push({
                row: rowNum,
                column: rule.field,
                field: rule.field,
                message: `Decimal field ${rule.field} is missing (${rule.required})`,
                solution: "Adding a decimal value is recommended",
                actualValue: value,
                type: "warning",
              });
            }
          } else if (
            value !== undefined &&
            value !== null &&
            value !== "" &&
            !isValidDecimal(value, rule.precision || 16, rule.scale || 2)
          ) {
            errors.push({
              row: rowNum,
              column: rule.field,
              field: rule.field,
              message: "Invalid decimal format",
              solution: "Format as decimal with correct precision/scale",
              actualValue: value,
              type: "error",
            });
          }
          break;

        case "date":
          if (isEmpty) {
            if (rule.required === "Yes") {
              errors.push({
                row: rowNum,
                column: rule.field,
                field: rule.field,
                message: "Required date field is missing",
                solution: "Add a date in YYYY-MM-DD format",
                actualValue: value,
                type: "error",
              });
            } else if (
              rule.required === "Insights" ||
              rule.required === "Unapproved/Late"
            ) {
              warnings.push({
                row: rowNum,
                column: rule.field,
                field: rule.field,
                message: `Date field ${rule.field} is missing (${rule.required})`,
                solution: "Adding a date in YYYY-MM-DD format is recommended",
                actualValue: value,
                type: "warning",
              });
            }
          } else if (
            value !== undefined &&
            value !== null &&
            value !== "" &&
            !isValidDate(value, rule.field)
          ) {
            let helpText = "Use YYYY-MM-DD format";
            if (
              rule.field.toLowerCase() === "g_period" ||
              rule.field.toLowerCase() === "period"
            )
              helpText = "Use YYYY-MM-01 format";
            if (
              rule.field.toLowerCase() === "invoice_date_created" ||
              rule.field.toLowerCase() === "g_invoice_date"
            )
              helpText = "Use YYYY-MM-DD or YYYY-MM-DD hh:mm:ss format";
            errors.push({
              row: rowNum,
              column: rule.field,
              field: rule.field,
              message: "Invalid date format",
              solution: helpText,
              actualValue: value,
              type: "error",
            });
          }
          break;

        case "boolean":
          if (isEmpty) {
            if (rule.required === "Yes") {
              errors.push({
                row: rowNum,
                column: rule.field,
                field: rule.field,
                message: "Required boolean field is missing",
                solution: "Add a boolean value (0, 1, TRUE, FALSE)",
                actualValue: value,
                type: "error",
              });
            } else if (
              rule.required === "Insights" ||
              rule.required === "Unapproved/Late"
            ) {
              warnings.push({
                row: rowNum,
                column: rule.field,
                field: rule.field,
                message: `Boolean field ${rule.field} is missing (${rule.required})`,
                solution:
                  "Adding a boolean value (0, 1, TRUE, FALSE) is recommended",
                actualValue: value,
                type: "warning",
              });
            }
          } else if (value !== undefined && value !== null && value !== "") {
            const strVal = String(value).toLowerCase();
            if (!["0", "1", "true", "false"].includes(strVal)) {
              errors.push({
                row: rowNum,
                column: rule.field,
                field: rule.field,
                message: "Invalid boolean format",
                solution: "Use 0, 1, TRUE, or FALSE",
                actualValue: value,
                type: "error",
              });
            }
          }
          break;
      }
    });
  }

  return [...errors, ...warnings];
}
