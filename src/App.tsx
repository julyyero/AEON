import { useState, useEffect } from 'react';
import { BrowserProvider, Contract, formatEther, formatUnits, parseEther, parseUnits } from 'ethers';
import { motion, useScroll, useTransform } from 'framer-motion';
// @ts-ignore
import { useSomniaSentinel } from './hooks/useSomniaSentinel';

// Fallback Hardhat Address, update manually or implement input in prod
const CONTRACT_ADDRESSES = {
  PUSD: "0x574c820580da3f6D31260eadF9129675870Ab56A", 
  PRICE_FEED: "0x092aA38EFE9A2fB1fD01A80feDFdDaC289a2D0bE",
  LENDING: "0xdeeE2596e7f35d814883E56cb16767bfB472cE6A" 
};

// ABI Simplifiés pour gagner de la place
const LENDING_ABI = [
  "function deposit() external payable",
  "function borrow(uint256 amount) external",
  "function repay(uint256 amount) external",
  "function getAccountData(address user) external view returns (uint256 collateral, uint256 debt, uint256 hf)",
  "event RiskAlert(address indexed user, uint256 healthFactor, uint256 collateralValue, uint256 debt)",
  "event Liquidated(address indexed user, uint256 debtRecovered, uint256 collateralLiquidated)"
];

const PRICE_FEED_ABI = [
  "function getPrice() external view returns (uint256)",
  "function setPrice(uint256 _price) external",
  "event PriceUpdated(uint256 newPrice)"
];

const TOKEN_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function totalSupply() view returns (uint256)"
];

export default function App() {
  const [account, setAccount] = useState<string>('');
  
  // Parallax / Evaporation Scroll
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 600], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 600], [1, 0.95]);
  const heroY = useTransform(scrollY, [0, 600], [0, 200]);
  
  // === OMNISCIENCE OBSERVATORY DATA ===
  const omni = useSomniaSentinel();
  const [observatoryImpacts, setObservatoryImpacts] = useState<any[]>([]);
  const [, setTick] = useState(0);

  // Force re-render every second so the map stays alive (opacity fading, animations)
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
      // Clean up impacts older than 60s
      setObservatoryImpacts(prev => prev.filter(imp => Date.now() - imp.born < 60000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Add new impacts when new transactions arrive
  useEffect(() => {
    if (!omni.transactions || omni.transactions.length === 0) return;
    const now = Date.now();
    const newImpacts = omni.transactions.slice(0, 15).map((tx: any) => ({
      id: tx.hash + '-' + now,
      x: parseInt(tx.hash.slice(-4), 16) % 85 + 7,
      y: parseInt(tx.hash.slice(-8, -4), 16) % 75 + 12,
      type: tx.type,
      value: tx.value,
      from: tx.from,
      to: tx.to,
      born: now,
    }));
    setObservatoryImpacts(prev => [...newImpacts, ...prev].slice(0, 60));
  }, [omni.transactions]);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [lendingContract, setLendingContract] = useState<Contract | null>(null);
  const [oracleContract, setOracleContract] = useState<Contract | null>(null);
  
  const [balances, setBalances] = useState({ sttDetails: "0.00", debt: "0.00", hf: "Max", sttWallet: "0.00", pusdWallet: "0.00" });
  const [currentPrice, setCurrentPrice] = useState("2500");
  const [marketRisk, setMarketRisk] = useState("Safe");
  
  // Market Stats
  const [totalLiquidity, setTotalLiquidity] = useState("0");
  const [circulatingSupply, setCirculatingSupply] = useState("0");

  // States pour Inputs
  const [depositAmount, setDepositAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  // Navigation (Tabs)
  const [activeTab, setActiveTab] = useState('vault');

  // AI Logs
  const [aiLogs, setAiLogs] = useState<{time: string, msg: string, type: string}[]>([]);

  useEffect(() => {
    document.documentElement.style.setProperty('--site-bg-rgb', '253, 252, 248');
    document.documentElement.style.setProperty('--site-bg', '#FDFCF8');
  }, []);

  // INIT PROVIDER
  useEffect(() => {
    if (window.ethereum) {
      const prov = new BrowserProvider(window.ethereum);
      setProvider(prov);
    }
  }, []);

  const connectWallet = async () => {
    if (!provider) return alert("MetaMask not found!");
    const accounts = await provider.send("eth_requestAccounts", []);
    setAccount(accounts[0]);
    
    const signer = await provider.getSigner();
    const lContract = new Contract(CONTRACT_ADDRESSES.LENDING, LENDING_ABI, signer);
    const oContract = new Contract(CONTRACT_ADDRESSES.PRICE_FEED, PRICE_FEED_ABI, signer);
    setLendingContract(lContract);
    setOracleContract(oContract);
    
    lContract.removeAllListeners();
    lContract.on("RiskAlert", (user, hfEvent) => {
      const formattedHF = parseFloat(formatUnits(hfEvent, 18)).toFixed(2);
      addLog(`[SENTINEL API] Alert detected for ${user.substring(0,6)}... Critical HF: ${formattedHF}. Generating mitigation path...`, "warning");
      
      setTimeout(() => {
        addLog(`🧠 [AI] : "Volatility threatens your position (HF: ${formattedHF}). Add Collateral immediately or Repay Debt."`, "ai");
      }, 1000);
    });

    lContract.on("Liquidated", (user) => {
      addLog(`💥 [HOT WALLET] Liquidation Executed for ${user.substring(0,6)}... Protocol Secured.`, "danger");
      refreshData(lContract, oContract, accounts[0], signer);
    });

    oContract.on("PriceUpdated", (newPrice) => {
      const formattedPrice = formatUnits(newPrice, 18);
      setCurrentPrice(parseFloat(formattedPrice).toFixed(2));
      addLog(`📉 [ORACLE] Flash Crash Detected! 1 STT = $${formattedPrice}`, "info");
      refreshData(lContract, oContract, accounts[0], signer);
    });

    refreshData(lContract, oContract, accounts[0], signer);
  };

  const addLog = (msg: string, type: string) => {
    setAiLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 15));
  };

  const refreshData = async (lCont: Contract, oCont: Contract, userAddr: string, signer: any) => {
    try {
      const data = await lCont.getAccountData(userAddr);
      const price = await oCont.getPrice();
      const pToken = new Contract(CONTRACT_ADDRESSES.PUSD, TOKEN_ABI, signer);
      
      const balPusd = await pToken.balanceOf(userAddr);
      const balStt = await signer.provider.getBalance(userAddr);

      const tvlRaw = await signer.provider.getBalance(CONTRACT_ADDRESSES.LENDING);
      setTotalLiquidity(parseFloat(formatEther(tvlRaw)).toFixed(2));
      
      try {
        const supplyRaw = await pToken.totalSupply();
        setCirculatingSupply(parseFloat(formatUnits(supplyRaw, 18)).toFixed(2));
      } catch(e) {}

      let hfVal = formatUnits(data.hf, 18);
      if (data.hf > parseUnits("1000", 18)) hfVal = "Max";

      setBalances({
        sttDetails: parseFloat(formatEther(data.collateral)).toFixed(4),
        debt: parseFloat(formatUnits(data.debt, 18)).toFixed(2),
        hf: parseFloat(hfVal) > 10 ? "Max" : parseFloat(hfVal).toFixed(2),
        sttWallet: parseFloat(formatEther(balStt)).toFixed(4),
        pusdWallet: parseFloat(formatUnits(balPusd, 18)).toFixed(2)
      });
      setCurrentPrice(parseFloat(formatUnits(price, 18)).toFixed(2));

      const hfNum = parseFloat(hfVal);
      if (hfNum < 1.0) setMarketRisk("Liquidated");
      else if (hfNum <= 1.5) setMarketRisk("High Risk");
      else setMarketRisk("Safe");

    } catch (e) {
      console.error(e);
    }
  };

  const handleTx = async (action: 'deposit' | 'borrow' | 'repay') => {
    if (!lendingContract) return;
    try {
      let tx;
      if (action === 'deposit') {
        tx = await lendingContract.deposit({ value: parseEther(depositAmount) });
      } else if (action === 'borrow') {
        tx = await lendingContract.borrow(parseUnits(borrowAmount, 18));
      } else if (action === 'repay') {
        tx = await lendingContract.repay(parseUnits(repayAmount, 18), { gasLimit: 500000 });
      }
      addLog(`⏳ Broadcasting Transaction: ${action.toUpperCase()}...`, "info");
      await tx.wait();
      addLog(`✅ Transaction Confirmed: ${action.toUpperCase()}`, "success");
      
      if (action==='deposit') setDepositAmount("");
      if (action==='borrow') setBorrowAmount("");
      if (action==='repay') setRepayAmount("");

      const signer = await provider!.getSigner();
      refreshData(lendingContract, oracleContract!, account, signer);
    } catch (error: any) {
      addLog(`❌ Error: ${error.message || "Transaction Rejected"}`, "danger");
    }
  };

  const triggerCrash = async () => {
    if(!oracleContract) return;
    try {
      const newP = "1100";
      addLog("⚡ [TESTNET SIMULATION] Injecting Flash Crash to Oracle... ($1100)", "danger");
      const tx = await oracleContract.setPrice(parseUnits(newP, 18));
      await tx.wait();
    } catch(e) {}
  };

  let gaugeColor = "bg-green-500";
  let hfTextClass = "text-green-600";
  let hfPercentage = 100;
  
  if (balances.hf !== "Max") {
    const num = parseFloat(balances.hf);
    if (num < 1.1) {
      gaugeColor = "bg-red-500";
      hfTextClass = "text-red-600";
      hfPercentage = Math.max(10, (num / 2) * 100);
    } else if (num <= 1.5) {
      gaugeColor = "bg-orange-400";
      hfTextClass = "text-orange-500";
      hfPercentage = Math.min(75, (num / 2) * 100);
    } else {
      hfPercentage = Math.min(100, (num / 3) * 100);
    }
  }

  return (
    <div 
      className="bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:32px_32px] text-[#2C2825] font-light h-screen w-screen overflow-x-hidden overflow-y-auto scroll-smooth relative"
      style={{ backgroundColor: "var(--site-bg, #FDFCF8)", fontFamily: "'Coolvetica', sans-serif", letterSpacing: "-0.02em" }}
    >
      
      {/* ========================================= */}
      {/* FIXED BACKGROUND PILLARS (Ne bougent jamais) */}
      {/* ========================================= */}
      <div className="fixed inset-0 w-screen h-screen pointer-events-none z-0 overflow-hidden opacity-30">
        <div className="absolute inset-y-0 right-0 flex justify-end items-center">
          <img src="/poteaux_grecque.png" alt="" className="w-auto h-[120vh] max-w-none scale-x-[-1] translate-x-[5vh]" style={{ mixBlendMode: 'multiply', filter: 'brightness(1.15) contrast(1.1)', maskImage: 'linear-gradient(to left, black 40%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to left, black 40%, transparent 100%)' }} />
        </div>
      </div>

      {/* ========================================= */}
      {/* HERO SCREEN (S'évapore au scroll)  */}
      {/* ========================================= */}
      <motion.section 
        style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
        className="relative w-screen h-screen flex flex-col items-center justify-center shrink-0 z-10"
      >
        <div className="absolute inset-y-0 left-0 flex justify-start items-center opacity-30 pointer-events-none z-0">
          <img src="/poteaux_grecque.png" alt="" className="w-auto h-[120vh] max-w-none -translate-x-[5vh]" style={{ mixBlendMode: 'multiply', filter: 'brightness(1.15) contrast(1.1)', maskImage: 'linear-gradient(to right, black 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, black 50%, transparent 100%)' }} />
        </div>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-white/40 rounded-full blur-[100px] pointer-events-none z-0"></div>

        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
          className="z-20 flex flex-col items-center gap-3"
        >
          <h1 
            className="tracking-[0.25em] text-[#A67E24] font-light text-8xl md:text-[10rem]"
            style={{ textShadow: "0px 10px 30px rgba(166, 126, 36, 0.15)", fontFamily: "'Cinzel', serif" }}
          >
            AEON
          </h1>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ duration: 2, delay: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
        >
          <p className="text-[10px] text-[#A67E24] tracking-[0.3em] uppercase font-bold">Scroll Down</p>
          <div className="w-[1px] h-12 bg-gradient-to-b from-[#C19B4B]/60 to-transparent animate-pulse"></div>
        </motion.div>
      </motion.section>

      {/* ========================================= */}
      {/* DASHBOARD (Section Contenu)  */}
      {/* ========================================= */}
      <section className="relative w-screen min-h-screen flex z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.05)] border-t border-[#C19B4B]/20">
        
        {/* TITRE AEON MINIMALISTE AU TOP */}
        <div className="absolute top-10 left-12 z-[60] pointer-events-none">
          <h1 
            className="tracking-[0.25em] text-[#A67E24] font-light text-2xl"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            AEON
          </h1>
        </div>
          
          {/* SIDEBAR NAVIGATION - OPAQUE */}
          <aside className="w-[280px] min-h-screen flex flex-col pt-32 pb-10 px-8 z-40 relative group/sidebar border-r border-[#C19B4B]/20 bg-[#FDFCF8] shadow-[20px_0_50px_rgba(0,0,0,0.02)]">
             
             <nav className="flex flex-col flex-1 mt-8 sticky top-32">
                {[
                  { id: 'vault', label: 'Vault' },
                  { id: 'sentinel', label: 'Monitor' },
                  { id: 'observatory', label: 'Observatory' },
                  { id: 'docs', label: 'Docs' },
                  { id: 'team', label: 'Team' }
                ].map((tab, idx) => (
                  <div key={tab.id} className={`${idx !== 0 ? 'mt-3' : ''}`}>
                    <button 
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full text-left group flex items-center transition-all duration-300 ease-out py-4 px-4 rounded shadow-sm border
                        ${activeTab === tab.id 
                          ? 'bg-white text-[#A67E24] border-[#C19B4B]/30 translate-x-3 shadow-md' 
                          : 'bg-white/40 text-[#8F7744] border-transparent hover:bg-white hover:text-[#A67E24] hover:shadow hover:border-[#C19B4B]/20'
                        }`}
                    >
                      <span className="uppercase tracking-[0.2em] text-[10px] font-bold origin-left inline-block">{tab.label}</span>
                    </button>
                  </div>
                ))}
             </nav>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className="flex-1 w-full px-8 lg:px-12 py-32 relative z-30">
            {/* CONNECT WALLET BUTTON - TOP RIGHT */}
            <div className="absolute top-8 right-10 z-50">
              <button 
                onClick={connectWallet}
                className={`text-xs font-sans font-light tracking-[0.2em] transition-all duration-500 uppercase ${
                  account 
                    ? 'text-[#A67E24]/70 hover:text-[#A67E24]' 
                    : 'text-[#A67E24] hover:tracking-[0.3em]'
                }`}
              >
                {account ? `✦ ${account.substring(0,6)}..${account.slice(-4)}` : 'Connect Wallet'}
              </button>
            </div>
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="max-w-[850px] w-full relative"
            >
              
                  {/* ONGLET 1 : VAULT */}
                  {activeTab === 'vault' && (
                    <div className="animate-fade-in-up w-full grid grid-cols-1 lg:grid-cols-12 gap-12 border-none">
                      
                      {/* POSITION OVERVIEW */}
                      <div className="lg:col-span-8 flex flex-col justify-between py-6">
                        <div className="mb-10">
                          <h3 className="text-sm tracking-[0.2em] font-sans font-bold text-[#A67E24] uppercase border-b border-black/15 pb-4 inline-block pr-12">
                             Position Overview
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                          <div className="overflow-hidden">
                            <p className="text-black/50 text-[10px] uppercase tracking-widest font-bold mb-3 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-black/40 block"></span> Your Collateral (STT)</p>
                            <h2 className="text-3xl lg:text-4xl font-sans font-bold tracking-tighter text-black truncate">{balances.sttDetails}</h2>
                            <p className="text-black/40 text-xs mt-2 uppercase tracking-wide">Wallet: <span className="text-black font-semibold">{balances.sttWallet}</span></p>
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-black/50 text-[10px] uppercase tracking-widest font-bold mb-3 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-black/30 block"></span> Your Debt (aeonUSDC)</p>
                            <h2 className="text-3xl lg:text-4xl font-sans font-bold tracking-tighter text-black truncate">{balances.debt}</h2>
                            <p className="text-black/40 text-xs mt-2 uppercase tracking-wide">Wallet: <span className="text-black font-semibold">{balances.pusdWallet}</span></p>
                          </div>
                        </div>
                      </div>

                      {/* HEALTH FACTOR */}
                      <div className="lg:col-span-4 flex flex-col justify-center pl-4 pr-8 pt-16 relative">
                        <p className="text-black/50 text-[10px] font-bold tracking-[0.2em] uppercase mb-2">Health Factor</p>

                        <h2 className="text-4xl lg:text-5xl font-bold tracking-tighter mb-4 text-black" style={{ fontFamily: "'Cinzel', serif" }}>
                          {balances.hf}
                        </h2>

                        {/* Elegant linear bar */}
                        <div className="w-full relative mb-6">
                          <div className="w-full h-[3px] bg-black/10 relative overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-1000 ease-out ${
                                balances.hf === 'Max' ? 'bg-black/40' :
                                parseFloat(balances.hf) < 1.1 ? 'bg-red-500' :
                                parseFloat(balances.hf) <= 1.5 ? 'bg-orange-400' : 'bg-black/40'
                              }`}
                              style={{ width: `${hfPercentage}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-2">
                            <span className="text-[8px] text-black/30 uppercase tracking-widest font-bold">0</span>
                            <span className="text-[8px] text-black/30 uppercase tracking-widest font-bold">1.0</span>
                            <span className="text-[8px] text-black/30 uppercase tracking-widest font-bold">1.5</span>
                            <span className="text-[8px] text-black/30 uppercase tracking-widest font-bold">∞</span>
                          </div>
                        </div>

                        <p className="text-[11px] text-black/40 leading-relaxed">If below 1.0, Sentinel will liquidate your STT collateral to secure the protocol. Keep it above 1.5 for safety.</p>
                      </div>

                      {/* VAULT ACTIONS */}
                      <div className="lg:col-span-12 mt-6 pt-6">
                        <h3 className="text-sm tracking-[0.2em] font-sans font-bold text-black uppercase mb-8">
                           Vault Operations
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-[600px]">
                          
                          {/* DEPOSIT */}
                          <div className="group flex flex-col">
                            <label className="text-[10px] text-black/60 font-bold uppercase tracking-[0.2em] block mb-3">Deposit Collateral</label>
                            <input type="number" value={depositAmount} onChange={e=>setDepositAmount(e.target.value)} className="w-full bg-transparent border-b-2 border-black/15 pb-3 mb-5 focus:outline-none focus:border-black text-3xl font-sans font-bold tracking-tight text-black placeholder-black/20 transition-colors" placeholder="0.0STT" />
                            <button onClick={() => handleTx('deposit')} className="py-4 px-8 bg-white/40 rounded shadow-sm border border-transparent hover:bg-white hover:shadow-md hover:border-black/10 transition-all duration-300 font-bold tracking-widest text-black text-[10px] uppercase">Supply STT</button>
                          </div>

                          {/* BORROW */}
                          <div className="group flex flex-col">
                            <label className="text-[10px] text-black/60 font-bold uppercase tracking-[0.2em] block mb-3">Borrow aeonUSDC</label>
                            <input type="number" value={borrowAmount} onChange={e=>setBorrowAmount(e.target.value)} className="w-full bg-transparent border-b-2 border-black/15 pb-3 mb-5 focus:outline-none focus:border-black text-3xl font-sans font-bold tracking-tight text-black placeholder-black/20 transition-colors" placeholder="0.0aeUSD" />
                            <button onClick={() => handleTx('borrow')} className="py-4 px-8 bg-white/40 rounded shadow-sm border border-transparent hover:bg-white hover:shadow-md hover:border-black/10 transition-all duration-300 font-bold tracking-widest text-black text-[10px] uppercase">Borrow Funds</button>
                          </div>

                          {/* REPAY */}
                          <div className="group flex flex-col">
                            <label className="text-[10px] text-black/60 font-bold uppercase tracking-[0.2em] block mb-3">Repay Debt</label>
                            <input type="number" value={repayAmount} onChange={e=>setRepayAmount(e.target.value)} className="w-full bg-transparent border-b-2 border-black/15 pb-3 mb-5 focus:outline-none focus:border-black text-3xl font-sans font-bold tracking-tight text-black placeholder-black/20 transition-colors" placeholder="0.0aeUSD" />
                            <button onClick={() => handleTx('repay')} className="py-4 px-8 bg-white/40 rounded shadow-sm border border-transparent hover:bg-white hover:shadow-md hover:border-black/10 transition-all duration-300 font-bold tracking-widest text-black text-[10px] uppercase">Repay Loan</button>
                          </div>

                          {/* WITHDRAW */}
                          <div className="group flex flex-col opacity-60 hover:opacity-100 transition-opacity duration-500">
                            <label className="text-[10px] text-black/40 font-bold uppercase tracking-[0.2em] block mb-3">Withdraw STT</label>
                            <input disabled type="number" value={withdrawAmount} onChange={e=>setWithdrawAmount(e.target.value)} className="w-full bg-transparent border-b-2 border-black/10 pb-3 mb-5 focus:outline-none text-3xl font-sans font-bold tracking-tight text-black/40" placeholder="Auto" />
                            <button onClick={() => alert("Per Vault rules, collateral is locked while debt exists. Repay 100% of your debt, and the smart contract will automatically transfer your collateral back to your wallet.")} className="py-4 px-8 bg-white/40 rounded shadow-sm border border-transparent hover:bg-white hover:shadow-md hover:border-black/10 transition-all font-bold tracking-widest text-black/40 hover:text-black text-[10px] uppercase">Withdraw</button>
                          </div>

                        </div>
                      </div>
                    </div>
                  )}

                  {/* ONGLET 2 : SENTINEL MONITOR & STATS */}
                  {activeTab === 'sentinel' && (
                    <div className="animate-fade-in-up w-full flex flex-col gap-12 border-none">
                      
                      {/* MARKET STATS */}
                      <div>
                        <h3 className="text-sm tracking-[0.2em] font-sans font-bold text-[#A67E24] uppercase mb-8">Market Statistics</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full max-w-[600px]">
                          <div className="overflow-hidden">
                            <p className="text-black/50 text-[10px] tracking-widest uppercase font-bold mb-3">Protocol Liquidity (TVL)</p>
                            <h2 className="text-3xl lg:text-4xl font-sans font-bold tracking-tighter text-black mb-1 truncate">{totalLiquidity} <span className="text-sm text-black/40">STT</span></h2>
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-black/50 text-[10px] tracking-widest uppercase font-bold mb-3">Circulating aeonUSDC</p>
                            <h2 className="text-3xl lg:text-4xl font-sans font-bold tracking-tighter text-black mb-1 truncate">{circulatingSupply} <span className="text-sm text-black/40">aeUSD</span></h2>
                          </div>
                        </div>
                      </div>

                      <hr className="border-t border-black/10" />

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
                        {/* LOGS */}
                        <div className="md:col-span-7 flex flex-col min-h-[400px] border-l border-black/10 pl-8 relative">
                          <div className="mb-8 flex items-center justify-between">
                            <h3 className="font-sans font-bold tracking-[0.2em] text-[#A67E24] text-sm uppercase">
                              Sentinel Live Feed
                            </h3>
                            <span className="text-[9px] px-3 py-1.5 bg-black/5 text-black/60 font-bold border border-black/10 uppercase tracking-[0.2em] rounded flex items-center gap-2">
                               <span className="w-1.5 h-1.5 rounded-full bg-green-500 block"></span> Active
                            </span>
                          </div>
                          <div className="flex-1 overflow-y-auto text-sm flex flex-col gap-4 max-h-[500px] pr-4">
                            {aiLogs.length === 0 ? (
                              <div className="text-black/30 text-center mt-20 italic tracking-wider">The Sentinel is peacefully monitoring block flow...</div>
                            ) : (
                              aiLogs.map((log, i) => (
                                <div key={i} className={`p-5 border-l-[2px] leading-relaxed bg-white/40 rounded shadow-sm
                                  ${log.type === 'ai' ? 'border-black/40 text-black/80' :
                                  log.type === 'danger' ? 'border-red-500 text-red-800' :
                                  log.type === 'warning' ? 'border-orange-500 text-orange-800' :
                                  log.type === 'success' ? 'border-green-500 text-green-800' :
                                  'border-black/20 text-black/70'}`}>
                                  <span className="text-[9px] opacity-50 block mb-2 uppercase tracking-widest font-bold">{log.time}</span>
                                  <span className="tracking-wide text-sm">{log.msg}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* SIMULATIONS */}
                        <div className="md:col-span-5 flex flex-col border-l border-black/10 pl-8">
                          <h3 className="text-sm text-[#A67E24] tracking-[0.2em] uppercase mb-8 font-bold">Stress Test</h3>
                          <p className="text-black/40 text-sm tracking-wider leading-relaxed mb-10">Trigger an Oracle price drop event to force a sudden decrease in the STT collateral utility index.</p>
                          
                          <div className="mb-10 overflow-hidden">
                             <p className="text-black/50 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">Target Oracle Price</p>
                             <h2 className="text-3xl lg:text-4xl font-sans font-bold tracking-tighter text-black truncate">${currentPrice} <span className="text-xs tracking-widest text-black/40">PUSD/STT</span></h2>
                          </div>

                          <button onClick={triggerCrash} className="py-4 px-8 text-[10px] font-bold tracking-[0.2em] uppercase bg-white/40 rounded shadow-sm border border-transparent hover:bg-white hover:shadow-md hover:border-black/10 transition-all duration-300 text-black w-fit">
                                Trigger Flash Crash ($1100)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ONGLET 4 : DOCUMENTATION */}
                  {activeTab === 'docs' && (
                    <div className="animate-fade-in-up border-none min-h-[400px] max-w-[700px]">
                      <h3 className="text-sm tracking-[0.2em] font-sans font-bold text-[#A67E24] uppercase mb-6">Protocol Tomes</h3>

                      <div className="mb-10 text-sm leading-relaxed text-black/60 border-l-[2px] border-[#A67E24]/30 pl-6">
                        <p className="mb-4">
                          <strong className="text-black">The AEON Protocol</strong> is a high-end, decentralized lending and borrowing platform built on the blazing-fast Somnia Network. Users can deposit STT collateral to mint and borrow <em>aeonUSDC</em>, a stable asset pegged to the US Dollar.
                        </p>
                        <p>
                          To maintain market stability, the protocol utilizes an advanced AI-driven liquidation system known as the <strong>Sentinel Engine</strong>. Combined with the <strong>Omniscience Observatory</strong>, borrowers have unprecedented real-time visibility into network congestion, whale movements, and oracle latency, allowing them to intelligently manage their Health Factor and avoid sudden liquidations.
                        </p>
                      </div>

                      {/* SECTION I */}
                      <div className="mb-12">
                        <p className="text-[10px] tracking-[0.2em] uppercase text-black/50 font-bold mb-6">I. Smart Contracts Layer</p>
                        {[
                          { name: 'AeonCore.sol', desc: 'Core contract verifying deployment state & network health via getStatus().', limits: 'Basic status checks. No RBAC or upgradability.' },
                          { name: 'PulseGuardLending.sol', desc: 'Handles STT collateral deposits, aeonUSDC borrowing/repaying, and real-time Health Factor tracking with RiskAlerts.', limits: 'Simplified liquidation math. Static APY curve.' },
                          { name: 'MockPriceFeed.sol', desc: 'Simulated Chainlink-style Oracle for testing flash crashes.', limits: 'Centralized mock. Needs Pyth/Chainlink for mainnet.' },
                          { name: 'AeonToken.sol', desc: 'ERC20 debt/stablecoin token (aeonUSDC).', limits: 'Unrestricted Mint/Burn (Testnet only).' },
                        ].map((c, i) => (
                          <div key={i} className="border-l-2 border-black/10 hover:border-black/30 pl-6 mb-6 transition-colors duration-300">
                            <h4 className="font-sans font-bold text-black text-sm tracking-wide mb-1">{c.name}</h4>
                            <p className="text-sm text-black/60 leading-relaxed mb-1">{c.desc}</p>
                            <p className="text-xs text-black/30 italic">Limitations: {c.limits}</p>
                          </div>
                        ))}
                      </div>

                      {/* SECTION II */}
                      <div className="mb-12">
                        <p className="text-[10px] tracking-[0.2em] uppercase text-black/50 font-bold mb-6">II. Sentinel & Observatory Engine</p>
                        {[
                          { name: 'useSomniaSentinel.ts', desc: 'Live RPC pipeline listening to the Somnia Network. Streams transactions, gas fees, and detects whales or contract calls in real-time.', limits: 'Client-side polling instead of websockets.' },
                          { name: 'Borrower Risk Advisory', desc: 'Dynamic alert system calculating network congestion, oracle latency, and sudden whale movements to warn users before liquidations.', limits: 'Heuristic-based volatility predictions.' },
                          { name: 'aiSentinel.ts', desc: 'Reactive brain listening to RiskAlerts and simulating liquidation actions.', limits: 'Centralized bot. Needs decentralized Keeper network.' },
                        ].map((c, i) => (
                          <div key={i} className="border-l-2 border-black/10 hover:border-black/30 pl-6 mb-6 transition-colors duration-300">
                            <h4 className="font-sans font-bold text-black text-sm tracking-wide mb-1">{c.name}</h4>
                            <p className="text-sm text-black/60 leading-relaxed mb-1">{c.desc}</p>
                            <p className="text-xs text-black/30 italic">Limitations: {c.limits}</p>
                          </div>
                        ))}
                      </div>

                      {/* SECTION III */}
                      <div className="mb-12">
                        <p className="text-[10px] tracking-[0.2em] uppercase text-black/50 font-bold mb-6">III. Roadmap</p>
                        <div className="border-l-2 border-black/10 pl-6 space-y-3">
                          {['Decentralize Price Oracles (Pyth/Chainlink)', 'Deploy decentralized Sentinel Keepers', 'Implement indexed data API (TheGraph/Goldsky)'].map((step, i) => (
                            <p key={i} className="text-sm text-black/50 flex items-start gap-2">
                              <span className="text-black font-bold">{i + 1}.</span> {step}
                            </p>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* ONGLET 5 : MEET THE TEAM */}
                  {activeTab === 'team' && (
                    <div className="animate-fade-in-up border-none min-h-[400px]">
                      <h3 className="text-sm tracking-[0.2em] font-sans font-bold text-[#A67E24] uppercase mb-12">The Architects</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-[600px]">
                        {[1,2,3].map((i) => (
                          <div key={i} className="flex flex-col group cursor-pointer border-l-2 border-black/10 hover:border-black/30 pl-6 transition-all duration-300">
                            <div className="w-20 h-20 rounded-full bg-white/40 border border-black/10 mb-4 flex items-center justify-center group-hover:scale-105 transition-transform duration-500 shadow-sm">
                              <span className="text-3xl text-black font-sans font-bold tracking-tighter">{i}</span>
                            </div>
                            <h4 className="font-sans font-bold tracking-[0.1em] text-black text-lg mb-1">Architect #{i}</h4>
                            <p className="text-[10px] uppercase tracking-widest text-black/40 font-bold">AI & DeFi Engine</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ONGLET 6 : OMNISCIENCE OBSERVATORY */}
                  {activeTab === 'observatory' && (
                    <div className="animate-fade-in-up border-none min-h-[400px]">
                      <style>{`
                        @keyframes radar-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                        @keyframes pulse-ring { 0% { transform: scale(0.95); opacity: 0.3; } 50% { transform: scale(1.05); opacity: 0.1; } 100% { transform: scale(0.95); opacity: 0.3; } }
                        @keyframes impact-appear { 0% { transform: translate(-50%, -50%) scale(0); opacity: 0; } 50% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.85; } }
                        @keyframes ripple { 0% { transform: translate(-50%, -50%) scale(1); opacity: 0.4; } 100% { transform: translate(-50%, -50%) scale(3); opacity: 0; } }
                        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
                        .radar-sweep { animation: radar-spin 8s linear infinite; }
                        .pulse-ring-anim { animation: pulse-ring 3s ease-in-out infinite; }
                        .impact-dot { animation: impact-appear 0.6s ease-out forwards; }
                        .ripple-effect { animation: ripple 2s ease-out infinite; }
                        .blink-dot { animation: blink 1.5s ease-in-out infinite; }
                        @keyframes highlight-flash { 0% { background: rgba(0,0,0,0.08); } 100% { background: transparent; } }
                        .log-highlight { animation: highlight-flash 1.5s ease-out; }
                        @keyframes sonar-ping {
                          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; border-width: 2px; }
                          100% { transform: translate(-50%, -50%) scale(5); opacity: 0; border-width: 0px; }
                        }
                        .dot-highlight .sonar-ring {
                          animation: sonar-ping 1.5s cubic-bezier(0, 0, 0.2, 1) forwards;
                          display: block !important;
                        }
                        .dot-highlight .dot-shape {
                          background-color: #A67E24 !important;
                          border-color: #8C6A1D !important;
                          transform: translate(-50%, -50%) scale(1.5) !important;
                          z-index: 50;
                          box-shadow: 0 0 15px rgba(166,126,36,0.6);
                        }
                      `}</style>
                      
                      {(() => {
                        const isCongested = omni.tps > 20;
                        const recentWhale = observatoryImpacts.find((imp: any) => imp.type === 'WHALE' && Date.now() - imp.born <= 15000);
                        const isOracleSynced = true; // Somnia blocks are very fast, oracles update per epoch

                        return (
                          <>
                      <h3 className="text-sm tracking-[0.2em] font-sans font-bold text-[#A67E24] uppercase mb-4">The Observatory</h3>
                      <p className="text-black/40 text-sm leading-relaxed mb-10 max-w-[600px]">
                        Real-time visualization of the <strong>Somnia blockchain</strong>. Each dot is a live transaction — its position is randomly derived from the transaction hash. Most transactions are <em>smart contract calls</em> (0 STT value) which represent DeFi interactions, swaps, or mints happening on the network.
                      </p>
                      
                      {/* NETWORK VITALS */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full max-w-[750px] mb-12">
                        <div>
                          <p className="text-black/50 text-[10px] tracking-widest uppercase font-bold mb-2">Block</p>
                          <h2 
                            className="text-2xl lg:text-3xl font-sans font-bold tracking-tighter text-black truncate cursor-help"
                            title={omni.blockData?.number ? `Block #${omni.blockData.number}` : 'Awaiting block...'}
                          >
                            #{omni.blockData?.number || '---'}
                          </h2>
                        </div>
                        <div>
                          <p className="text-black/50 text-[10px] tracking-widest uppercase font-bold mb-2">Throughput</p>
                          <h2 className="text-2xl lg:text-3xl font-sans font-bold tracking-tighter text-black truncate">{omni.tps.toFixed(1)} <span className="text-xs text-black/40">tx/s</span></h2>
                        </div>
                        <div>
                          <p className="text-black/50 text-[10px] tracking-widest uppercase font-bold mb-2">Burned</p>
                          <h2 className="text-2xl lg:text-3xl font-sans font-bold tracking-tighter text-black truncate">{omni.totalBurned.toFixed(4)} <span className="text-xs text-black/40">STT</span></h2>
                        </div>
                        <div>
                          <p className="text-black/50 text-[10px] tracking-widest uppercase font-bold mb-2">Status</p>
                          <h2 className="text-2xl lg:text-3xl font-sans font-bold tracking-tighter text-black flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 blink-dot"></span>
                            Live
                          </h2>
                        </div>
                      </div>

                      {/* SENTINEL ADVISORY */}
                      <div className="mb-14">
                        <p className="text-[10px] tracking-[0.2em] uppercase text-black/50 font-bold mb-4">Borrower Risk Advisory</p>
                        <div className="flex flex-col gap-3 w-full max-w-[750px]">
                          {/* Whale Alert */}
                          {recentWhale ? (
                            <div className="border border-[#A67E24]/30 bg-[#A67E24]/5 p-4 flex flex-col rounded">
                              <h4 className="font-bold text-[#A67E24] text-[11px] uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-[#A67E24] rounded-full animate-pulse"></span>
                                Whale Activity Detected
                              </h4>
                              <p className="text-black/60 text-[11px] leading-relaxed">A large transfer of <strong className="text-black font-semibold">{parseFloat(recentWhale.value).toFixed(2)} STT</strong> was just detected on-chain. Expect high price volatility. <strong className="text-[#A67E24] font-semibold">Advice:</strong> Check your Health Factor immediately to avoid unexpected liquidation.</p>
                            </div>
                          ) : (
                            <div className="border border-black/10 bg-white/5 p-4 flex flex-col rounded">
                              <h4 className="font-bold text-black border-b border-black/10 pb-2 text-[11px] uppercase tracking-widest mb-2">Market Conditions Stable</h4>
                              <p className="text-black/50 text-[11px] leading-relaxed">No significant whale movements detected recently. Price action is expected to remain stable. Your collateral is currently safe from sudden liquidation spikes.</p>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Congestion Alert */}
                            <div className={`border p-4 flex flex-col rounded ${isCongested ? 'border-black/20 bg-black/5' : 'border-black/10 bg-white/5'}`}>
                              <div className={`flex items-center justify-between border-b pb-2 mb-2 ${isCongested ? 'border-black/10' : 'border-black/5'}`}>
                                <h4 className={`font-bold text-[11px] uppercase tracking-widest ${isCongested ? 'text-black' : 'text-black/70'}`}>
                                  Network Traffic
                                </h4>
                                <span className={`font-mono text-[9px] px-2 py-0.5 rounded border ${isCongested ? 'bg-black text-white border-black' : 'bg-black/5 text-black/50 border-black/10'}`}>
                                  {omni.baseFee ? omni.baseFee.toFixed(3) : '0.000'} Gwei
                                </span>
                              </div>
                              <p className="text-black/50 text-[11px] leading-relaxed">
                                {isCongested 
                                  ? "High blockchain activity. Gas fees are elevated. Delay non-urgent Vault interactions if possible."
                                  : "Traffic is optimal. Gas fees are low—an ideal time to deposit collateral or repay debt cheaply."}
                              </p>
                            </div>

                            {/* Oracle Sync */}
                            <div className={`border p-4 flex flex-col rounded ${isOracleSynced ? 'border-black/10 bg-white/5' : 'border-[#A67E24]/30 bg-[#A67E24]/5'}`}>
                              <h4 className={`font-bold text-[11px] uppercase tracking-widest mb-2 flex items-center gap-2 ${isOracleSynced ? 'text-black/70 border-b border-black/5 pb-2' : 'text-[#A67E24]'}`}>
                                {isOracleSynced ? null : <span className="w-1.5 h-1.5 bg-[#A67E24] rounded-full animate-pulse"></span>}
                                Oracle Price Feeds
                              </h4>
                              <p className="text-black/50 text-[11px] leading-relaxed">
                                {isOracleSynced 
                                  ? "Price feeds are fully synchronized with the latest block. Your Health Factor calculation is 100% accurate."
                                  : "Oracle synchronization delayed. Health factor may not reflect true market conditions right now."}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* LIVE ACTIVITY MAP */}
                      <div className="mb-12">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] tracking-[0.2em] uppercase text-black/50 font-bold">Live Activity Map</p>
                          <p className="text-[10px] text-black/30">{observatoryImpacts.length} transactions tracked</p>
                        </div>
                        <p className="text-[9px] text-black/25 italic mb-4">Position is derived from transaction hash — not geographic</p>
                        <div className="relative w-full h-[420px] bg-[#FDFCF8] border border-black/8 overflow-hidden rounded-lg">
                          
                          {/* Animated radar rings */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-[70%] aspect-square border border-black/5 rounded-full pulse-ring-anim"></div>
                            <div className="absolute w-[45%] aspect-square border border-black/4 rounded-full pulse-ring-anim" style={{ animationDelay: '1s' }}></div>
                            <div className="absolute w-[20%] aspect-square border border-black/3 rounded-full pulse-ring-anim" style={{ animationDelay: '2s' }}></div>
                          </div>
                          
                          {/* Radar sweep line */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="radar-sweep" style={{ width: '50%', height: '2px', background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.06))', transformOrigin: 'left center' }}></div>
                          </div>

                          {/* Center label */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                              <div className="text-[10px] text-black/20 uppercase tracking-[0.3em] font-bold">Somnia</div>
                              <div className="text-[8px] text-black/10 uppercase tracking-widest mt-1">Network</div>
                            </div>
                          </div>
                          
                          {/* Transaction dots */}
                          {observatoryImpacts.slice(0, 40).map((impact: any, idx: number) => {
                            const age = (Date.now() - impact.born) / 1000;
                            const opacity = Math.max(0.2, 1 - age / 40);
                            const val = parseFloat(impact.value);
                            const isWhale = impact.type === 'WHALE';
                            const isDeploy = impact.type === 'DEPLOY';
                            const isCall = impact.type === 'CALL';
                            const size = isDeploy ? 18 : isWhale ? 16 : isCall ? 10 : Math.max(8, Math.min(14, val * 3 + 8));
                            
                            return (
                              <div
                                id={`dot-${impact.id.split('-')[0]}`}
                                key={impact.id}
                                className="absolute impact-dot group cursor-pointer"
                                style={{ 
                                  left: `${impact.x}%`, 
                                  top: `${impact.y}%`, 
                                  animationDelay: `${idx * 0.05}s`,
                                }}
                                onClick={() => {
                                  const hash = impact.id.split('-')[0];
                                  const el = document.getElementById(`log-${hash}`);
                                  if (el) {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    el.classList.remove('log-highlight');
                                    void el.offsetWidth;
                                    el.classList.add('log-highlight');
                                    if ((el as any)._timeoutId) clearTimeout((el as any)._timeoutId);
                                    (el as any)._timeoutId = setTimeout(() => el.classList.remove('log-highlight'), 2000);
                                  }
                                }}
                              >
                                {/* Ripple effect for new transactions */}
                                {age < 5 && (
                                  <div 
                                    className="absolute ripple-effect rounded-full border border-black/10"
                                    style={{ width: size * 3, height: size * 3, left: '50%', top: '50%' }}
                                  />
                                )}
                                
                                {/* The highlight sonar ring (hidden by default) */}
                                <div 
                                  className="absolute sonar-ring rounded-full border-[#A67E24] hidden pointer-events-none"
                                  style={{ width: size, height: size, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                                />

                                {/* The dot itself */}
                                <div
                                  className={`dot-shape rounded-full flex items-center justify-center transition-all duration-500 ${
                                    isDeploy ? 'bg-black/80 border-2 border-black/60' : 
                                    isWhale ? 'bg-black/70 border-2 border-black/50' : 
                                    isCall ? 'bg-black/50 border border-black/30' : 
                                    'bg-black/40 border border-black/20'
                                  }`}
                                  style={{ 
                                    width: size, 
                                    height: size, 
                                    opacity,
                                    transform: 'translate(-50%, -50%)',
                                  }}
                                />
                                
                                {/* Tooltip on hover */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                                  <div className="bg-white border border-black/10 rounded shadow-lg px-3 py-2 text-[9px] whitespace-nowrap">
                                    <div className="font-bold text-black uppercase tracking-wider mb-1">
                                      {isDeploy ? '⚡ Contract Deploy' : isWhale ? '🐋 Whale Transfer' : isCall ? '⚙ Contract Call' : '→ STT Transfer'}
                                    </div>
                                    <div className="text-black/50">{isCall ? 'Contract Interaction' : `${val.toFixed(4)} STT`}</div>
                                    {impact.from && <div className="text-black/30 mt-1">From: {impact.from.slice(0,8)}...</div>}
                                    {impact.to && <div className="text-black/30">To: {impact.to.slice(0,8)}...</div>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {observatoryImpacts.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="text-center">
                                <div className="w-3 h-3 rounded-full bg-black/10 mx-auto mb-3 blink-dot"></div>
                                <p className="text-black/20 italic tracking-wider text-sm">Connecting to Somnia network...</p>
                              </div>
                            </div>
                          )}
                          
                          {/* Legend */}
                          <div className="absolute bottom-3 right-3 bg-white/90 border border-black/8 p-3 flex flex-col gap-1.5 text-[9px] rounded">
                            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-black/50 border border-black/30"></div> <span className="text-black/50">Contract Call</span></div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-black/40 border border-black/20"></div> <span className="text-black/50">STT Transfer</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-black/70 border-2 border-black/50"></div> <span className="text-black/50">Whale (&gt;10 STT)</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-black/80 border-2 border-black/60"></div> <span className="text-black/50">Contract Deploy</span></div>
                          </div>

                          {/* Live counter */}
                          <div className="absolute top-3 right-3 bg-white/90 border border-black/8 px-3 py-1.5 rounded flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 blink-dot"></span>
                            <span className="text-[9px] text-black/50 font-bold uppercase tracking-wider">{omni.transactions?.length || 0} tx/block</span>
                          </div>
                        </div>
                      </div>

                      {/* GRAND LEDGER */}
                      <div>
                        <p className="text-[10px] tracking-[0.2em] uppercase text-black/50 font-bold mb-4">Event Stream — Latest Transactions</p>
                        <div className="max-h-[350px] overflow-y-auto">
                          {omni.logs.slice(0, 30).map((log: any, i: number) => (
                            <div 
                              key={i} 
                              id={`log-${log[3]}`} 
                              className="flex items-center py-2 border-b border-black/5 hover:bg-black/[0.04] cursor-pointer transition-colors text-sm group"
                              onClick={() => {
                                const el = document.getElementById(`dot-${log[3]}`);
                                if (el) {
                                  // Scroll the map into view if not visible
                                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  el.classList.remove('dot-highlight');
                                  void el.offsetWidth;
                                  el.classList.add('dot-highlight');
                                  if ((el as any)._timeoutId) clearTimeout((el as any)._timeoutId);
                                  (el as any)._timeoutId = setTimeout(() => el.classList.remove('dot-highlight'), 2000);
                                }
                              }}
                            >
                              <span className="w-16 text-black/25 text-[10px] font-mono shrink-0">{log[0]}</span>
                              <span className={`w-16 text-center font-bold tracking-wider text-[10px] shrink-0 ${
                                log[1] === 'DEPLOY' ? 'text-black' : log[1] === 'WHALE' ? 'text-black/70' : 'text-black/40'
                              }`}>{log[1]}</span>
                              <span className="flex-1 truncate px-3 text-black/40 text-xs">{log[2]}</span>
                              <a href={`https://somnia.superscan.network/tx/${log[3]}`} target="_blank" rel="noreferrer" className="text-black/20 hover:text-black transition-colors text-[10px] font-mono shrink-0">
                                {log[3]?.slice(0, 10)}...
                              </a>
                            </div>
                          ))}
                          {omni.logs.length === 0 && (
                            <div className="py-10 text-center text-black/20 italic tracking-wider text-sm">Awaiting first block data...</div>
                          )}
                        </div>
                      </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
            </motion.div>
          </main>
      </section>
    </div>
  );
}
