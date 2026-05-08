import { ValidationError } from "./validation";
import { FileType } from "../rulesContext";

// Export standard validation functions
export * from "./validation";

// Maps of ID to values for quick lookup during validation
export type ReferenceMap = Record<string, any>;

export function performCrossCheck(
  standardErrors: ValidationError[],
  data: any[],
  fileType: FileType,
  coaMap: ReferenceMap,
  vendorMap: ReferenceMap,
  rules: import("../rulesContext").Rule[] = [],
): ValidationError[] {
  const crossCheckErrors: ValidationError[] = [];

  const crossCheckRules = rules.filter((r) => r.crossCheck);

  if (crossCheckRules.length > 0) {
    data.forEach((row, rowIndex) => {
      const rowNum = rowIndex + 2;
      crossCheckRules.forEach((rule) => {
        const val = row[rule.field];
        if (!val) return;

        const type = rule.crossCheck!.type;
        const refField = rule.crossCheck!.referenceField;

        if (type === "vendors") {
          if (Object.keys(vendorMap).length === 0) return;
          const match = vendorMap[val];
          if (!match) {
            crossCheckErrors.push({
              row: rowNum,
              column: rule.field,
              field: rule.field,
              message:
                rule.field +
                " value '" +
                val +
                "' not found in Vendors reference data",
              solution: "Use a valid ID from the Vendors reference data",
              actualValue: val,
              isCrossCheck: true,
              type: "error",
            });
          }
        } else if (type === "coa") {
          if (Object.keys(coaMap).length === 0) return;
          const matches = coaMap[val];
          if (!matches || matches.length === 0) {
            crossCheckErrors.push({
              row: rowNum,
              column: rule.field,
              field: rule.field,
              message:
                rule.field +
                " value '" +
                val +
                "' not found in COA reference data",
              solution: "Use a valid ID from the COA reference data",
              actualValue: val,
              isCrossCheck: true,
              type: "error",
            });
          } else if (
            rule.crossCheck!.coaType &&
            rule.crossCheck!.coaType !== "none"
          ) {
            const expectedType = rule.crossCheck!.coaType.toLowerCase();
            const hasCorrectType = matches.some((match: any) => {
              const actualType =
                match.g_coa_type ||
                match.g_type ||
                match.type ||
                match.coa_type ||
                "";
              return actualType?.toLowerCase() === expectedType;
            });
            if (!hasCorrectType) {
              crossCheckErrors.push({
                row: rowNum,
                column: rule.field,
                field: rule.field,
                message: `${rule.field} value '${val}' exists in COA but not with type '${rule.crossCheck!.coaType}'`,
                solution: `Ensure the ID is linked to the correct COA type (${rule.crossCheck!.coaType})`,
                actualValue: val,
                isCrossCheck: true,
                type: "error",
              });
            }
          }
        }
      });
    });
  } else {
    // Fallback to legacy hardcoded rules if none defined in Admin UI
    switch (fileType) {
      case "invoices":
        data.forEach((row, rowIndex) => {
          const rowNum = rowIndex + 2;
          const vendorId = row.g_vendor_id;
          const vendorName = row.g_name;
          const currencyId = row.g_currency_id;

          if (Object.keys(vendorMap).length > 0) {
            if (vendorId && !vendorMap[vendorId]) {
              crossCheckErrors.push({
                row: rowNum,
                column: "g_vendor_id",
                field: "g_vendor_id",
                message:
                  "Vendor ID " + vendorId + " not found in reference data",
                solution: "Use a valid vendor ID from the reference data",
                actualValue: vendorId,
                isCrossCheck: true,
                type: "error",
              });
            }

            if (
              vendorId &&
              vendorMap[vendorId] &&
              vendorName &&
              vendorMap[vendorId].g_name !== vendorName
            ) {
              crossCheckErrors.push({
                row: rowNum,
                column: "g_name",
                field: "g_name",
                message:
                  'Vendor name "' +
                  vendorName +
                  '" doesn\'t match reference name "' +
                  vendorMap[vendorId].g_name +
                  '"',
                solution: "Use the correct vendor name for this vendor ID",
                actualValue: vendorName,
                isCrossCheck: true,
                type: "error",
              });
            }
          }

          if (Object.keys(coaMap).length > 0) {
            if (currencyId && !coaMap[currencyId]) {
              crossCheckErrors.push({
                row: rowNum,
                column: "g_currency_id",
                field: "g_currency_id",
                message:
                  "Currency ID " +
                  currencyId +
                  " not found in COA reference data",
                solution: "Use a valid currency ID from the COA reference data",
                actualValue: currencyId,
                isCrossCheck: true,
                type: "error",
              });
            }

            [
              "g_subsidiary_debit_id",
              "g_glaccount_debit_id",
              "g_department_debit_id",
            ].forEach((field) => {
              const value = row[field];
              if (value && !coaMap[value]) {
                crossCheckErrors.push({
                  row: rowNum,
                  column: field,
                  field: field,
                  message:
                    field +
                    " value '" +
                    value +
                    "' not found in COA reference data",
                  solution: "Use a valid ID from the COA reference data",
                  actualValue: value,
                  isCrossCheck: true,
                  type: "error",
                });
              }
            });
          }
        });
        break;

      case "transactions":
        if (
          Object.keys(vendorMap).length > 0 ||
          Object.keys(coaMap).length > 0
        ) {
          data.forEach((row, rowIndex) => {
            const rowNum = rowIndex + 2;
            const vendorId = row.g_vendor_id;

            if (
              Object.keys(vendorMap).length > 0 &&
              vendorId &&
              !vendorMap[vendorId]
            ) {
              crossCheckErrors.push({
                row: rowNum,
                column: "g_vendor_id",
                field: "g_vendor_id",
                message:
                  "Vendor ID " + vendorId + " not found in reference data",
                solution: "Use a valid vendor ID from the reference data",
                actualValue: vendorId,
                isCrossCheck: true,
                type: "error",
              });
            }

            if (Object.keys(coaMap).length > 0) {
              [
                "g_subsidiary_id",
                "g_glaccount_id",
                "g_department_id",
                "g_subsidiary_currency_id",
                "g_transaction_currency_id",
              ].forEach((field) => {
                const value = row[field];
                if (value && !coaMap[value]) {
                  crossCheckErrors.push({
                    row: rowNum,
                    column: field,
                    field: field,
                    message:
                      field +
                      " value '" +
                      value +
                      "' not found in COA reference data",
                    solution: "Use a valid ID from the COA reference data",
                    actualValue: value,
                    isCrossCheck: true,
                    type: "error",
                  });
                }
              });
            }
          });
        }
        break;

      case "purchase_orders":
        if (
          Object.keys(vendorMap).length > 0 ||
          Object.keys(coaMap).length > 0
        ) {
          data.forEach((row, rowIndex) => {
            const rowNum = rowIndex + 2;
            const vendorId = row.g_vendor_id;

            if (
              Object.keys(vendorMap).length > 0 &&
              vendorId &&
              !vendorMap[vendorId]
            ) {
              crossCheckErrors.push({
                row: rowNum,
                column: "g_vendor_id",
                field: "g_vendor_id",
                message:
                  "Vendor ID " + vendorId + " not found in reference data",
                solution: "Use a valid vendor ID from the reference data",
                actualValue: vendorId,
                isCrossCheck: true,
                type: "error",
              });
            }

            if (Object.keys(coaMap).length > 0) {
              [
                "g_subsidiary_id",
                "g_glaccount_debit_id",
                "g_department_debit_id",
                "g_subsidiary_currency_id",
                "g_transaction_currency_id",
              ].forEach((field) => {
                const value = row[field];
                if (value && !coaMap[value]) {
                  crossCheckErrors.push({
                    row: rowNum,
                    column: field,
                    field: field,
                    message:
                      field +
                      " value '" +
                      value +
                      "' not found in COA reference data",
                    solution: "Use a valid ID from the COA reference data",
                    actualValue: value,
                    isCrossCheck: true,
                    type: "error",
                  });
                }
              });
            }
          });
        }
        break;

      case "vendors":
        data.forEach((row, rowIndex) => {
          const rowNum = rowIndex + 2;
          const subsidiaryId = row.g_subsidiary_id;
          const currencyId = row.g_currency_id;

          if (
            subsidiaryId &&
            Object.keys(coaMap).length > 0 &&
            !coaMap[subsidiaryId]
          ) {
            crossCheckErrors.push({
              row: rowNum,
              column: "g_subsidiary_id",
              field: "g_subsidiary_id",
              message: "Subsidiary ID " + subsidiaryId + " not found in COA",
              solution: "Ensure subsidiary exists in the COA file",
              actualValue: subsidiaryId,
              isCrossCheck: true,
              type: "error",
            });
          }

          if (
            currencyId &&
            Object.keys(coaMap).length > 0 &&
            !coaMap[currencyId]
          ) {
            crossCheckErrors.push({
              row: rowNum,
              column: "g_currency_id",
              field: "g_currency_id",
              message: "Currency ID " + currencyId + " not found in COA",
              solution: "Ensure currency exists in the COA file",
              actualValue: currencyId,
              isCrossCheck: true,
              type: "error",
            });
          }
        });
        break;
    }
  }

  return [...standardErrors, ...crossCheckErrors];
}
