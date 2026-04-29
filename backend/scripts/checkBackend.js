const { readdirSync, statSync } = require("fs");
const { join } = require("path");
const { spawnSync } = require("child_process");

const root = process.cwd();
const targets = [join(root, "index.js"), join(root, "functions", "db.js")];

const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith(".js")) {
      targets.push(fullPath);
    }
  }
};

walk(join(root, "functions"));

for (const file of targets) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`Syntax check passed for ${targets.length} files.`);
