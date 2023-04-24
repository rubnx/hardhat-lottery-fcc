// RAFFLE
// What we want people to do?
//   1. Enter the lottery (paying some amount)
//   2. Pick a random winner (verifiable random)
//   3. Winner to be selected every X minutes -> completely automated
// Chainlink Oracle:
//   - Randomness (from outside the blockchain)
//   - Automated Execution (Chainlink Keepers)

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

error Raffle__NotEnoughETHEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

/**
 * @title A sample Raffle Contract
 * @author Ruben Ruiz
 * @notice This contract is for creating an untamperable decentralized smart contract
 * @dev This implements Chainlik VRF v2 and Chainlink Automations (keepers)
 */

// New contract Raffle inherits VRFConsumerBaseV2 and AutomationCompatibleInterface
contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {
    /* TYPE DECLARATION */
    enum RaffleState {
        OPEN,
        CALCULATING
    }

    /* STATE VARIABLES */
    uint256 private immutable i_entranceFee; // we only use the entranceFee variable 1 time so we make it immutable to save gas
    address payable[] private s_players; // array of players. Will be a storage variable, and payable because we will have to pay when one of them wins
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;

    /* LOTTERY VARIABLES */
    address private s_recentWinner;
    bool private s_isOpen; // to true
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    /* EVENTS */
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    constructor(
        address vrfCoordinatorV2, // contract outside of our project: we'll create mocks for it
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN; // Also RaffleState(0)
        s_lastTimeStamp = block.timestamp; // solidity function to retrieve the current blockchain time
        i_interval = interval;
    }

    function enterRaffle() public payable {
        // Option 1: more expensive because we need to store a string in the blockchain.
        // require (msg.value > i_entranceFee, "Not enough ETH!")
        // Option 2: error code (cheaper)
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughETHEntered();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }
        s_players.push(payable(msg.sender));
        // Emit an event when we update a dynamic array or mapping
        // name events with the name of the function reversed
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev This is the function that the Chainlink Keeper nodes call
     * They look for the `upKeepNeeded` to return true
     * The following should be true in order to return true:
     *  1. Our time interval should have passed.
     *  2. The lottery should have at least 1 player, and have some ETH.
     *  3. Our subscription is funded with LINK.
     *  4. The lottery should be in an "OPEN" state.
     */
    function checkUpkeep(
        bytes memory /* checkData */
    ) public view override returns (bool upkeepNeeded, bytes memory /* performData */) {
        /* we change it from external to public so that our own smart contract can call it */
        bool isOpen = (RaffleState.OPEN == s_raffleState);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = (address(this).balance > 0);
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
        return (upkeepNeeded, "");
    }

    // This is what we want the contract to do automatically once the checkUpkeep function returns true
    // function requestRandomWords() external { ===> To automate in chainlink we use the declaration below instead
    function performUpkeep(bytes memory /* checkData */) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        // If the conditions are not met yet, revert
        if (!upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }
        // If conditions are met, request the random number
        // Once we get it do sth with it
        // 2 transaction process
        s_raffleState = RaffleState.CALCULATING; // This way nobody can enter our lottery and trigger a new update
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestedRaffleWinner(requestId);
        // Once we create the requestId and emit the event, Chainlink picks it up and
        // calls the fulfillRandomWords function below with the random number as an argument
    }

    // The fulfillRandomWords function is required by Chainlink VRF and handles
    // the logic of what to do with the random values after we get them
    // We need to override the original function
    function fulfillRandomWords(
        uint256 /* requestId */,
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length; // returns a number between 0 and (num of players)-1
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner; // Picked winner
        s_raffleState = RaffleState.OPEN; // Reopen the raffle
        s_players = new address payable[](0); // Reset players list (new array of size 0)
        s_lastTimeStamp = block.timestamp; // Reset timestamp
        (bool success, ) = recentWinner.call{value: address(this).balance}(""); // Sends all the balance of the contract to the winner
        if (!success) {
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(recentWinner);

        // s_players size 10
        // randomNumber:  202 (generated by chainlink)
        // we use modulo because the result is always going to be between 0 and s_player size -1
        // 202 % 10 = 2 ===> winner will be index 2 */
    }

    /** VIEW / PURE FUNCTIONS */
    // in the future we want other users to see i_entranceFee
    // so we create a functions for users to call if they want to know the entrance fee
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (uint256) {
        return i_entranceFee;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLatestTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }
}
