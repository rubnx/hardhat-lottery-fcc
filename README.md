# Raffle Project
This project allows a number of participant pay ETH to participate in a raffle pool.
The whole process will be automated using Chainlink Automations https://automation.chain.link/
After deploying the raffle status will be set as OPEN.

Each player will connect their wallet and pay our deployed contract an entrance Fee to participate.
The raffle will end when all these conditions are met:
1. A specific amount of time has passed since the raffle opened (we will keep track of that with Chainlink Automations (Keepers))
2. There is at least 1 participant in the pool
3. There is more than 0 ETH in the contract

When the raffle ends:
1. The contract state will change to CALCULATING (non participants will be allowed while calculating).
2. A random winner will be chosen from the pool (We will use Verified Randomnes with Chainlink VRF)
3. The whole amount in the pool will be sent to the winner.
4. The contract state will be set to OPEN.
5. The time will be reset.
6. The Raffle will start again.

<br>

---
<br>

## Basic Dependencies Hardhat project - FreeCodeCamp:

<br>

```
yarn add --dev @nomiclabs/hardhat-ethers@npm:hardhat-deploy-ethers ethers @nomiclabs/hardhat-etherscan @nomiclabs/hardhat-waffle chai ethereum-waffle hardhat hardhat-contract-sizer hardhat-deploy hardhat-gas-reporter prettier prettier-plugin-solidity solhint solidity-coverage dotenv
```

<br>

---

<br>

## Includes:

- **ethers** (javascript library for working with smart contracts. It powers Hardhat)
- **hardhat-deploy-ethers** (substituting hardhat-ethers, that was our substitute for ethers)
- **hardhat-etherscan**
- **hardhat-waffle** \* (for testing /a set of tools for testing smart contracts, including a contract deployment simulator, a blockchain snapshot tool, and a set of utilities for interacting with smart contracts)
- **chai** \* (for testing / a popular assertion library for JavaScript. It provides a set of methods for making assertions about the behavior of software, including smart contracts.)
- **ethereum-waffle** \* (for testing / a testing framework for Ethereum smart contracts that provides a set of tools and utilities for testing contracts in a simulated environment, not only for hardhat)
- **hardhat**
- **hardhat-contract-sizer** (to estimate the size of compiled smart contracts and to provide information about their gas usage)
- **hardhat-deploy** (provides a simple and flexible way to deploy smart contracts and manage their dependencies)
- **hardhat-gas-reporter**
- **prettier**
- **prettier-plugin-solidity**
- **solhint** (linter for solidity: a linter is is a tool that analyzes source code to detect potential errors, coding standards violations, and other issues. It enforces best practices and preventing common mistakes)
- **solidity-coverage** (for testing / it shows how much of the code is covered by the tests we run)
- **dotenv** (to import .env constants to other files)
  <br>
  <br>

---

<br>

## About testing plugins:

1. **Hardhat-waffle** provides the infrastructure for running tests in a simulated environment, while **Chai** provides the syntax for making assertions about the behavior of the contracts.
2. **Hardhat-waffle** also provides a set of **Chai** plugins that extend the functionality of **Chai**, such as a plugin for asserting that an event was emitted by a contract or a plugin for interacting with contract interfaces.
3. Like **Hardhat-waffle**, **Ethereum-waffle** provides a set of **Chai** plugins that extend the functionality of the **Chai** assertion library for making assertions about the behavior of smart contracts.
