import { SignProtocolClient, SpMode, EvmChains } from "@ethsign/sp-sdk";
import { privateKeyToAccount } from "viem/accounts";
import axios from "axios";

// Ensure the private key is prefixed with '0x' and is exactly 32 bytes (64 characters) long
const privateKey = "0xf03a4913efdd40406794c10b549d9e4ebc56ca2bf60e551ad75658bb5fff3d1c";

const account = privateKeyToAccount(privateKey);
const publicAddress = account.address;

const client = new SignProtocolClient(SpMode.OnChain, {
  chain: EvmChains.polygonAmoy,
  account: account,
});

async function createSchema() {
  try {
    const res = await client.createSchema({
      name: "SDK Test",
      data: [
        { name: "contractDetails", type: "string" },
        { name: "signer", type: "address" },
      ],
    });
    console.log("Schema created:", res);
    return res.id; // Assuming the response includes the schema ID
  } catch (error) {
    console.error("Error creating schema:", error);
  }
}

async function createNotaryAttestation(schemaId, contractDetails, signer) {
  try {
    const res = await client.createAttestation({
      schemaId: schemaId,
      data: {
        contractDetails,
        signer
      },
      indexingValue: signer.toLowerCase()
    });
    console.log("Attestation created:", res);
    return res;
  } catch (error) {
    console.error("Error creating attestation:", error);
  }
}

// Function to create a delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function for making requests to the Sign Protocol Indexing Service
async function makeAttestationRequest(endpoint, options) {
  const url = `https://testnet-rpc.sign.global/api/${endpoint}`;
  try {
    const res = await axios.request({
      url,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
      ...options,
    });
    // Throw API errors
    if (res.status !== 200) {
      throw new Error(JSON.stringify(res));
    }
    // Return original response
    return res.data;
  } catch (error) {
    console.error("Error making attestation request:", error);
    throw error;
  }
}

async function queryAttestations(schemaId, attester, indexingValue) {
  try {
    const response = await makeAttestationRequest("index/attestations", {
      method: "GET",
      params: {
        mode: "onchain", // Data storage location
        schemaId: schemaId, // Your full schema's ID
        attester: attester, // Attester's address
        indexingValue: indexingValue.toLowerCase(), // Indexed value (e.g., signer's address)
      },
    });
    // Make sure the request was successfully processed.
    if (!response.success) {
      return {
        success: false,
        message: response?.message ?? "Attestation query failed.",
      };
    }
    // Return a message if no attestations are found.
    if (response.data?.total === 0) {
      return {
        success: false,
        message: "No attestation for this address found.",
      };
    }
    // Return all attestations that match our query.
    return {
      success: true,
      attestations: response.data.rows,
    };
  } catch (error) {
    console.error("Error querying attestations:", error);
    return {
      success: false,
      message: "Error querying attestations: " + error.message,
    };
  }
}

// Main execution
async function main() {
  const schemaId = await createSchema();
  if (schemaId) {
    console.log("Waiting for 5 seconds before creating attestation...");
    await delay(5000); // Wait for 5 seconds
    
    const attestation = await createNotaryAttestation(schemaId, "Sample contract details", publicAddress);
    
    if (attestation) {
      console.log("Waiting for 5 seconds before querying attestations...");
      await delay(5000); // Wait for 5 seconds
      
      const queryResult = await queryAttestations(schemaId, publicAddress, publicAddress);
      console.log("Query result:", queryResult);
    }
  }
}

main();