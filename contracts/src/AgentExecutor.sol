/**
 * @title AgentExecutor
 * @dev Contract for executing AgentKit strategies on-chain
 */
contract AgentExecutor {
    address public factory;
    mapping(address => bool) public authorizedAgents;
    
    event StrategyExecuted(
        address indexed treasury,
        string strategy,
        uint256 amount,
        address token,
        bool success
    );
    
    modifier onlyAuthorized() {
        require(authorizedAgents[msg.sender], "Not authorized");
        _;
    }
    
    constructor(address _factory) {
        factory = _factory;
        authorizedAgents[msg.sender] = true;
    }
    
    function addAgent(address agent) external {
        require(msg.sender == factory, "Only factory can add agents");
        authorizedAgents[agent] = true;
    }
    
    function executeStrategy(
        address treasury,
        string memory strategy,
        uint256 amount,
        address token,
        address targetProtocol,
        bytes memory data
    ) external onlyAuthorized returns (bool) {
        // Execute the strategy on the target protocol
        (bool success,) = targetProtocol.call(data);
        
        emit StrategyExecuted(treasury, strategy, amount, token, success);
        
        return success;
    }
}