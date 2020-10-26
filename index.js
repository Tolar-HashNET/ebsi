const supertest = require("supertest");
const { Agent, Scope } = require("@cef-ebsi/app-jwt");
const crypto = require("crypto");
const ethers = require("ethers");
const fs = require("fs");

/* eslint no-console: ["error", { allow: ["warn", "error"] }] */
const {
  notary,
  TEST_APP_NAME,
  privKey,
  testParams,
  finalConfig,
} = require("./config");

const { url } = finalConfig;
const request = supertest(url);
const MAX_PROMISE_TIMEOUT = 10000; // 10000 ms = 10 s

// Besu
let chainId;
let besuToken;
const callBesu = (method, params, token) => {
  if (token) {
    return request
      .post("/ledger/v1/blockchains/besu")
      .set("Accept", "application/json")
      .set("Authorization", `Bearer ${besuToken}`)
      .send({
        jsonrpc: "2.0",
        method,
        params,
        id: 1,
      });
  }

  return request
    .post("/ledger/v1/blockchains/besu")
    .set("Accept", "application/json")
    .send({
      jsonrpc: "2.0",
      method,
      params,
      id: 1,
    });
};

function createRandomFile(name, size = 1024, writeFile = true) {
  const data = crypto.randomBytes(size);
  const hash = ethers.utils.keccak256(data);
  if (writeFile) fs.writeFileSync(name, data);
  return { data, hash };
}

async function checkHash(h) {
  let hash = h;
  if (h.startsWith("0x")) {
    hash = h.substring(2);
  }

  const getData = async (uri) => {
    try {
      const response = await request.get(uri);
      return response.body;
    } catch (error) {
      console.error(error);
      return null;
    }
  };
  return getData(`/timestamp/v1/hashes/${hash}`);
}

async function getChainId() {
  const response = await callBesu("eth_chainId", [], null);
  if (response.status === 200) {
    chainId = response.body.result;
    // console.log(`chainid=${chainId}`);
  } else {
    console.error(`Error getting chain id:${response.status}`);
  }
}

async function buildTxNotaryWithEthers(hash) {
  const provider = new ethers.providers.JsonRpcProvider(
    finalConfig.besuRPCNode
  );
  const wallet = ethers.Wallet.createRandom();
  const iface = new ethers.utils.Interface(notary.abi);
  const ethersChainId = ethers.BigNumber.from(chainId).toNumber();
  const transaction = {
    nonce: await provider.getTransactionCount(wallet.address),
    gasLimit: 221000,
    gasPrice: 0,
    from: wallet.address,
    to: notary.address,
    value: 0,
    data: iface.encodeFunctionData("addRecord", [hash]),
    chainId: ethersChainId,
  };
  return wallet.signTransaction(transaction);
}

async function notarizeHash(hsh) {
  const sgnTx = await buildTxNotaryWithEthers(hsh);
  try {
    const response = await callBesu(
      "eth_sendRawTransaction",
      [sgnTx],
      besuToken
    );
    if (response.status === 200) {
      const txId = response.body.result;
      await callBesu("eth_getTransactionReceipt", [txId], besuToken);
      return true;
    }
    console.error(`error sending hash:${response.status}`);
    console.error(response);
  } catch (error) {
    console.error(`error calling besu auth:${error}`);
  }

  return false;
}

async function besuLogin() {
  const agent = new Agent(Scope.COMPONENT, privKey, {
    issuer: TEST_APP_NAME,
  });
  const requestToken = await agent.createRequestPayload("ebsi-ledger");
  await request
    .post("/ledger/v1/sessions")
    .send(requestToken)
    .then((response) => {
      besuToken = response.body.accessToken;
    });
}

function displayTiming(dur) {
  let duration = dur;
  duration = Math.round(duration);
  if (duration < 1000) {
    return `${duration} ms\n`;
  }
  if (duration < 60000) {
    const s = Math.floor(duration / 1000);
    return `${s}s ${duration - 1000 * s}ms\n`;
  }
  const d = new Date(duration);
  return `${d.getUTCHours()}h ${d.getUTCMinutes()}m ${d.getUTCSeconds()}s ${d.getUTCMilliseconds()}ms \n`;
}

function displayProgress(current, total, step, message) {
  let nextStep = step;
  if (current > step * total) {
    console.warn(`${message}${Math.round(step * 100)}%`);
    nextStep += current / total + 0.05;
  }
  return nextStep;
}

function generateTestHeader(success) {
  let testHeader = "";
  if (success) {
    testHeader = "Testing completed successfully\n\n";
  } else {
    testHeader = "Testing FAILED\n\n";
  }
  testHeader += `Testing Date: ${new Date().toLocaleString("en-Gb")}\n`;
  testHeader += `Testing parameters: ${testParams.file_nb} files of size [${testParams.min_size}-${testParams.max_size}]kb\n`;
  return testHeader;
}

function checkHashes(ans) {
  let result = "";
  let prevDate = new Date(0);
  ans.forEach((r) => {
    if (r === null) {
      result = "Error - did not received answer from Timestamp API\n";
    } // check timestamp ordering:
    else {
      const newDate = Date.parse(r.timestamp);
      if (prevDate > newDate) {
        result += "Error - timestamp should be increasing: \n";
      }
      prevDate = newDate;
    }
  });
  return result;
}

async function phase1Scripts(deleteFiles) {
  console.warn("running test scripts for protocol testing phase 1...");

  let testResult = true;
  let testReport = "";
  // 1. Login to the ledger
  await getChainId();
  await besuLogin();
  // 2. generate test files
  const filesList = [];
  const fileNames = [];
  let i = 0;
  for (i = 0; i < testParams.file_nb; i += 1) {
    const fsize =
      testParams.min_size +
      Math.round(Math.random() * (testParams.max_size - testParams.min_size));
    const fname = new Date().getTime().toString();
    filesList.push(createRandomFile(fname, fsize * 1024));
    fileNames.push(fname);
  }
  // 3. Notarize hashes
  let startDate = new Date();
  let nextStep = 0;
  let results = [];
  for (i = 0; i < testParams.file_nb; i += 1) {
    results.push(notarizeHash(filesList[i].hash));
    nextStep = displayProgress(
      i,
      testParams.file_nb,
      nextStep,
      "processing files..."
    );
  }
  await Promise.all(results);
  let endDate = new Date();
  const wDuration = endDate - startDate;
  if (wDuration > testParams.time_out) {
    testResult = false;
    testReport += "ERROR - Protocol Writing Time is too big\n";
  }
  // 3.1 Delete files
  if (deleteFiles) {
    for (i = 0; i < testParams.file_nb; i += 1) {
      fs.unlinkSync(fileNames[i]);
    }
  }

  await new Promise((r) => setTimeout(r, MAX_PROMISE_TIMEOUT)); // wait 10 seconds for the ledger to generate the blocks

  // 4. Check records
  startDate = new Date();
  // let prevDate = new Date(0);
  nextStep = 0;
  results = [];
  for (i = 0; i < testParams.file_nb; i += 1) {
    const res = checkHash(filesList[i].hash);
    results.push(res);
    nextStep = displayProgress(
      i,
      testParams.file_nb,
      nextStep,
      "processing hashes..."
    );
  }
  const cash = checkHashes(await Promise.all(results));
  if (cash && cash.length > 0) {
    testResult = false;
    testReport += cash;
  }
  endDate = Date.now();
  const rDuration = endDate - startDate;
  if (rDuration > testParams.time_out) {
    testResult = false;
    testReport += "ERROR - Protocol Reading Time is too big\n";
  }

  // 5. Test report
  testReport = generateTestHeader(testResult) + testReport;
  testReport += `Protocol Writing Time (total): ${displayTiming(wDuration)}`;
  testReport += `Protocol Writing Time (average): ${displayTiming(
    wDuration / testParams.file_nb
  )}`;
  testReport += `Protocol Reading Time (total): ${displayTiming(rDuration)}`;
  testReport += `Protocol Reading Time (average): ${displayTiming(
    rDuration / testParams.file_nb
  )}`;
  fs.writeFile("testReport.txt", testReport, function ferr2(err) {
    if (err) console.error(err);
  });
}

phase1Scripts(testParams.delete_files);
