import { useState, useEffect } from 'react';
import { JsonRpcProvider, Contract, formatEther } from 'ethers';

const RPC_URL = "https://dream-rpc.somnia.network";
const SCANNER_ADDR = "0x7B8b20d8766Fc89e0e80482791F9CDCdf072d629";
const SCANNER_ABI = [
  "function getGlobalVitals() view returns (uint256 blockNumber, uint256 blockTimestamp, uint256 activeValidators)",
  "function getNetworkHealth() view returns (string)",
  "event Pulse(address sender, uint256 intensity)"
];

export function useSomniaSentinel() {
  const [blockData, setBlockData] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [tps, setTps] = useState(0);
  const [totalBurned, setTotalBurned] = useState(0);
  const [networkHealth, setNetworkHealth] = useState("OPTIMAL");
  const [logs, setLogs] = useState<any[]>([]);
  const [baseFee, setBaseFee] = useState<number>(0);

  useEffect(() => {
    let active = true;
    let lastBlock = 0;
    let txCounts: number[] = [];

    async function poll() {
      try {
        const rpcProvider = new JsonRpcProvider(RPC_URL);
        const blockNum = await rpcProvider.getBlockNumber();
        
        if (blockNum !== lastBlock) {
          lastBlock = blockNum;
          // Ethers v6 prefetchedTransactions
          const block = await rpcProvider.getBlock(blockNum, true);
          if (!block || !active) return;

          setBlockData({ number: block.number, timestamp: block.timestamp });

          const newTxs: any[] = [];
          let currentBurn = 0;
          let newLogs: any[] = [];

          if (block.baseFeePerGas && block.gasUsed) {
            const burnedWei = block.baseFeePerGas * block.gasUsed;
            currentBurn = parseFloat(formatEther(burnedWei));
            // Somnia gas is extremely cheap, often fractional Gwei
            setBaseFee(Number(block.baseFeePerGas) / 1e9); 
          }

          const txs = (block.prefetchedTransactions || []);
          const limit = Math.min(txs.length, 25);
          
          for (let i = 0; i < limit; i++) {
            const tx: any = txs[i];
            const val = parseFloat(formatEther(tx.value || 0));
            const type = tx.to === null ? 'DEPLOY' : val > 10 ? 'WHALE' : val === 0 ? 'CALL' : 'TRANSFER';
            newTxs.push({ hash: tx.hash, type, value: formatEther(tx.value || 0), from: tx.from, to: tx.to });
            
            newLogs.push([
              new Date().toLocaleTimeString(),
              type,
              type === 'DEPLOY' ? `Contract Deploy at block ${blockNum}` : 
              type === 'CALL' ? `Contract Call → ${tx.to?.slice(0,10)}...` :
              type === 'WHALE' ? `[WHALE] ${val.toFixed(2)} STT Transfer` :
              `${val.toFixed(2)} STT Transfer`,
              tx.hash
            ]);
          }

          setTransactions(newTxs);
          setTotalBurned(prev => prev + currentBurn);
          // Set logs newest-first
          setLogs(prev => [...newLogs.reverse(), ...prev].slice(0, 50));

          txCounts.push(txs.length);
          if (txCounts.length > 10) txCounts.shift();
          const totalTxs = txCounts.reduce((a, b) => a + b, 0);
          setTps(totalTxs / (txCounts.length * 2));

          const scanner = new Contract(SCANNER_ADDR, SCANNER_ABI, rpcProvider);
          try {
            const health = await scanner.getNetworkHealth();
            setNetworkHealth(health);
          } catch(e) {}
        }
      } catch (e) {
        console.error("Sentinel Poll Error:", e);
      }
      
      if (active) setTimeout(poll, 2000);
    }
    
    poll();
    return () => { active = false; };
  }, []);

  return { blockData, transactions, tps, totalBurned, networkHealth, logs, baseFee };
}
