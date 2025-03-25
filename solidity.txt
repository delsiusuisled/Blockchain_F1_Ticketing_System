// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.2/contracts/access/AccessControlEnumerable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.2/contracts/security/ReentrancyGuard.sol";

contract F1PaddockClub is AccessControlEnumerable, ReentrancyGuard {
    struct Ticket {
        uint256 ticketId;
        uint256 eventId;
        string eventName;
        uint256 eventTimestamp;
        string eventLocation;
        address currentOwner;
        uint256 price;
        bool isForResale;
        bool isExpired;
        address[] ownershipHistory; // Changed from resaleHistory
        string qrCodeHash;
    }

    struct Event {
        uint256 eventId;
        string eventName;
        uint256 eventTimestamp; // Changed from string date
        string eventLocation;
        uint256 price;
        uint256 maxTickets; // Total available
        uint256 ticketsMinted; // Instead of availableTickets
        uint256[] ticketIds;
        bool status;
    }

    struct Organizer {
        string fullName;
        address walletAddress;
    }

    uint256 public eventCount;
    uint256 public ticketCount;

    mapping(uint256 => Event) public events;
    mapping(uint256 => Ticket) public tickets;
    mapping(address => Organizer) private organizers;
    address[] public organizerList;

    bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");
    uint256 public minResalePrice = 0.000000000000000001 ether;
    uint256 public maxResalePrice = 10 ether;
    uint256 public transactionFeePercent = 2; // 2% transaction fee

    event TicketCreated(uint256 ticketId, string eventName, address owner);
    event TicketTransferred(uint256 ticketId, address from, address to);
    event RefundIssued(uint256 ticketId, address owner, uint256 refundAmount);
    event EventUpdated(
        uint256 indexed eventId,
        string name,
        uint256 eventTimestamp, // Changed to uint256
        string location,
        uint256 price,
        uint256 maxTickets // Renamed for clarity
    );
    event OrganizerAdded(address organizer);
    event OrganizerRemoved(address organizer);
    event TicketResold(uint256 ticketId, address seller, uint256 newPrice);
    event ResaleCancelled(uint256 ticketId);

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not admin");
        _;
    }

    constructor() {
        // Admin Setup
        _setupRole(
            DEFAULT_ADMIN_ROLE,
            0x39022f2935339Ff128e2917AFF08867098Fffc4e
        );

        // Add preset organizer
        addOrganizer(
            "Delsius Yib Sheng Hyun",
            0x39022f2935339Ff128e2917AFF08867098Fffc4e
        );

        // Preset Events for 2025 F1 Calendar
        createEvent(
            "Australian Grand Prix 2025",
            1742918400,
            "Melbourne Grand Prix Circuit",
            0.00008 ether,
            50
        );
        createEvent(
            "Chinese Grand Prix 2025",
            1742947200,
            "Shanghai International Circuit",
            0.00008 ether,
            50
        );
        createEvent(
            "Japanese Grand Prix 2025",
            1743705600,
            "Suzuka International Racing Course",
            0.00008 ether,
            50
        );
        createEvent(
            "Bahrain Grand Prix 2025",
            1744310400,
            "Bahrain International Circuit",
            0.00007 ether,
            50
        );
        createEvent(
            "Saudi Arabian Grand Prix 2025",
            1744915200,
            "Jeddah Corniche Circuit",
            0.00006 ether,
            50
        );
        createEvent(
            "Miami Grand Prix 2025",
            1745606400,
            "Miami International Autodrome",
            0.00004 ether,
            40
        );
        createEvent(
            "Emilia Romagna Grand Prix 2025",
            1746988800,
            "Imola Circuit",
            0.00008 ether,
            45
        );
        createEvent(
            "Monaco Grand Prix 2025",
            1747593600,
            "Circuit de Monaco",
            0.0008 ether,
            30
        );
        createEvent(
            "Spanish Grand Prix 2025",
            1748198400,
            "Circuit de Barcelona-Catalunya",
            0.00007 ether,
            50
        );
        createEvent(
            "Canadian Grand Prix 2025",
            1749609600,
            "Circuit Gilles Villeneuve",
            0.00005 ether,
            45
        );
        createEvent(
            "Austrian Grand Prix 2025",
            1751020800,
            "Red Bull Ring",
            0.00006 ether,
            50
        );
        createEvent(
            "British Grand Prix 2025",
            1751625600,
            "Silverstone Circuit",
            0.00008 ether,
            50
        );
        createEvent(
            "Belgian Grand Prix 2025",
            1753036800,
            "Circuit de Spa-Francorchamps",
            0.00008 ether,
            50
        );
        createEvent(
            "Hungarian Grand Prix 2025",
            1753641600,
            "Hungaroring",
            0.00008 ether,
            50
        );
        createEvent(
            "Dutch Grand Prix 2025",
            1756060800,
            "Circuit Zandvoort",
            0.00008 ether,
            50
        );
        createEvent(
            "Italian Grand Prix 2025",
            1756665600,
            "Monza Circuit",
            0.00003 ether,
            50
        );
        createEvent(
            "Azerbaijan Grand Prix 2025",
            1758086400,
            "Baku City Circuit",
            0.00007 ether,
            50
        );
        createEvent(
            "Singapore Grand Prix 2025",
            1759497600,
            "Marina Bay Street Circuit",
            0.00008 ether,
            50
        );
        createEvent(
            "United States Grand Prix 2025",
            1760918400,
            "Circuit of the Americas",
            0.00006 ether,
            50
        );
        createEvent(
            "Mexico City Grand Prix 2025",
            1761523200,
            "Autodromo Hermanos Rodriguez",
            0.00005 ether,
            50
        );
        createEvent(
            "Sao Paulo Grand Prix 2025",
            1762742400,
            "Interlagos Circuit",
            0.00006 ether,
            50
        );
        createEvent(
            "Las Vegas Grand Prix 2025",
            1763664000,
            "Las Vegas Street Circuit",
            0.00009 ether,
            50
        );
        createEvent(
            "Qatar Grand Prix 2025",
            1764278400,
            "Lusail International Circuit",
            0.00004 ether,
            50
        );
        createEvent(
            "Abu Dhabi Grand Prix 2025",
            1764883200,
            "Yas Marina Circuit",
            0.00009 ether,
            50
        );
    }

    event Received(address sender, uint256 amount);

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    fallback() external payable {
        emit Received(msg.sender, msg.value);
    }

    // Remove the original modifier and replace with an internal function
    function _updateTicketState(uint256 _ticketId) internal {
        Ticket storage ticket = tickets[_ticketId];
        if (ticket.eventTimestamp <= block.timestamp) {
            ticket.isExpired = true;
            ticket.isForResale = false;
        }
    }

    // Update the checkValidity modifier to use the internal function
    modifier checkValidity(uint256 _ticketId) {
        _updateTicketState(_ticketId);
        require(!tickets[_ticketId].isExpired, "Ticket expired");
        _;
    }

    function createEvent(
        string memory _name,
        uint256 _eventTimestamp,
        string memory _location,
        uint256 _price,
        uint256 _maxTickets
    ) public onlyAdmin {
        require(_maxTickets > 0, "Ticket quantity must be greater than 0.");
        require(
            _eventTimestamp >= block.timestamp,
            "Event date must be in the future"
        );

        eventCount++;

        events[eventCount] = Event({
            eventId: eventCount,
            eventName: _name,
            eventTimestamp: _eventTimestamp,
            eventLocation: _location,
            price: _price,
            maxTickets: _maxTickets,
            ticketsMinted: 0,
            ticketIds: new uint256[](0),
            status: true
        });

        emit EventUpdated(
            eventCount,
            _name,
            _eventTimestamp,
            _location,
            _price,
            _maxTickets
        );
    }

    function resellTicket(uint256 _ticketId, uint256 _newPrice)
        public
        onlyTicketOwner(_ticketId)
    {
        require(
            _newPrice >= minResalePrice && _newPrice <= maxResalePrice,
            "Price out of allowed range."
        );
        // Update ticket state before checking expiration
        _updateTicketState(_ticketId);
        Ticket storage ticket = tickets[_ticketId];
        require(!ticket.isExpired, "Cannot resell expired ticket.");

        ticket.price = _newPrice;
        ticket.isForResale = true;

        emit TicketResold(_ticketId, msg.sender, _newPrice);
    }

    // Add this function to allow users to remove their tickets from the marketplace
    function cancelResale(uint256 _ticketId) public onlyTicketOwner(_ticketId) {
        Ticket storage ticket = tickets[_ticketId];
        require(ticket.isForResale, "Ticket not listed for resale.");
        ticket.isForResale = false;
        emit ResaleCancelled(_ticketId);
    }

    function purchaseResaleTicket(uint256 _ticketId, uint256 expectedPrice)
        public
        payable
        nonReentrant
        isForResale(_ticketId)
        checkValidity(_ticketId)
    {
        Ticket storage ticket = tickets[_ticketId];
        require(ticket.price == expectedPrice, "Price changed");
        require(msg.value == ticket.price, "Incorrect ETH amount.");
        require(!ticket.isExpired, "Ticket expired.");
        require(
            msg.sender != ticket.currentOwner,
            "Cannot buy your own ticket."
        );

        uint256 feeAmount = (msg.value * transactionFeePercent) / 100;
        uint256 sellerAmount = msg.value - feeAmount;

        payable(0x39022f2935339Ff128e2917AFF08867098Fffc4e).transfer(feeAmount);
        payable(ticket.currentOwner).transfer(sellerAmount);

        ticket.ownershipHistory.push(msg.sender);
        ticket.currentOwner = msg.sender;
        ticket.isForResale = false;
        ticket.qrCodeHash = generateUniqueHash(_ticketId, msg.sender); // Update hash

        emit TicketTransferred(_ticketId, ticket.currentOwner, msg.sender);
    }

    modifier isForResale(uint256 _ticketId) {
        require(tickets[_ticketId].isForResale, "Not for resale");
        _;
    }

    modifier onlyTicketOwner(uint256 _ticketId) {
        require(
            tickets[_ticketId].currentOwner == msg.sender,
            "Not ticket owner"
        );
        _;
    }

    function getAllEvents() public view returns (Event[] memory) {
        Event[] memory eventList = new Event[](eventCount);

        // Start from 1, go up to eventCount
        for (uint256 i = 1; i <= eventCount; i++) {
            eventList[i - 1] = events[i]; // ✅ Correct index mapping
        }

        return eventList;
    }

    function getTicketsForEvent(uint256 _eventId)
        public
        view
        returns (Ticket[] memory)
    {
        require(events[_eventId].eventId != 0, "Event does not exist.");

        uint256[] memory ticketIds = events[_eventId].ticketIds;
        Ticket[] memory eventTickets = new Ticket[](ticketIds.length);

        for (uint256 i = 0; i < ticketIds.length; i++) {
            eventTickets[i] = tickets[ticketIds[i]];
        }

        return eventTickets;
    }

    function getEventStatus(uint256 _eventId) public view returns (bool) {
        return events[_eventId].eventTimestamp > block.timestamp;
    }

    function purchaseTicket(uint256 _eventId) public payable nonReentrant {
        require(events[_eventId].eventId != 0, "Event does not exist.");
        Event storage eventData = events[_eventId];

        // Integrated validations
        require(eventData.ticketsMinted < eventData.maxTickets, "Sold out");
        require(
            eventData.eventTimestamp > block.timestamp,
            "Event already occurred"
        );
        require(
            eventData.eventTimestamp > block.timestamp + 1 hours, // Add buffer
            "Event starts too soon"
        );
        require(msg.value == eventData.price, "Incorrect ETH amount.");

        // Mint new ticket
        ticketCount++;
        uint256 newTicketId = ticketCount;

        tickets[newTicketId] = Ticket({
            ticketId: newTicketId,
            eventId: _eventId,
            eventName: eventData.eventName,
            eventTimestamp: eventData.eventTimestamp,
            eventLocation: eventData.eventLocation,
            currentOwner: msg.sender,
            price: eventData.price,
            isForResale: false,
            isExpired: false,
            ownershipHistory: new address[](0),
            qrCodeHash: generateUniqueHash(newTicketId, msg.sender)
        });

        // Update ticket and event data
        tickets[newTicketId].ownershipHistory.push(msg.sender);
        eventData.ticketIds.push(newTicketId);
        eventData.ticketsMinted++; // Replaces availableTickets--

        // Transfer payment to admin
        payable(0x39022f2935339Ff128e2917AFF08867098Fffc4e).transfer(msg.value);

        // Emit events
        emit TicketCreated(newTicketId, eventData.eventName, msg.sender);
    }

    function addOrganizer(string memory fullName, address organizer)
        public
        onlyAdmin
    {
        require(
            organizers[organizer].walletAddress == address(0),
            "Organizer already exists."
        );
        organizers[organizer] = Organizer(fullName, organizer);
        organizerList.push(organizer);
        grantRole(ORGANIZER_ROLE, organizer);
        emit OrganizerAdded(organizer);
    }

        // Add this to your contract
    function getOrganizerCount() public view returns (uint256) {
        return organizerList.length;
    }

    function getOrganizerFullName(address organizer)
        public
        view
        returns (string memory)
    {
        require(
            organizers[organizer].walletAddress != address(0),
            "Organizer not found."
        );
        return organizers[organizer].fullName;
    }

    function removeOrganizer(address organizer) public onlyAdmin {
        require(
            organizers[organizer].walletAddress != address(0),
            "Organizer not found."
        );
        revokeRole(ORGANIZER_ROLE, organizer);
        delete organizers[organizer];
        emit OrganizerRemoved(organizer);
    }

    function getOrganizerByAdmin(address admin) public view returns (address) {
        require(hasRole(ORGANIZER_ROLE, admin), "Admin is not an organizer");

        for (uint256 i = 0; i < organizerList.length; i++) {
            if (organizers[organizerList[i]].walletAddress == admin) {
                return organizerList[i];
            }
        }
        revert("Organizer not found for this admin.");
    }

    modifier validatePrice(uint256 _price) {
        require(
            _price >= minResalePrice && _price <= maxResalePrice,
            "Price out of allowed range."
        );
        _;
    }

    function transferTicket(uint256 _ticketId, address _newOwner)
        public
        payable
        nonReentrant
        checkValidity(_ticketId)
    {
        require(_newOwner != address(0), "Invalid new owner address.");
        require(
            !tickets[_ticketId].isExpired,
            "Cannot transfer an expired ticket."
        );

        Ticket storage ticket = tickets[_ticketId];
        address previousOwner = ticket.currentOwner;
        require(
            previousOwner == msg.sender,
            "Only the owner can transfer the ticket."
        );
        require(
            previousOwner != _newOwner,
            "Cannot transfer to the same owner."
        );

        ticket.ownershipHistory.push(_newOwner);
        ticket.currentOwner = _newOwner;
        ticket.qrCodeHash = generateUniqueHash(_ticketId, _newOwner); // Update hash

        emit TicketTransferred(_ticketId, previousOwner, _newOwner);
    }

    function expireTicket(uint256 _ticketId) public onlyAdmin {
        require(
            _ticketId > 0 && _ticketId <= ticketCount,
            "Invalid Ticket ID."
        );
        tickets[_ticketId].isExpired = true;
        tickets[_ticketId].isForResale = false; // Add this line
        emit ResaleCancelled(_ticketId); // Add event emission
    }

    // Add a function to check if an event with the same details already exists
    function eventExists(
        string memory _name,
        uint256 _eventTimestamp,
        string memory _location,
        uint256 _price
    ) public view returns (bool, uint256) {
        for (uint256 i = 1; i <= eventCount; i++) {
            if (
                keccak256(bytes(events[i].eventName)) ==
                keccak256(bytes(_name)) &&
                events[i].eventTimestamp == _eventTimestamp &&
                keccak256(bytes(events[i].eventLocation)) ==
                keccak256(bytes(_location)) &&
                events[i].price == _price
            ) {
                return (true, i);
            }
        }
        return (false, 0);
    }

    // Add a function to increment the maxTickets for an existing event
    function incrementMaxTickets(uint256 _eventId, uint256 _additionalTickets)
        public
        onlyAdmin
    {
        require(_eventId > 0 && _eventId <= eventCount, "Invalid Event ID.");
        require(
            _additionalTickets > 0,
            "Additional tickets must be greater than 0."
        );

        events[_eventId].maxTickets += _additionalTickets;
        emit EventUpdated(
            _eventId,
            events[_eventId].eventName,
            events[_eventId].eventTimestamp,
            events[_eventId].eventLocation,
            events[_eventId].price,
            events[_eventId].maxTickets
        );
    }

    // Add a function to update the maxTickets for an existing event
    function updateMaxTickets(uint256 _eventId, uint256 _newMaxTickets)
        public
        onlyAdmin
    {
        require(_eventId > 0 && _eventId <= eventCount, "Invalid Event ID.");
        require(_newMaxTickets > 0, "Max tickets must be greater than 0.");
        require(
            _newMaxTickets >= events[_eventId].ticketsMinted,
            "New max tickets must be greater than or equal to tickets minted."
        );

        events[_eventId].maxTickets = _newMaxTickets;
        emit EventUpdated(
            _eventId,
            events[_eventId].eventName,
            events[_eventId].eventTimestamp,
            events[_eventId].eventLocation,
            events[_eventId].price,
            events[_eventId].maxTickets
        );
    }

    mapping(uint256 => bool) public refundedTickets;

    function refundTicket(uint256 _ticketId) public nonReentrant {
        _updateTicketState(_ticketId);
        require(
            msg.sender == tickets[_ticketId].currentOwner,
            "Only ticket owner can request a refund."
        );
        require(
            !tickets[_ticketId].isExpired,
            "Cannot refund an expired ticket."
        );
        require(!refundedTickets[_ticketId], "Ticket already refunded.");

        Ticket storage ticket = tickets[_ticketId];
        ticket.isExpired = true; // Add invalidation
        ticket.isForResale = false;

        uint256 refundAmount = ticket.price;
        payable(msg.sender).transfer(refundAmount);
        refundedTickets[_ticketId] = true;

        emit RefundIssued(_ticketId, msg.sender, refundAmount);
    }

    function getResaleTickets() public view returns (Ticket[] memory) {
        uint256 resaleCount = 0;

        // First pass: Count valid resale tickets (using memory copies)
        for (uint256 i = 1; i <= ticketCount; i++) {
            Ticket memory ticket = tickets[i]; // Changed to memory
            bool isExpired = ticket.eventTimestamp <= block.timestamp;

            if (isExpired) {
                // This only affects our local memory copy
                ticket.isExpired = true;
                ticket.isForResale = false;
            }

            if (ticket.isForResale && !isExpired) {
                resaleCount++;
            }
        }

        // Create array with exact size needed
        Ticket[] memory resaleTickets = new Ticket[](resaleCount);
        uint256 index = 0;

        // Second pass: Collect valid tickets
        for (uint256 i = 1; i <= ticketCount; i++) {
            Ticket memory ticket = tickets[i]; // Changed to memory
            bool isExpired = ticket.eventTimestamp <= block.timestamp;

            if (isExpired) {
                // Update memory copy only
                ticket.isExpired = true;
                ticket.isForResale = false;
            }

            if (ticket.isForResale && !isExpired) {
                resaleTickets[index] = ticket;
                index++;
            }
        }

        return resaleTickets;
    }

    function getResaleHistory(uint256 _ticketId)
        public
        view
        returns (address[] memory)
    {
        require(
            _ticketId > 0 && _ticketId <= ticketCount,
            "Invalid Ticket ID."
        );
        return tickets[_ticketId].ownershipHistory;
    }

    // Add new functions
    function generateQrCodeData(uint256 _ticketId)
        public
        view
        returns (string memory)
    {
        require(_ticketId <= ticketCount, "Invalid ticket ID");
        Ticket memory ticket = tickets[_ticketId];

        return
            string(
                abi.encodePacked(
                    "Ticket ID: ",
                    uint2str(_ticketId),
                    "\nEvent: ",
                    ticket.eventName,
                    "\nDate: ",
                    uint2str(ticket.eventTimestamp),
                    "\nOwner: ",
                    addressToString(ticket.currentOwner),
                    "\nVerification: ",
                    ticket.qrCodeHash
                )
            );
    }

    function timestampToDate(uint256 ts) internal pure returns (string memory) {
        uint256 secondsInDay = 86400;
        uint256[12] memory daysInMonth = [
            uint256(31),
            uint256(28),
            uint256(31),
            uint256(30),
            uint256(31),
            uint256(30),
            uint256(31),
            uint256(31),
            uint256(30),
            uint256(31),
            uint256(30),
            uint256(31)
        ];

        uint256 year = 1970;
        while (ts >= (isLeapYear(year) ? 31622400 : 31536000)) {
            ts -= isLeapYear(year) ? 31622400 : 31536000;
            year++;
        }

        bool leap = isLeapYear(year);
        uint256 month;
        for (month = 0; month < 12; month++) {
            uint256 dim = daysInMonth[month];
            if (month == 1 && leap) dim++;
            if (ts < dim * secondsInDay) break;
            ts -= dim * secondsInDay;
        }

        uint256 day = (ts / secondsInDay) + 1;
        ts %= secondsInDay;
        uint256 hour = ts / 3600;
        ts %= 3600;
        uint256 minute = ts / 60;

        return
            string(
                abi.encodePacked(
                    uint2str(day),
                    "/",
                    uint2str(month + 1),
                    "/",
                    uint2str(year),
                    " ",
                    uint2str(hour),
                    ":",
                    uint2str(minute),
                    " UTC"
                )
            );
    }

    function isLeapYear(uint256 year) internal pure returns (bool) {
        return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
    }

    function verifyTicket(uint256 _ticketId, string memory _providedHash)
        public
        view
        returns (bool)
    {
        require(_ticketId <= ticketCount, "Invalid ticket");
        return
            keccak256(abi.encodePacked(tickets[_ticketId].qrCodeHash)) ==
            keccak256(abi.encodePacked(_providedHash));
    }

    // Helper functions
    function generateUniqueHash(uint256 _ticketId, address _owner)
        internal
        view
        returns (string memory)
    {
        // Generate the hash
        bytes32 hash = keccak256(
            abi.encodePacked(_ticketId, _owner, block.timestamp)
        );

        // Convert the hash to a hex string
        return toHexString(hash);
    }

    function toHexString(bytes32 _bytes) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(64); // 32 bytes => 64 hex characters
        for (uint256 i = 0; i < 32; i++) {
            str[i * 2] = alphabet[uint8(_bytes[i] >> 4)];
            str[i * 2 + 1] = alphabet[uint8(_bytes[i] & 0x0f)];
        }
        return string(str);
    }

    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) return "0";
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - (_i / 10) * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }

    function addressToString(address _addr)
        internal
        pure
        returns (string memory)
    {
        bytes32 value = bytes32(uint256(uint160(_addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3 + i * 2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }
        return string(str);
    }
}
