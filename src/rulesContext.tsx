import { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction } from "react";

export type DataType = "string" | "int" | "decimal" | "date" | "boolean";

export type RequirementLevel = "Yes" | "No" | "Insights" | "Unapproved/Late" | "Conditional";

export interface Rule {
  field: string;
  dataType: DataType;
  maxLength?: number;
  precision?: number;
  scale?: number;
  required: RequirementLevel;
  conditionalField?: string;
  conditionalValue?: string;
  allowedValues?: string[];
  crossCheck?: {
    type: "coa" | "vendors";
    referenceField: string;
    coaType?: string;
  };
}

export type FileType =
  | "vendors"
  | "coa"
  | "invoices"
  | "transactions"
  | "purchase_orders"
  | "budget"
  | "fx_rates";

export type ValidationRules = Record<FileType, Rule[]>;

export const defaultRules: ValidationRules = {
  vendors: [
    { field: "g_source_system_id", dataType: "string", maxLength: 100, required: "Yes" },
    { field: "g_name", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_email", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_primary_subsidiary", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_primary_subsidiary_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Subsidiary" } },
    { field: "g_currency_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Currency" } },
    { field: "g_currency_name", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_inactive", dataType: "boolean", required: "Yes", allowedValues: ["0", "1", "TRUE", "FALSE", "true", "false"] },
    { field: "g_cc_email", dataType: "string", maxLength: 255, required: "No" },
  ],
  coa: [
    { field: "g_source_system_id", dataType: "string", maxLength: 100, required: "Yes" },
    {
      field: "g_coa_type",
      dataType: "string",
      maxLength: 255,
      required: "Yes",
      allowedValues: [
        "Subsidiary",
        "Department",
        "GLAccount",
        "Project",
        "Product",
        "Class",
        "Intercompany",
        "Company",
        "Currency",
        "Region",
        "Channel",
        "Location",
      ],
    },
    { field: "g_unique_key", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_name", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_currency", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_inactive", dataType: "boolean", required: "Yes", allowedValues: ["0", "1", "TRUE", "FALSE", "true", "false"] },
    { field: "g_account_type", dataType: "string", maxLength: 255, required: "No" },
  ],
  invoices: [
    { field: "g_source_system_id", dataType: "string", maxLength: 100, required: "Yes" },
    { field: "g_vendor_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "vendors", referenceField: "g_source_system_id" } },
    { field: "g_name", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_invoice_type", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_invoice_number", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_po_id", dataType: "string", maxLength: 100, required: "No" },
    { field: "g_invoice_date", dataType: "date", required: "Yes" },
    { field: "g_period", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_subsidiary_debit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_subsidiary_debit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Subsidiary" } },
    { field: "g_glaccount_debit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_glaccount_debit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "GLAccount" } },
    { field: "g_department_debit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_department_debit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Department" } },
    { field: "g_product_debit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_product_debit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Product" } },
    { field: "g_location_debit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_location_debit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Location" } },
    { field: "g_class_debit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_class_debit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Class" } },
    { field: "g_project_debit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_project_debit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Project" } },
    { field: "g_invoice_memo", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_status", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_currency", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_currency_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Currency" } },
    { field: "g_start_date", dataType: "date", required: "No" },
    { field: "g_end_date", dataType: "date", required: "No" },
    { field: "g_invoice_quantity", dataType: "decimal", precision: 16, scale: 2, required: "No" },
    { field: "g_invoice_amount", dataType: "decimal", precision: 16, scale: 2, required: "Yes" },
  ],
  transactions: [
    { field: "g_source_system_id", dataType: "string", maxLength: 100, required: "Yes" },
    { field: "g_date", dataType: "date", required: "Yes" },
    { field: "g_subsidiary", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_subsidiary_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Subsidiary" } },
    { field: "g_period", dataType: "date", required: "Yes" },
    { field: "g_type", dataType: "string", maxLength: 255, required: "Yes", allowedValues: ["Bill", "Journal", "Others"] },
    { field: "g_name", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_vendor_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "vendors", referenceField: "g_source_system_id" } },
    { field: "g_document_number", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_glaccount", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_glaccount_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "GLAccount" } },
    { field: "g_memo", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_subsidiary_currency", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_subsidiary_currency_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Subsidiary" } },
    { field: "g_transaction_currency", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_transaction_currency_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Currency" } },
    { field: "g_amount", dataType: "decimal", precision: 16, scale: 2, required: "Yes" },
    { field: "g_transaction_amount", dataType: "decimal", precision: 16, scale: 2, required: "Yes" },
    { field: "g_exchange_rate", dataType: "decimal", precision: 16, scale: 2, required: "No" },
    { field: "g_department", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_department_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Department" } },
    { field: "g_subsidiary_amount", dataType: "decimal", precision: 16, scale: 2, required: "Yes" },
    { field: "g_po_id", dataType: "string", maxLength: 100, required: "No" },
    { field: "g_company", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_company_id", dataType: "int", maxLength: 11, required: "No" },
  ],
  purchase_orders: [
    { field: "g_source_system_id", dataType: "string", maxLength: 100, required: "Yes" },
    { field: "g_vendor_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "vendors", referenceField: "g_source_system_id" } },
    { field: "g_name", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_po_id", dataType: "string", maxLength: 100, required: "Yes" },
    { field: "g_po_number", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_po_header_description", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_po_line_id", dataType: "string", maxLength: 100, required: "Yes" },
    { field: "g_po_line_description", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_po_line_amount", dataType: "decimal", precision: 16, scale: 2, required: "Yes" },
    { field: "g_po_header_amount", dataType: "decimal", precision: 16, scale: 2, required: "Yes" },
    { field: "g_po_line_status", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_po_owner", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_service_start_date", dataType: "date", required: "Yes" },
    { field: "g_service_end_date", dataType: "date", required: "Yes" },
    { field: "g_invoiced_amount", dataType: "decimal", precision: 16, scale: 2, required: "Yes" },
    { field: "g_po_balance", dataType: "decimal", precision: 16, scale: 2, required: "Yes" },
    { field: "g_email", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_transaction_currency", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_transaction_currency_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Currency" } },
    { field: "g_subsidiary", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_subsidiary_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Subsidiary" } },
    { field: "g_subsidiary_currency", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_subsidiary_currency_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Subsidiary" } },
    { field: "g_glaccount_debit", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_glaccount_debit_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "GLAccount" } },
    { field: "g_glaccount_credit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_glaccount_credit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "GLAccount" } },
    { field: "g_department_debit", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_department_debit_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Department" } },
    { field: "g_department_credit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_department_credit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Department" } },
    { field: "g_location_debit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_location_debit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Location" } },
    { field: "g_location_credit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_location_credit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Location" } },
    { field: "g_class_debit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_class_debit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Class" } },
    { field: "g_class_credit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_class_credit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Class" } },
    { field: "g_product_debit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_product_debit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Product" } },
    { field: "g_product_credit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_product_credit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Product" } },
    { field: "g_project_debit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_project_debit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Project" } },
    { field: "g_project_credit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_project_credit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Project" } },
    { field: "g_region_debit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_region_debit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Region" } },
    { field: "g_region_credit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_region_credit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Region" } },
    { field: "g_company_debit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_company_debit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Company" } },
    { field: "g_company_credit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_company_credit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Company" } },
    { field: "g_intercompany_debit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_intercompany_debit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Intercompany" } },
    { field: "g_intercompany_credit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_intercompany_credit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Intercompany" } },
    { field: "g_channel_debit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_channel_debit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Channel" } },
    { field: "g_channel_credit", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_channel_credit_id", dataType: "string", maxLength: 100, required: "No", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Channel" } },
    { field: "g_po_line_amount_cancelled", dataType: "decimal", precision: 16, scale: 2, required: "No" },
    { field: "g_cc_email", dataType: "string", maxLength: 255, required: "No" },
    { field: "g_po_date", dataType: "date", required: "Yes" },
  ],
  budget: [
    { field: "g_source_system_id", dataType: "string", maxLength: 100, required: "Yes" },
    { field: "g_vendor_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "vendors", referenceField: "g_source_system_id" } },
    { field: "g_name", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_subsidiary", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_subsidiary_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Subsidiary" } },
    { field: "g_department", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_department_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Department" } },
    { field: "g_glaccount", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_glaccount_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "GLAccount" } },
    { field: "g_subsidiary_currency", dataType: "string", maxLength: 255, required: "Yes" },
    { field: "g_subsidiary_currency_id", dataType: "string", maxLength: 100, required: "Yes", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Subsidiary" } },
    { field: "g_subsidiary_amount", dataType: "decimal", precision: 16, scale: 2, required: "Yes" },
    { field: "g_period", dataType: "date", required: "Yes" },
  ],
  fx_rates: [
    { field: "g_source_system_id", dataType: "string", maxLength: 100, required: "Yes" },
    { field: "g_period", dataType: "date", required: "Yes" },
    { field: "g_from_currency", dataType: "string", maxLength: 255, required: "Yes", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Currency" } },
    { field: "g_to_currency", dataType: "string", maxLength: 255, required: "Yes", crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Currency" } },
    { field: "g_rate", dataType: "decimal", precision: 16, scale: 5, required: "Yes" },
  ],
};

interface RulesContextProps {
  rules: ValidationRules;
  setRules: Dispatch<SetStateAction<ValidationRules>>;
}

export const RulesContext = createContext<RulesContextProps>({
  rules: defaultRules,
  setRules: () => {},
});

export function RulesProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<ValidationRules>(() => {
    const saved = localStorage.getItem("gappify_validation_rules_v8");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved rules", e);
        return defaultRules;
      }
    }
    return defaultRules;
  });

  useEffect(() => {
    localStorage.setItem("gappify_validation_rules_v8", JSON.stringify(rules));
  }, [rules]);

  return <RulesContext.Provider value={{ rules, setRules }}>{children}</RulesContext.Provider>;
}
