const fs = require('fs');

let content = fs.readFileSync('src/rulesContext.tsx', 'utf-8');

content = content.replace(/Currency \(ISO Code\)/g, 'Currency');

content = content.replace(
  /\{ field: "g_from_currency", dataType: "string", maxLength: 255, required: true \}/g,
  '{ field: "g_from_currency", dataType: "string", maxLength: 255, required: true, crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Currency" } }'
);

content = content.replace(
  /\{ field: "g_to_currency", dataType: "string", maxLength: 255, required: true \}/g,
  '{ field: "g_to_currency", dataType: "string", maxLength: 255, required: true, crossCheck: { type: "coa", referenceField: "g_source_system_id", coaType: "Currency" } }'
);

// Remove je_outbound from FileType
content = content.replace(/\s*\|\s*"je_outbound"/g, '');

// Remove je_outbound array from defaultRules
const regex = /\s*je_outbound:\s*\[[\s\S]*?\],\n/g;
content = content.replace(regex, '');

// Bump storage version (e.g. v3 to v4 or whatever it was)
content = content.replace(/gappify_validation_rules_v[0-9]+/g, 'gappify_validation_rules_v6');

fs.writeFileSync('src/rulesContext.tsx', content);
console.log("Done");
