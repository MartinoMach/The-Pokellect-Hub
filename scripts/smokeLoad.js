process.env.COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT || "https://example.documents.azure.com:443/";
process.env.COSMOS_KEY =
  process.env.COSMOS_KEY || "C2FBBH6M0A5x5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
process.env.COSMOS_DATABASE_NAME = process.env.COSMOS_DATABASE_NAME || "Inst347DB";

require("../index");
console.log("Function modules loaded successfully.");
