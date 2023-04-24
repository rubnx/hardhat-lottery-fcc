const { getNamedAccounts, deployments, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", async function () {
          let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval
          const chainId = network.config.chainId

          beforeEach(async function () {
              // deploy our fundMe contract using hardhat deploy
              // const { deployer } = await getNamedAccounts()
              // we'll do it like below to get deployer as a global variable
              deployer = (await getNamedAccounts()).deployer
              // deploy the scripts with the 'all' tag
              await deployments.fixture(["all"])
              // We get an instance of each of our contracts
              raffle = await ethers.getContract("Raffle", deployer)
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
              raffleEntranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })

          // Our first set of tests will be our constructor
          describe("constructor", async function () {
              it("initializes the raffle correctly", async function () {
                  // Ideally we make our tests have just 1 assert per "it"
                  // here we have more to make is faster
                  // 1. We want to make sure the raffle starts in an OPEN state
                  const raffleState = await raffle.getRaffleState()
                  // 2. Make sure the interval is set properly
                  assert.equal(raffleState.toString(), OPEN) //toString because raffleState is going to be a Big Number
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"])
                  // We'll stop here but we should check everything in the constructor
              })
          })

          // enterRaffle function
          describe("enterRaffle", async function () {
              it("reverts if you don't pay enough", async function () {
                  await expect(raffle.enterRaffle()).to.be.revertedWith(
                      "Raffle__NotEnoughETHEntered"
                  )
              })
              it("records players when they enter", async function () {
                  // get a bunch of accounts and get the second of the list (1st is the deployer)
                  // const accounts = await ethers.getSigners()
                  // const player = accounts[1]
                  // const playerConnectedContract = await raffle.connect(player)
                  // await playerConnectedContract.enterRaffle({ value: raffleEntranceFee })
                  // assert.equal(await raffle.getPlayer[0], player)
                  // Above is my take, with a random account, below the solution in the tutorial
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  const playerFromContract = await raffle.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })
              it("emits event on enter", async function () {
                  // checking that it emits an event
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter"
                  )
              })
              it("doesn't allow entrance when raffle state is calculating", async function () {
                  // First we enter the Raffle
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  // For raffle state to change to Calculating we need all the checkUpkeep conditions to return true
                  // We use hardhat tools to jump in time by our interval
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  // We mine 1 extra block to make sure the right time has passed
                  await network.provider.send("evm_mine", [])
                  // await network.provider.request({ method: "evm_mine", params: [] }) // same result as the line above
                  // Now that all the checkUpkeep conditions are true we pretend to be a Chainlink Keeper
                  await raffle.performUpkeep([])
                  // Now the raffleState should be CALCULATING
                  assert.equal(raffleState.toString(), CALCULATING)
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                      "Raffle__NotOpen"
                  )
              })
          })
      })
