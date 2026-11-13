const path = require("path");

module.exports = {
  rootDir: path.resolve(__dirname, "../../frontend"),
  testEnvironment: require.resolve("jest-environment-jsdom"),
  testMatch: ["**/components/site/Seasonal.test.jsx", "**/features/gift-cards/*.test.jsx", "**/components/admin/Template.test.jsx", "**/components/admin/AdminWorkflow.test.jsx"],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  moduleDirectories: [path.join(__dirname, "node_modules"), "node_modules"],
  transform: {
    "^.+\\.[jt]sx?$": [require.resolve("babel-jest"), {
      presets: [[require.resolve("@babel/preset-env"), { targets: { node: "current" } }],
                [require.resolve("@babel/preset-react"), { runtime: "automatic" }]],
    }],
  },
};

