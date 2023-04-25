// To be able to run these tests we need:
// 1. Get our SubId for Chainlink VRF
// 2. Deploy our contract using the SubId
// 3. Register the contract with Chainlink VRF & it's subId
// 4. Register the contract with Chainlink Keepers
// 5. Run Staging tests

const { getNamedAccounts, deployments, network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

// Only run all tests if we are NOT on development/local chain (only run if we ARE on testnet or mainnet)
developmentChains.includes(network.name)
    ? describe.skip
    : // describe blocks are not async because they can't work with promises
      describe("Raffle Staging Tests", function () {
          let raffle, raffleEntranceFee, deployer

          beforeEach(async function () {
              // deploy our fundMe contract using hardhat deploy
              // const { deployer } = await getNamedAccounts()
              // we'll do it like below to get deployer as a global variable
              deployer = (await getNamedAccounts()).deployer
              raffle = await ethers.getContract("Raffle", deployer)
              raffleEntranceFee = await raffle.getEntranceFee()
          })

          describe("fulfillRandomWords", function () {
              it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
                  // enter the raffle
                  const startingTimeStamp = await raffle.getLatestTimestamp()
                  const accounts = await ethers.getSigners() // accounts[0] will be our deployer

                  // setup listener before we enter the raffle
                  // just in case the blockain moves REALLY fast
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!")
                          try {
                              // add our asserts here
                              const recentWinner = await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const winnerEndingBalance = await accounts[0].getBalance() // winner is the deployer because only 1 entered the raffle
                              const endingTimeStamp = await raffle.getLatestTimestamp()

                              await expect(raffle.getPlayer(0)).to.be.reverted // check if players[] is reset
                              assert.equal(recentWinner.toString(), accounts[0].address)
                              assert.equal(raffleState, 0)
                              assert.equal(
                                  winnerEndingBalance.toString,
                                  winnerStartingBalance.add(getEntranceFee).toString()
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve()
                          } catch (e) {
                              console.log(error)
                              reject(e)
                          }
                      })
                      // Then entering the raffle
                      // This time we do it inside the promise so that the WinnerPicked event gets emitted inside
                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      const winnerStartingBalance = await accounts[0].getBalance() // winner is the deployer because only 1 entered the raffle

                      // And this code WON'T complete until our listener has finished listening!
                  })
              })
          })
      })
