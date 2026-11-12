const path = require("path");

module.exports = {
  rootDir: path.resolve(__dirname, "../../frontend"),
  testEnvironment: require.resolve("jest-environment-jsdom"),
  testMatch: ["**/features/gift-cards/*.test.jsx"],
  moduleDirectories: [path.join(__dirname, "node_modules"), "node_modules"],
  transform: {
    "^.+\\.[jt]sx?$": [require.resolve("babel-jest"), {
      presets: [[require.resolve("@babel/preset-env"), { targets: { node: "current" } }],
                [require.resolve("@babel/preset-react"), { runtime: "automatic" }]],
    }],
  },
};
