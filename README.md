# AEON Protocol

AEON is a specialized Collateralized Debt Position (CDP) and yield-generation protocol deployed on the Somnia Network. It focuses on absolute capital efficiency, transparent risk management, and algorithmic safety overlays that transcend standard decentralized lending models.

**Core Value Proposition**

While standard DeFi lending protocols rely entirely on static over-collateralization and delayed manual liquidations, AEON introduces proactive network omniscience. The protocol actively monitors real-time blockchain telemetry—gas dynamics, throughput, and massive transfers—to inform its AI-driven Sentinel, which preempts market volatility before it severely impacts borrower solvency.

By leveraging the speed and architecture of the Somnia Network, AEON guarantees that borrowers remain highly informed while the protocol remains mathematically solvent, dramatically reducing systemic bad debt under extreme market stress.

**Protocol Architecture**

**1. The Vault (Lending Engine)**
The core CDP interface where users execute fundamental DeFi operations:
- Deposit: Lock $STT (Somnia Testnet Token) natively.
- Borrow: Safely mint $aeonUSDC standard stablecoin against the active collateral position.
- Repay & Withdraw: Liquidate debt to unlock base collateral.
- Health Factor: The critical solvency metric. Maintained above 1.0 to avoid automated protocol liquidations.

**2. The Sentinel API**
An autonomous, programmatic risk evaluator listening to smart contract event emissions:
- Analyzes RiskAlert thresholds when a user's Health Factor drops into a vulnerable margin (HF <= 1.5).
- Recommends immediate mitigation paths (collateral add or debt repayment).
- Simulates instantaneous flash crashes (Oracle manipulation) in testnet environments to validate the robustness of the liquidation pipeline.

**3. Omniscience Observatory**
A transparent, direct feed into the Somnia Network's mempool and block production:
- Tracks live transaction creation, latency, and real-time gas base fees.
- Acts as a Whale Detector identifying high-value $STT transfers capable of triggering sudden liquidity drains.

**Technical Stack**

- Frontend Application: React 18, Vite
- Blockchain Interface: ethers.js (Ethers v6) for robust Provider RPC injection and Contract mapping.
- RPC Network: Somnia Testnet (https://dream-rpc.somnia.network)

**Setup Instructions**

1. Clone the repository:
   git clone https://github.com/julyyero/AEON.git
   cd AEON

2. Install dependencies:
    npm install

3. Start the development server:
    npm run dev

4. Connect your Wallet:
   Local builds launch on http://localhost:5173. Connect your Web3 provider (such as MetaMask) connected to the Somnia Testnet to interact directly with the smart contracts.

**Testnet Contract Deployments**

The following contracts structure the AEON testnet instance. The exact ABIs are tightly integrated within the repository for operational context:

- Lending Protocol: 0xdeeE2596e7f35d814883E56cb16767bfB472cE6A
- PUSD Stablecoin: 0x574c820580da3f6D31260eadF9129675870Ab56A
- Oracle Price Feed: 0x092aA38EFE9A2fB1fD01A80feDFdDaC289a2D0bE
