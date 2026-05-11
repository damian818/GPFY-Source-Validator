import { useContext, useState } from "react";
import { RulesContext, FileType, DataType, Rule, defaultRules } from "../rulesContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Trash2, Edit2, Plus, Save, X } from "lucide-react";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";

export function AdminPage() {
  const { rules, setRules } = useContext(RulesContext);
  const [selectedFileType, setSelectedFileType] = useState<FileType>("vendors");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Rule | null>(null);

  const handleReset = () => {
    if (confirm("Are you sure you want to restore default rules? All custom modifications will be lost.")) {
      setRules(defaultRules);
      setEditingIndex(null);
      setEditForm(null);
    }
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...rules[selectedFileType][index] });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditForm(null);
  };

  const startAdd = () => {
    setEditingIndex(-1);
    setEditForm({
      field: "",
      dataType: "string",
      required: "No",
    });
  };

  const saveRule = () => {
    if (!editForm || !editForm.field) return;

    setRules((prev) => {
      const newRules = { ...prev };
      const currentList = [...(newRules[selectedFileType] || [])];
      
      if (editingIndex === -1) {
        currentList.push(editForm!);
      } else if (editingIndex !== null) {
        currentList[editingIndex] = editForm!;
      }
      
      newRules[selectedFileType] = currentList;
      return newRules;
    });

    setEditingIndex(null);
    setEditForm(null);
  };

  const deleteRule = (index: number) => {
    if (confirm("Are you sure you want to delete this rule?")) {
      setRules((prev) => {
        const newRules = { ...prev };
        newRules[selectedFileType] = prev[selectedFileType].filter((_, i) => i !== index);
        return newRules;
      });
    }
  };

  const updateEditForm = (key: keyof Rule, value: any) => {
    if (editForm) {
      setEditForm({ ...editForm, [key]: value });
    }
  };

  const fileTypes: { label: string; value: FileType }[] = [
    { label: "Vendors", value: "vendors" },
    { label: "Charts of Accounts (COA)", value: "coa" },
    { label: "Invoices", value: "invoices" },
    { label: "Expense Transactions", value: "transactions" },
    { label: "Purchase Orders", value: "purchase_orders" },
    { label: "Budget", value: "budget" },
    { label: "FX Rates", value: "fx_rates" },
  ];

  const renderEditFormRow = () => {
    if (!editForm) return null;
    return (
      <tr className="bg-purple-50">
        <td className="px-4 py-3">
          <Input 
            value={editForm.field} 
            onChange={(e) => updateEditForm("field", e.target.value)} 
            placeholder="Field Name (e.g., g_name)" 
            className="w-full text-xs font-mono"
          />
        </td>
        <td className="px-4 py-3">
          <Select 
            value={editForm.dataType} 
            onValueChange={(val) => updateEditForm("dataType", val as DataType)}
          >
            <SelectTrigger className="w-28 text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">string</SelectItem>
              <SelectItem value="int">int</SelectItem>
              <SelectItem value="decimal">decimal</SelectItem>
              <SelectItem value="date">date</SelectItem>
              <SelectItem value="boolean">boolean</SelectItem>
            </SelectContent>
          </Select>
        </td>
        <td className="px-4 py-3">
          <Select 
            value={editForm.required} 
            onValueChange={(val) => updateEditForm("required", val as any)}
          >
            <SelectTrigger className="w-32 text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
              <SelectItem value="Conditional">Conditional</SelectItem>
              <SelectItem value="Insights">Insights</SelectItem>
              <SelectItem value="Unapproved/Late">Unapproved/Late</SelectItem>
            </SelectContent>
          </Select>
          {editForm.required === "Conditional" && (
             <Select
                value={editForm.conditionalField || "none"}
                onValueChange={(val) => {
                  if (val === "none") {
                    updateEditForm("conditionalField", undefined);
                  } else {
                    updateEditForm("conditionalField", val);
                  }
                }}
             >
                <SelectTrigger className="w-32 text-xs h-8 mt-2">
                  <SelectValue placeholder="Depends on..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {rules[selectedFileType]
                    .filter((r) => r.field !== editForm.field)
                    .map((r) => (
                      <SelectItem key={r.field} value={r.field}>
                        {r.field}
                      </SelectItem>
                  ))}
                </SelectContent>
             </Select>
          )}
          {editForm.required === "Conditional" && editForm.conditionalField === "g_coa_type" && (
            <Select
              value={editForm.conditionalValue || "none"}
              onValueChange={(val) => {
                if (val === "none") {
                  updateEditForm("conditionalValue", undefined);
                } else {
                  updateEditForm("conditionalValue", val);
                }
              }}
            >
              <SelectTrigger className="w-32 text-xs h-8 mt-2">
                <SelectValue placeholder="COA Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any Type</SelectItem>
                <SelectItem value="Subsidiary">Subsidiary</SelectItem>
                <SelectItem value="Department">Department</SelectItem>
                <SelectItem value="GLAccount">GLAccount</SelectItem>
                <SelectItem value="Project">Project</SelectItem>
                <SelectItem value="Product">Product</SelectItem>
                <SelectItem value="Class">Class</SelectItem>
                <SelectItem value="Intercompany">Intercompany</SelectItem>
                <SelectItem value="Company">Company</SelectItem>
                <SelectItem value="Currency">Currency</SelectItem>
                <SelectItem value="Region">Region</SelectItem>
                <SelectItem value="Channel">Channel</SelectItem>
                <SelectItem value="Location">Location</SelectItem>
              </SelectContent>
            </Select>
          )}
        </td>
        <td className="px-4 py-3 space-y-2">
          {editForm.dataType === "string" || editForm.dataType === "int" ? (
            <div className="flex items-center gap-2">
              <Label className="text-xs w-16">Max Length</Label>
              <Input 
                type="number" 
                value={editForm.maxLength || ""}
                onChange={(e) => updateEditForm("maxLength", e.target.value ? parseInt(e.target.value, 10) : undefined)}
                className="w-20 h-8 text-xs"
                placeholder="255"
              />
            </div>
          ) : null}
          {editForm.dataType === "decimal" && (
            <div className="flex gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs w-10">Prec</Label>
                <Input 
                  type="number" 
                  value={editForm.precision || ""}
                  onChange={(e) => updateEditForm("precision", e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  className="w-16 h-8 text-xs"
                  placeholder="16"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs w-10">Scale</Label>
                <Input 
                  type="number" 
                  value={editForm.scale || ""}
                  onChange={(e) => updateEditForm("scale", e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  className="w-16 h-8 text-xs"
                  placeholder="2"
                />
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-500">
             <i>Allowed values (comma separated)</i>
             <Input 
               value={editForm.allowedValues ? editForm.allowedValues.join(", ") : ""}
               onChange={(e) => updateEditForm("allowedValues", e.target.value ? e.target.value.split(",").map(v => v.trim()) : undefined)}
               placeholder="e.g. 0, 1"
               className="h-8 flex-1"
             />
          </div>
        </td>
        <td className="px-4 py-3 space-y-2">
           <Select
             value={editForm.crossCheck?.type || "none"}
             onValueChange={(val) => {
               if (val === "none") {
                 const { crossCheck, ...rest } = editForm;
                 setEditForm(rest);
               } else {
                 updateEditForm("crossCheck", { type: val, referenceField: editForm.crossCheck?.referenceField || "g_source_system_id" });
               }
             }}
           >
             <SelectTrigger className="w-24 text-xs h-8">
               <SelectValue placeholder="None"/>
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="none">None</SelectItem>
               <SelectItem value="coa">COA</SelectItem>
               <SelectItem value="vendors">Vendors</SelectItem>
             </SelectContent>
           </Select>
           {editForm.crossCheck && (
             <Input
               value={editForm.crossCheck.referenceField}
               onChange={(e) => updateEditForm("crossCheck", { ...editForm.crossCheck!, referenceField: e.target.value })}
               placeholder="Ref Field"
               className="w-24 h-8 text-xs"
             />
           )}
           {editForm.crossCheck?.type === "coa" && editForm.crossCheck.referenceField === "g_source_system_id" && (
             <Select
               value={editForm.crossCheck.coaType || "none"}
               onValueChange={(val) => {
                 if (val === "none") {
                   const { coaType, ...rest } = editForm.crossCheck!;
                   updateEditForm("crossCheck", rest);
                 } else {
                   updateEditForm("crossCheck", { ...editForm.crossCheck!, coaType: val });
                 }
               }}
             >
               <SelectTrigger className="w-24 text-xs h-8">
                 <SelectValue placeholder="COA Type"/>
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="none">Any Type</SelectItem>
                 <SelectItem value="Subsidiary">Subsidiary</SelectItem>
                 <SelectItem value="Department">Department</SelectItem>
                 <SelectItem value="GLAccount">GLAccount</SelectItem>
                 <SelectItem value="Project">Project</SelectItem>
                 <SelectItem value="Product">Product</SelectItem>
                 <SelectItem value="Class">Class</SelectItem>
                 <SelectItem value="Intercompany">Intercompany</SelectItem>
                 <SelectItem value="Company">Company</SelectItem>
                 <SelectItem value="Currency">Currency</SelectItem>
                 <SelectItem value="Region">Region</SelectItem>
                 <SelectItem value="Channel">Channel</SelectItem>
                 <SelectItem value="Location">Location</SelectItem>
               </SelectContent>
             </Select>
           )}
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-2">
            <button onClick={saveRule} className="p-1 text-green-600 hover:bg-green-100 rounded" title="Save">
              <Save size={16} />
            </button>
            <button onClick={cancelEdit} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Cancel">
              <X size={16} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#725bb4] tracking-tight">Validation Rules Admin</h1>
        <p className="text-gray-500 mt-2">Manage the rules and structure for different import file types.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>File Types</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="flex flex-col">
              {fileTypes.map((ft) => (
                <li key={ft.value}>
                  <button
                    onClick={() => {
                        setSelectedFileType(ft.value);
                        setEditingIndex(null);
                        setEditForm(null);
                    }}
                    className={"w-full text-left px-6 py-3 transition-colors " + (selectedFileType === ft.value ? "bg-purple-50 text-[#725bb4] font-medium border-l-4 border-[#725bb4]" : "hover:bg-purple-50/40 text-gray-700 border-l-4 border-transparent")}
                  >
                    {ft.label}
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Rules for {fileTypes.find((f) => f.value === selectedFileType)?.label}</CardTitle>
              <CardDescription>Configure validation fields and parameters.</CardDescription>
            </div>
            <div className="flex gap-2">
              <button
                onClick={startAdd}
                disabled={editingIndex !== null}
                className="text-sm font-medium bg-[#725bb4] text-white hover:bg-[#5f499c] px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <Plus size={16} /> Add Rule
              </button>
              <button
                onClick={handleReset}
                className="text-sm font-medium text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md transition-colors"
                title="Restore default configurations"
              >
                Restore Defaults
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto border rounded border-gray-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#fcfaff] border-b border-purple-100">
                  <tr>
                    <th className="px-4 py-3 font-medium text-[#4f3b8a] w-1/4">Field Name</th>
                    <th className="px-4 py-3 font-medium text-[#4f3b8a] w-1/5">Type</th>
                    <th className="px-4 py-3 font-medium text-[#4f3b8a] w-24">Required</th>
                    <th className="px-4 py-3 font-medium text-[#4f3b8a]">Constraints</th>
                    <th className="px-4 py-3 font-medium text-[#4f3b8a]">Cross Check</th>
                    <th className="px-4 py-3 font-medium text-[#4f3b8a] w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {editingIndex === -1 && renderEditFormRow()}
                  {rules[selectedFileType]?.map((rule, idx) => (
                    <tr key={idx} className="hover:bg-purple-50/30 transition-colors">
                      {editingIndex === idx ? (
                         <td colSpan={6} className="p-0">
                           <table className="w-full">
                             <tbody>{renderEditFormRow()}</tbody>
                           </table>
                         </td>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-mono text-xs font-semibold">{rule.field}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-gray-600 bg-white">
                              {rule.dataType}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {rule.required === "Yes" && (
                              <Badge className="bg-red-50 text-red-700 hover:bg-red-100 border-transparent shadow-none">Yes</Badge>
                            )}
                            {rule.required === "No" && (
                              <Badge variant="outline" className="text-gray-500 bg-white">No</Badge>
                            )}
                            {rule.required === "Conditional" && (
                              <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-transparent shadow-none" title={`Depends on: ${rule.conditionalField} ${rule.conditionalValue ? `= ${rule.conditionalValue}` : ""}`}>
                                {rule.conditionalField ? `Cond: ${rule.conditionalField}` : "Conditional"}
                                {rule.conditionalValue ? ` (${rule.conditionalValue})` : ""}
                              </Badge>
                            )}
                            {rule.required === "Insights" && (
                              <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-transparent shadow-none">Insights</Badge>
                            )}
                            {rule.required === "Unapproved/Late" && (
                              <Badge variant="secondary" className="bg-orange-50 text-orange-700 hover:bg-orange-100 border-transparent shadow-none">Late</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            <div className="flex flex-wrap gap-1">
                              {rule.maxLength && <span className="bg-white border px-2 py-0.5 rounded text-[11px]">Max: {rule.maxLength}</span>}
                              {rule.precision && <span className="bg-white border px-2 py-0.5 rounded text-[11px]">Prec: {rule.precision}</span>}
                              {rule.scale !== undefined && <span className="bg-white border px-2 py-0.5 rounded text-[11px]">Scale: {rule.scale}</span>}
                              {rule.allowedValues && rule.allowedValues.length > 0 && (
                                <span className="bg-white border px-2 py-0.5 rounded text-[11px] truncate max-w-[200px]" title={rule.allowedValues.join(", ")}>
                                  Allowed: {rule.allowedValues.join(", ")}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                             {rule.crossCheck ? (
                               <Badge className="bg-[#00d1c1]/10 text-[#00d1c1] shadow-none border-[#00d1c1]/20">
                                 {rule.crossCheck.type.toUpperCase()}: {rule.crossCheck.referenceField} {rule.crossCheck.coaType ? `(${rule.crossCheck.coaType})` : ""}
                               </Badge>
                             ) : (
                               <span className="text-gray-400 text-xs">-</span>
                             )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => startEdit(idx)} className="p-1 text-gray-500 hover:text-[#725bb4] hover:bg-purple-50 rounded" title="Edit">
                                <Edit2 size={16} />
                              </button>
                              <button onClick={() => deleteRule(idx)} className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {(!rules[selectedFileType] || rules[selectedFileType].length === 0) && editingIndex !== -1 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No rules defined for this file type.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
