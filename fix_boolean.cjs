const fs = require('fs');
let content = fs.readFileSync('src/rulesContext.tsx', 'utf-8');
content = content.replace(
  /\{ field: "g_inactive", dataType: "int", maxLength: 1, required: true, allowedValues: \["0", "1"\] \}/g,
  '{ field: "g_inactive", dataType: "boolean", required: true, allowedValues: ["0", "1", "TRUE", "FALSE", "true", "false"] }'
);
content = content.replace(/gappify_validation_rules_v6/g, 'gappify_validation_rules_v7');
fs.writeFileSync('src/rulesContext.tsx', content);
