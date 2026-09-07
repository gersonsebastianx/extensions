const raycast = require("@raycast/eslint-config");

module.exports = [{ ignores: ["**/*.md", "dist/**", "node_modules/**"] }, ...raycast.flat(Infinity)];
