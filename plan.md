ARCHITECTURAL BLUEPRINT: SOMNIA OMNISCIENCE (REAL-TIME TESTNET OBSERVATORY)
Role: You are a Senior Blockchain Engineer & UI Architect.
Objective: Build a high-performance network monitor for Somnia Testnet. 100% of the data must be live, pulled from the RPC. No placeholders.
Stack: React (Vite), Ethers.js v6, Tailwind CSS, Framer Motion.

1. DATA INGESTION ENGINE (The "Oracle" Hook)
Create a custom hook useSomniaSentinel.js. This is the heartbeat of the app.

Provider Setup: Connect to https://testnet-rpc.somnia.network (or current Testnet RPC).

Block Listener: Use provider.on("block", ...) to trigger an immediate fetch of the full block.

Transaction Parser: For each block, map through block.transactions:

Volume of Transactions: Sum of ethers.formatEther(tx.value).

Contract Deployments: Identify transactions where tx.to === null. Capture the tx.hash and the resulting contractAddress.

Asset Exchanges: Extract from, to, and value for the Live Ticker.

Burned Tokens: Calculate gasUsed * baseFeePerGas (EIP-1559) for the current block.

TPS Calculation: Maintain a sliding window of the last 10 block timestamps to calculate Transactions Per Second accurately.

2. SMART CONTRACT LAYER (OmniScanner.sol)
Deploy a helper contract to batch-read the Testnet state and reduce RPC calls.

Feature: Global Vitals. Returns (uint256 blockNumber, uint256 gasPrice, uint256 difficulty, uint256 lastBlockTime).

Feature: Congestion Logic. A function that compares baseFee of the last 3 blocks to return a "Network Health" status: OPTIMAL, STEADY, or CONGESTED.

Feature: Pulse Event. A dedicated event for the stress-test UI.

Strict Testing: Write a Hardhat/Foundry test for each getter to ensure zero-overflow and precise math.

3. UI QUADRANTS & FEATURE SPECIFICATIONS
[QUADRANT 1: THE TACTICAL MAP - CENTRAL]
Live Pulse: Every time a new tx.hash is detected, trigger a Cyan ripple at a random grid coordinate (coordinated by the hash's last digits for "fake-random" consistency).

Deployment Pillars: When a new contract is detected, render a Gold 3D-effect pillar. Hovering over the pillar must show the real contract address.

Global Flux: Animated lines across the grid. Animation speed must be mapped directly to currentTPS.

[QUADRANT 2: SENTINEL NEURAL FEED - RIGHT]
Live Analysis Log: A terminal window. Format: [TIME] TYPE | DATA | HASH.

Example: [14:02:21] DEPLOY | New Contract: 0x71C... | Tx: 0xab2...

Example: [14:02:23] WHALE  | Transfer: 500 STT | From: 0x123...

Live TPS Ticker: A massive digital display (JetBrains Mono) that updates every block.

[QUADRANT 3: NETWORK VITALS - TOP]
Gas Tracker: Real-time Gwei display. Color: Cyan < 10 Gwei, Gold 10-50, Red > 50.

Burn Counter: A "Total STT Destroyed" counter that increments in real-time as blocks are mined.

Health Meter: A pulsing circular radar indicating the "Stability Score" (calculated on-chain).

[QUADRANT 4: MARKET & ASSETS - BOTTOM]
Asset Exchange Marquee: A scrolling list of real, live transfers. Clicking a transfer opens the Somnia Block Explorer for that tx.hash.

Price Nervousness: A "Simulated Price" based on the ratio of Volume / Gas. If volume spikes, the price numbers "vibrate" (Jitter effect) to show high-frequency activity.

4. DESIGN & FINISH (Professionalism)
Colors: Background #0B0E11, Accents #D4AF37 (Gold) and #00F5FF (Cyan).

Typography: Headers in Orbitron, Data in JetBrains Mono.

No Rounding: All containers must have border-radius: 0px. Use clip-path for chamfered corners.

Boot Sequence: On mount, the terminal must run a script: INIT_SENTINEL..., CONNECTING_RPC..., FETCHING_GENESIS_STATE..., SYSTEM_ONLINE.

5. EXECUTION STEPS FOR ANTIGRAVITY
Phase 1: Connectivity. Establish RPC link and log the first 5 real transactions in the console to prove data flow.

Phase 2: Logic. Build the useSomniaSentinel hook and verify the TPS and Burn math.

Phase 3: Visuals. Build the Obsidian Grid and the Gold/Cyan layout.

Phase 4: Integration. Connect the live data stream to the UI components.

Phase 5: Stress Test. Ensure the UI remains responsive (60fps) even during high transaction bursts.