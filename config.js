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
  tolar_staging: {
    url: "http://116.203.236.208:8080", // staging block explorer
  }
};




process.env.EBSI_ENV="tolar_staging"
process.env.BESU_ADDRESS_NOTARY="54bd18286eb02f683c622231e925a11c13d147f67ea1a293c9"

process.env.TEST_APP_NAME="ebsi-wallet"
process.env.TEST_APP_PRIVATE_KEY="473198b636fac330b3a5eec0198462e96f260bbb425b944f5b4766e1e3e4b1dc"

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
