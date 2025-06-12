// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "../src/AgentExecutor.sol";

contract AgentExecutorTest is AgentExecutor {
    constructor(address _factory) AgentExecutor(_factory) {}
}