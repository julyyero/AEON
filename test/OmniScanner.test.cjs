const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OmniScanner", function () {
  let OmniScanner;
  let scanner;
  let owner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const OmniScannerFactory = await ethers.getContractFactory("OmniScanner");
    scanner = await OmniScannerFactory.deploy();
    await scanner.waitForDeployment();
  });

  describe("Global Vitals", function () {
    it("Should return correct block vitals", async function () {
      const vitals = await scanner.getGlobalVitals();
      
      expect(vitals.blockNumber).to.be.a("bigint");
      expect(vitals.gasPrice).to.be.a("bigint");
      expect(vitals.lastBlockTime).to.be.a("bigint");
      expect(vitals.baseFee).to.be.a("bigint");
      
      // Basic sanity checks
      expect(vitals.blockNumber).to.be.greaterThan(0n);
      expect(vitals.lastBlockTime).to.be.greaterThan(0n);
    });
  });

  describe("Congestion Logic", function () {
    it("Should return OPTIMAL when average is below 10 gwei", async function () {
      const baseFees = [
        ethers.parseUnits("5", "gwei"),
        ethers.parseUnits("6", "gwei"),
        ethers.parseUnits("5", "gwei")
      ];
      const health = await scanner.getNetworkHealth(baseFees);
      expect(health).to.equal("OPTIMAL");
    });

    it("Should return STEADY when average is between 10 and 50 gwei", async function () {
      const baseFees = [
        ethers.parseUnits("15", "gwei"),
        ethers.parseUnits("20", "gwei"),
        ethers.parseUnits("10", "gwei") // Avg: 15 Gwei
      ];
      const health = await scanner.getNetworkHealth(baseFees);
      expect(health).to.equal("STEADY");
    });

    it("Should return CONGESTED when average is above 50 gwei", async function () {
      const baseFees = [
        ethers.parseUnits("50", "gwei"),
        ethers.parseUnits("60", "gwei"),
        ethers.parseUnits("50", "gwei") // Avg: ~53.33 Gwei
      ];
      const health = await scanner.getNetworkHealth(baseFees);
      expect(health).to.equal("CONGESTED");
    });
  });

  describe("Pulse Event", function () {
    it("Should emit Pulse event with correct intensity", async function () {
      const intensity = 100n;
      // Get the timestamp just before sending tx to roughly approximate
      const tx = await scanner.triggerPulse(intensity);
      
      await expect(tx)
        .to.emit(scanner, "Pulse")
        .withArgs(v => typeof v === 'bigint' && v > 0n, intensity);
    });
  });
});
