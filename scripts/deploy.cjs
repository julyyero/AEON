const hre = require("hardhat");

async function main() {
  const OmniScanner = await hre.ethers.getContractFactory("OmniScanner");
  const scanner = await OmniScanner.deploy();

  await scanner.waitForDeployment();

  console.log("OmniScanner deployed to:", await scanner.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
