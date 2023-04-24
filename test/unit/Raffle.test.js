const { getNamedAccounts, deployments, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert } = require("chai")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", async function () {
          let raffle, vrfCoordinatorV2Mock
          const chainId = network.config.chainId

          beforeEach(async function () {
              // deploy our fundMe contract using hardhat deploy
              const { deployer } = await getNamedAccounts()
              // deploy the scripts with the 'all' tag
              await deployments.fixture(["all"])
              // We get an instance of each of our contracts
              raffle = await ethers.getContract("Raffle", deployer)
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
          })

          // Our first set of tests will be our constructor
          describe("constructor", async function () {
              it("initializes the raffle correctly", async function () {
                  // Idially we make our tests have just 1 assert per "it"
                  // here we have more to make is faster
                  // 1. We want to make sure the raffle starts in an OPEN state
                  const raffleState = await raffle.getRaffleState()
                  const interval = await raffle.getInterval()
                  assert.equal(raffleState.toString(), OPEN) //toString because raffleState is going to be a Big Number
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"])
              })
          })
      })
