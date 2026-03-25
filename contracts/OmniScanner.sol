// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract OmniScanner {
    struct Vitals {
        uint256 blockNumber;
        uint256 gasPrice;
        uint256 lastBlockTime;
        uint256 baseFee;
    }

    /**
     * @dev Returns essential network vitals in a single call.
     */
    function getGlobalVitals() public view returns (Vitals memory) {
        return Vitals({
            blockNumber: block.number,
            gasPrice: tx.gasprice,
            lastBlockTime: block.timestamp,
            baseFee: block.basefee
        });
    }

    /**
     * @dev Analyzes network health based on a provided history of base fees.
     */
    function getNetworkHealth(uint256[3] memory lastBaseFees) public pure returns (string memory) {
        uint256 avg = (lastBaseFees[0] + lastBaseFees[1] + lastBaseFees[2]) / 3;
        if (avg > 50 gwei) return "CONGESTED";
        if (avg > 10 gwei) return "STEADY";
        return "OPTIMAL";
    }

    event Pulse(uint256 timestamp, uint256 intensity);

    /**
     * @dev Triggers a pulse event for stress-test visualization.
     */
    function triggerPulse(uint256 intensity) public {
        emit Pulse(block.timestamp, intensity);
    }
}
