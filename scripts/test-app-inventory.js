import { config } from "dotenv";

config();

const { SENTINELONE_ENDPOINT } = process.env;

async function testInventoryManagement() {
  const testUrl = `${SENTINELONE_ENDPOINT}/web/api/v2.1/application-management/inventory`;
  const apiKey = process.env.SENTINELONE_API_KEY || "";
  const cleanApiKey = apiKey.trim();

  const response = await fetch(testUrl, {
    headers: {
      Authorization: `ApiToken ${cleanApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorResponse = await response.json();
    console.error("Error fetching inventory:", errorResponse);
    throw new Error(`Failed to fetch inventory: ${errorResponse.message}`);
  } else {
    const data = await response.json();
    console.log("Inventory data:", data);
  }
}

async function getApplicationCVEs() {
  const testUrl = `${SENTINELONE_ENDPOINT}/web/api/v2.1/application-management/risks`;
  const apiKey = process.env.SENTINELONE_API_KEY || "";
  const cleanApiKey = apiKey.trim();

  const response = await fetch(testUrl, {
    headers: {
      Authorization: `ApiToken ${cleanApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    method: "GET",
  });
  if (!response.ok) {
    const errorResponse = await response.json();
    console.error("Error fetching CVEs:", errorResponse);
    throw new Error(`Failed to fetch CVEs: ${errorResponse.message}`);
  }
  const data = await response.json();
  console.log("CVEs data:", data);
  return data;
}

async function main() {
  if (process.argv.includes("--cves")) {
    try {
      await getApplicationCVEs();
      return;
    } catch (error) {
      console.error("Error fetching CVEs:", error);
    }
    try {
      if (process.argv.includes("--inv")) {
        await testInventoryManagement();
        return;
      }
    } catch (error) {
      console.error("Error during inventory management test:", error);
    }
  }
}

main().catch((error) => {
  console.error("Error in main execution:", error);
  process.exit(1);
});
