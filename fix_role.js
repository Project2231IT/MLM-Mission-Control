const fs = require("fs");
let c = fs.readFileSync("/opt/mlm-mission-control/src/app/admin/AdminClient.tsx", "utf8");
const old = 'dealer: { label: "Dealer", className: "bg-green-500/20 text-green-400 border-green-500/30" },';
const repl = 'dealer: { label: "Dealer", className: "bg-green-500/20 text-green-400 border-green-500/30" },\n  user: { label: "User", className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },';
if (c.includes(old)) { c = c.replace(old, repl); console.log("SUCCESS"); } else { console.log("NOT FOUND - searching..."); const idx = c.indexOf("dealer:"); console.log(c.substring(idx, idx+120)); }
fs.writeFileSync("/opt/mlm-mission-control/src/app/admin/AdminClient.tsx", c);
