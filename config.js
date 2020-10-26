const { utils } = require("@cef-ebsi/app-jwt");
require("dotenv").config();
const { abi } = require("./sc-notary");

const testParams = {
  file_nb: 10,
  min_size: 10, // 10 kb
  max_size: 500, // 500kb
  delete_files: true,
  time_out: 1800000, // 30 minutes, maximum running time of the script in milliseconds
};

const config = {
  production: {
    url: "https://api.ebsi.tech.ec.europa.eu",
    besuRPCNode: "https://www.ebsi.xyz/jsonrpc",
  },
  development: {
    url: "https://api.ebsi.xyz",
    besuRPCNode: "https://www.intebsi.xyz/jsonrpc",
  },
  integration: {
    url: "https://api.intebsi.xyz",
    besuRPCNode: "https://www.intebsi.xyz/jsonrpc",
  },
  local: {
    url: process.env.EBSI_API,
    besuRPCNode: "https://www.intebsi.xyz/jsonrpc",
  },
};

if (!process.env.EBSI_ENV) throw new Error("EBSI_ENV is not defined");
if (!process.env.TEST_APP_NAME) throw new Error("TEST_APP_NAME is not defined");
if (!process.env.TEST_APP_PRIVATE_KEY)
  throw new Error("TEST_APP_PRIVATE_KEY is not defined");

const environment = process.env.EBSI_ENV;
const finalConfig = config[environment];
const notary = {
  address: process.env.BESU_ADDRESS_NOTARY,
  abi,
};
const { TEST_APP_NAME } = process.env;
const privKey = utils.privateKeyAsJWK(process.env.TEST_APP_PRIVATE_KEY);

module.exports = {
  finalConfig,
  notary,
  TEST_APP_NAME,
  privKey,
  testParams,
};
