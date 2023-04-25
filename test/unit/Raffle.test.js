const { getNamedAccounts, deployments, network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

// Only run all tests if we ARE on development/local chain (only run if we are NOT on testnet or mainnet)
developmentChains.includes(network.name)
!developmentChains.includes(network.name)
    ? describe.skip
    : // describe blocks are not async because they can't work with promises
      describe("Raffle Unit Tests", function () {
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
          describe("constructor", function () {
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
          describe("enterRaffle", function () {
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
                  await raffle.performUpkeep([]) // we send a blank bytes object, can be [] or can be "0x"
                  // Now the raffleState should be CALCULATING
                  assert.equal(raffleState.toString(), 1) // enums are called by indexes
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                      "Raffle__NotOpen"
                  )
              })
          })

          // checkUpkeep function
          describe("checkUpkeep", function () {
              it("returns false if people haven't sent any ETH", async function () {
                  // We use hardhat tools to jump in time by our interval
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  // We mine 1 extra block to make sure the right time has passed
                  await network.provider.send("evm_mine", [])
                  // Now we need to call checkUpkeep but don't want to create a transaction
                  // We have a method to "simulate" a transaction and see what it returns: callStatic
                  // The function returns bool upkeepNeeded
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]) // we send a blank bytes object, can be [] or can be "0x"
                  assert(!upkeepNeeded)
              })
              it("returns false if raffle isn't open", async function () {
                  // First we enter the Raffle
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  // await network.provider.request({ method:"evm_mine", params: [] })
                  // Now that all the checkUpkeep conditions are true we pretend to be a Chainlink Keeper
                  await raffle.performUpkeep([])
                  // Now raffle state is CALCULATING (1)
                  const raffleState = await raffle.getRaffleState()
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert.equal(raffleState.toString(), 1)
                  assert(!upkeepNeeded) // assert.equal(upkeepNeeded, false)
              })
              it("returns false if enough time hasn't passed", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
                  assert(!upkeepNeeded)
              })
              it("returns true if enough time has passed, has players, eth and is open", async function () {
                  // First we enter the Raffle
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  // await network.provider.request({ method:"evm_mine", params: [] })
                  // Now that all the checkUpkeep conditions are true we pretend to be a Chainlink Keeper
                  await raffle.performUpkeep([])
                  // Now raffle state is CALCULATING (1)
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert(upkeepNeeded)
              })
          })
          describe("performUpkeep", function () {
              it("it can only run if checkUpkeep is true", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const tx = await raffle.performUpkeep([])
                  assert(tx) // if the transaction fails, this assert will fail
              })
              it("it fails to run if checkUpkeep is false", async function () {
                  // since there is no activity in the contract, checkUpkeep is false
                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      "Raffle_UpkeepNotNeeded"
                  )
              })
              it("updates raffle state, emits an event, and calls the vrf coordinator", async function () {
                  // First we enter the Raffle
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  // await network.provider.request({ method:"evm_mine", params: [] })
                  // Now that all the checkUpkeep conditions are true we pretend to be a Chainlink Keeper
                  const txResponse = await raffle.performUpkeep([])
                  const txReceipt = await txResponse.wait(1)
                  // this will be the 2nd event because our event is redundant
                  // the function requestRandomWords from the VRFCoordinatorV2Mock.sol contract
                  // already emits an event with some parameters, like the requestId
                  // (we could delete our event and only use the one in VRFCoordinatorV2Mock, but we continue with ours)
                  const requestId = txReceipt.events[1].args.requestId // 2nd event
                  const raffleState = await raffle.getRaffleState()
                  assert(requestId.toNumber() > 0)
                  assert.equal(raffleState.toString(), "1")
              })
          })
          describe("fulfillRandomWords", function () {
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
              })
              it("can only be called after performUpkeep", async function () {
                  // Chainlink actually calls the fulfillRandomWords function in VRFCoordinatorV2
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
                  ).to.be.revertedWith("nonexistent request")
                  // Ideally we would test with all possible requestIds, right now we will test only 0 and 1
              })
              // The test below is too big, ideally we would split it in different sections
              it("picks a winner, resets the lottery and sends the money to the winner", async function () {
                  // 1st: we need more people to enter the raffle (we will have 4 in total, deployer is index 0)
                  const additionalEntrants = 3
                  const startingAccountIndex = 1 // deployer = 0
                  const accounts = ethers.getSigners()
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      const accountConnectedRaffle = await raffle.connect(accounts[i])
                      await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee })
                  }
                  const startingTimeStamp = await raffle.getLastestTimeStamp()
                  // We will have to wait for the fulfillRandomWords to be called and we are going to simulate that
                  // Further below we have created a listener in order to simulate the waiting
                  // We don't want this test to finish before that listener is done listening
                  // so we create a new Promise
                  // for the promise to be resolved, the event emitter should be inside the promise
                  // NOTE: we don't need this here in a local network because we are mocking the VRF Coordinator
                  // and we know when things are goint to happen, but we will need it in a testnet, so we reflect that in our test
                  await new Promise(async (resolve, reject) => {
                      // listen for the WinnerPicked event to get emitted
                      raffle.once("WinnerPicked", async () => {
                          console.log("Found the event!")
                          // inside the try we'll write our asserts
                          try {
                              const recentWinner = await raffle.getRecentWinner()
                              console.log(`The winner is: ${RecentWinner}`)
                              console.log("These are all the participants:")
                              console.log(accounts[0].address)
                              console.log(accounts[2].address)
                              console.log(accounts[1].address)
                              console.log(accounts[3].address)
                              const raffleState = await raffle.getRaffleState()
                              const endingTimeStamp = await raffle.getLastestTimeStamp()
                              const numPlayers = await raffle.getNumberOfPlayers()
                              // The line below is added once we run the test and know the winner address (in this case, account 1)
                              const winnerEndingBalance = await accounts[1].getBalance()
                              assert.equal(numPlayers.toString(), "0")
                              assert.equal(raffleState.toString(), "0")
                              assert(endingTimeStamp > startingTimeStamp)
                              // Below we assert that the winner ends up with the balance that all participants added to the contract
                              // The ending balance will be the starting balance plus all the other participant's fees plus the winner fee
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance
                                      .add(
                                          raffleEntranceFee
                                              .mul(additionalEntrants)
                                              .add(raffleEntranceFee)
                                      )
                                      .toString()
                              )
                          } catch (e) {
                              reject()
                          }
                          resolve()
                      })
                      // NOTE: We wouldn't really need the mocking below in a testnet, but we mock it in local to simulate real world use
                      // 2nd: we call fulfillRandomWords (performUpkeep will automatically kickoff fulfillRandomWors, for testing we mock it)
                      // we will have to wait for the fulfillRandomWords to be called and we are going to simulate that
                      // in order to simulate the waiting, we set up a listener
                      // for the promise to be resolved, the event emitter should be inside the promise
                      // below we will fire the event, and the listener will pick it up and resolve
                      // then we performUpkeep and get a requestId (mock being Chainlink keepers)
                      const txResponse = await raffle.performUpkeep([])
                      const txReceipt = await txResponse.wait(1)
                      // The line below is added once we run the test and know the winner address (in this case, account 1)
                      const winnerStartingBalance = await accounts[1].getBalance()
                      const requestId = txReceipt.events[1].args.requestId
                      // now mocking the VRF that should emit a WinnerPicked event for our Promise to resolve
                      await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.address)
                  })
              })
          })
      })
