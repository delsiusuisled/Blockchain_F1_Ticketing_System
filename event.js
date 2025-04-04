const ADMIN_ACCOUNT = "0x39022f2935339Ff128e2917AFF08867098Fffc4e"; // Admin account for privileged actions
let isEventsLoaded = false;
let currentFilter = 'all'; // 'all', 'available', or 'expired'
let currentSearchTerm = '';
let allEvents = []; // This will store all events for filtering

// event.js
let isWeb3Initialized = false; // Add this line at the top

async function initializeWeb3() {
    console.log("🔹 Initializing Web3...");

    // Check if MetaMask is installed
    if (!window.ethereum) {
        alert("⚠️ Please install MetaMask!");
        return false; // Return false if MetaMask is not installed
    }

    // Initialize Web3
    window.web3 = new Web3(window.ethereum);

    try {
        // Check if already connected
        const accounts = await window.ethereum.request({ method: "eth_accounts" });

        if (accounts.length > 0) {
            // Wallet is already connected
            window.currentAccount = accounts[0];
            console.log("✅ Wallet already connected:", window.currentAccount);
            sessionStorage.setItem("connectedWallet", window.currentAccount);
            isWeb3Initialized = true;
            await updateWalletDisplay();
            return true;
        } else {
            // Request account access if not connected
            const requestedAccounts = await window.ethereum.request({ method: "eth_requestAccounts" });
            if (requestedAccounts.length > 0) {
                window.currentAccount = requestedAccounts[0];
                console.log("✅ Wallet connected after request:", window.currentAccount);
                sessionStorage.setItem("connectedWallet", window.currentAccount);
                isWeb3Initialized = true;
                await updateWalletDisplay();
                return true;
            } else {
                console.warn("⚠️ No accounts returned by MetaMask.");
                alert("Please connect your wallet.");
                return false;
            }
        }
    } catch (error) {
        console.error("❌ Wallet connection failed:", error);

        // Handle specific MetaMask errors
        if (error.code === 4001) {
            alert("⚠️ Wallet connection rejected by user.");
        } else {
            alert("Wallet connection required");
            window.location.href="index.html"
        }
        return false;
    }
}

// ✅ Initialize Smart Contract
async function initializeContract() {
    if (!isWeb3Initialized) {
        await initializeWeb3();
    }

    if (!window.contract && window.web3) {
        window.contract = new window.web3.eth.Contract(
            F1TicketContract.abi,
            CONTRACT_ADDRESS
        );
        console.log("Contract initialized");
    }
}

// Enhanced access verification
// Enhanced access verification
async function verifyAccess() {
    try {
        console.log("Starting access verification...");
        
        if (!window.web3) {
            const initialized = await initializeWeb3();
            if (!initialized) {
                throw new Error("Failed to initialize Web3");
            }
        }

        const accounts = await window.web3.eth.getAccounts();
        if (!accounts || accounts.length === 0) {
            throw new Error("No connected wallet");
        }
        
        const connectedWallet = accounts[0];
        if (!connectedWallet) {
            throw new Error("Invalid wallet address");
        }

        const hasAccess = await isOrganizerOrAdmin(connectedWallet);
        if (!hasAccess) {
            throw new Error("Unauthorized access");
        }

        await updateWalletDisplay(connectedWallet);
        return true;
    } catch (error) {
        console.error("Access verification failed:", error);
        alert(`Access Denied: ${error.message}`);
        window.location.href = "index.html";
        return false;
    }
}

async function fetchAllEvents() {
    try {
        // Ensure Web3 and contract are initialized before making calls
        if (!window.web3) await initializeWeb3();
        if (!window.contract) await initializeContract();

        if (!window.contract) {
            console.error("❌ Contract is still not initialized. Aborting fetch.");
            return [];
        }

        // Fetch events from the contract
        const events = await window.contract.methods.getAllEvents().call();
        console.log("✅ Events fetched from contract:", events);

        if (!Array.isArray(events) || events.length === 0) {
            console.warn("⚠️ No events found.");
            return [];
        }

        return events.map(event => ({
            eventId: event[0],
            eventName: event[1],
            eventTimestamp: event[2],
            eventLocation: event[3],
            price: event[4],
            maxTickets: event[5],
            ticketsMinted: event[6],
            ticketIds: event[7],
            status: event[8]
        }));
    } catch (error) {
        console.error("❌ Failed to fetch events from contract:", error);
        return [];
    }
}



// // ✅ Admin Check Using Constant
// function isAdmin() {
//     return window.web3 && 
//            window.currentAccount && 
//            window.currentAccount.toLowerCase() === ADMIN_ACCOUNT.toLowerCase();
// }

// Check Admin Role
async function isAdmin(walletAddress) {
    try {
        // Validate input
        if (!walletAddress || !window.web3.utils.isAddress(walletAddress)) {
            console.error("❌ Invalid wallet address:", walletAddress);
            return false;
        }

        // Ensure dependencies are initialized
        if (!window.web3) {
            await initializeWeb3();
            if (!window.web3) {
                console.error("❌ Web3 initialization failed");
                return false;
            }
        }

        if (!window.contract) {
            await initializeContract();
            if (!window.contract) {
                console.error("❌ Contract initialization failed");
                return false;
            }
        }

        // Calculate role hash
        const ADMIN_ROLE = window.web3.utils.keccak256("ADMIN_ROLE");
        if (!ADMIN_ROLE) {
            console.error("❌ Failed to calculate ADMIN_ROLE hash");
            return false;
        }

        // Make the contract call
        const isAdmin = await window.contract.methods
            .hasRole(ADMIN_ROLE, walletAddress)
            .call();
        
        console.log(`🔹 isAdmin(${walletAddress}): ${isAdmin}`);
        return isAdmin;
    } catch (error) {
        console.error("❌ Error checking admin role:", error);
        return false;
    }
}

// Check Organizer Role
async function isOrganizer(walletAddress) {
    try {
        await initializeWeb3();
        await initializeContract();

        const ORGANIZER_ROLE = window.web3.utils.keccak256("ORGANIZER_ROLE"); // Ensure web3.utils is available
        const isOrganizer = await window.contract.methods.hasRole(ORGANIZER_ROLE, walletAddress).call();
        console.log(`🔹 isOrganizer(${walletAddress}): ${isOrganizer}`);
        return isOrganizer;
    } catch (error) {
        console.error("❌ Error checking organizer role:", error);
        return false;
    }
}

// Check if Wallet is Admin or Organizer
async function isOrganizerOrAdmin(walletAddress) {
    try {
        if (!walletAddress) {
            console.error("❌ No wallet address provided");
            return false;
        }

        const [admin, organizer] = await Promise.all([
            isAdmin(walletAddress),
            isOrganizer(walletAddress)
        ]);

        console.log(`🔹 Checking Admin/Organizer Role for ${walletAddress}: isAdmin = ${admin}, isOrganizer = ${organizer}`);
        return admin || organizer;
    } catch (error) {
        console.error("❌ Error checking admin/organizer role:", error);
        return false;
    }
}

async function enforceAdminPrivileges() {
    if (!window.web3) await initializeWeb3();
    if (!isAdmin()) {
        alert("⚠️ Only the admin can perform this action.");
        throw new Error("Unauthorized action: Admin privileges required.");
    }
}
// Update Wallet Address in Navbar
async function updateWalletDisplay() {
    try {
        // Always use window.web3 instead of global web3 reference
        const accounts = await window.web3.eth.getAccounts();
        window.currentAccount = accounts.length > 0 ? accounts[0] : null;

        const walletDisplay = document.getElementById("walletAddressDisplay");
        if (walletDisplay) {
            walletDisplay.textContent = window.currentAccount 
                ? `Connected Wallet: ${window.currentAccount}`
                : "";
        }
    } catch (error) {
        console.error("Error updating wallet display:", error);
    }
}

function redirectToUpdatePage(eventId) {
    window.location.href = `eventupdate.html?eventId=${eventId}`;
}

// ✅ Load Events into Table
async function loadEvents() {
    console.log("✅ Running loadEvents...");

    const eventTableBody = document.getElementById("eventTableBody");
    if (!eventTableBody) {
        console.error("❌ Event table not found.");
        return;
    }

    eventTableBody.innerHTML = `<tr><td colspan="10" class="text-center">Loading events, please wait...</td></tr>`;

    try {
        if (!window.web3) await initializeWeb3();
        if (!window.contract) await initializeContract();

        if (!window.contract) {
            console.error("❌ Contract not initialized. Cannot load events.");
            eventTableBody.innerHTML = `<tr><td colspan="10" class="text-center text-danger">Error loading events.</td></tr>`;
            return;
        }

        allEvents = await fetchAllEvents();
        console.log("✅ All Events Data:", allEvents);

        if (!Array.isArray(allEvents) || allEvents.length === 0) {
            console.warn("⚠️ No valid events found.");
            eventTableBody.innerHTML = `<tr><td colspan="10" class="text-center">No events available.</td></tr>`;
            return;
        }

        renderFilteredEvents();
    } catch (error) {
        console.error("❌ Error loading events:", error);
        eventTableBody.innerHTML = `<tr><td colspan="10" class="text-center text-danger">Error loading events. Please try again.</td></tr>`;
    }
}
function renderEvents(eventsToDisplay) {
    const eventTableBody = document.getElementById("eventTableBody");
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    if (!eventsToDisplay || eventsToDisplay.length === 0) {
        eventTableBody.innerHTML = `<tr><td colspan="10" class="text-center">No events match your criteria.</td></tr>`;
        updatePaginationDisplay(1, 1);
        return;
    }

    // Calculate pagination values
    const totalPages = Math.ceil(eventsToDisplay.length / eventsPerPage);
    const startIndex = (currentPage - 1) * eventsPerPage;
    const endIndex = Math.min(startIndex + eventsPerPage, eventsToDisplay.length);
    const paginatedEvents = eventsToDisplay.slice(startIndex, endIndex);

    // Update pagination display
    updatePaginationDisplay(currentPage, totalPages);

    // Clear and populate table
    eventTableBody.innerHTML = "";

    paginatedEvents.forEach((event, index) => {
        try {
            // Convert values to numbers
            const eventTimestamp = Number(event.eventTimestamp);
            const maxTickets = Number(event.maxTickets);
            const ticketsMinted = Number(event.ticketsMinted);
            const availableTickets = maxTickets - ticketsMinted;
            const isExpired = eventTimestamp < currentTimestamp;

            // Format date
            let formattedDate;
            if (eventTimestamp && !isNaN(eventTimestamp)) {
                formattedDate = new Date(eventTimestamp * 1000).toLocaleDateString();
            } else {
                formattedDate = "N/A";
            }

            // Format price
            let eventPrice = "N/A";
            if (typeof event.price !== "undefined" && window.web3 && window.web3.utils) {
                eventPrice = `${window.web3.utils.fromWei(event.price, "ether")} ETH`;
            }

            // Add "Update" button for admin only
            const updateButton = isAdmin(window.currentAccount) ? `
                <button class="btn btn-warning btn-sm update-btn" 
                    ${isExpired ? 'disabled title="Event expired"' : ''}
                    onclick="redirectToUpdatePage('${event.eventId}')">
                    ${isExpired ? 'Expired' : 'Update'}
                </button>
            ` : "";

            const row = `
                <tr>
                    <td>${event.eventId}</td>
                    <td>${event.eventName}</td>
                    <td>${formattedDate}</td>
                    <td>${event.eventLocation}</td>
                    <td>${eventPrice}</td>
                    <td>${availableTickets}</td>
                    <td>${ticketsMinted}</td>
                    <td>${maxTickets}</td>
                    <td>${isExpired ? 'Expired' : 'Available'}</td>
                    <td>${updateButton}</td>
                </tr>
            `;
            eventTableBody.innerHTML += row;
        } catch (error) {
            console.error(`❌ Error processing event ${index}:`, error);
        }
    });

    console.log("✅ Events displayed successfully.");
}

// window.onload = async () => {
//     console.log("🔹 Window fully loaded, initializing Web3...");
//     await initializeWeb3();

//     setTimeout(async () => {
//         await initializeContract();
//         await loadEvents();
//     }, 500); // Delay to ensure elements are ready
// };

function updatePaginationDisplay(currentPage, totalPages) {
    const currentPageDisplay = document.getElementById("currentPageDisplay");
    if (currentPageDisplay) {
        currentPageDisplay.textContent = `Page ${currentPage} of ${totalPages}`;
    }
    
    // Enable/disable pagination buttons
    const prevButton = document.getElementById("prevPage");
    const nextButton = document.getElementById("nextPage");
    
    if (prevButton) prevButton.disabled = currentPage <= 1;
    if (nextButton) nextButton.disabled = currentPage >= totalPages;
}

// Function to change pages
window.changePage = function (direction) {
    const newPage = currentPage + direction;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    // Filter events based on current criteria
    let filteredEvents = allEvents.filter(event => {
        const isExpired = Number(event.eventTimestamp) < currentTimestamp;
        if (currentFilter === 'available' && isExpired) return false;
        if (currentFilter === 'expired' && !isExpired) return false;
        
        if (currentSearchTerm) {
            const searchFields = [
                event.eventName.toLowerCase(),
                event.eventLocation.toLowerCase(),
                event.eventId.toString()
            ];
            return searchFields.some(field => field.includes(currentSearchTerm));
        }
        
        return true;
    });

    const totalPages = Math.ceil(filteredEvents.length / eventsPerPage);
    
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderEvents(filteredEvents);
    }
};

function setEventFilter(filter) {
    currentFilter = filter;
    currentPage = 1; // Reset to first page when changing filter
    
    // Remove all filter classes from body
    document.body.classList.remove('filter-all', 'filter-available', 'filter-expired');
    
    // Add the appropriate body class for global styling
    document.body.classList.add(`filter-${filter}`);
    
    // Update button active states
    const allButtons = ['filterAll', 'filterAvailable', 'filterExpired'];
    allButtons.forEach(btnId => {
        document.getElementById(btnId).classList.remove('active');
    });
    
    // Add active class to selected filter button
    const activeButtonId = `filter${filter.charAt(0).toUpperCase() + filter.slice(1)}`;
    document.getElementById(activeButtonId).classList.add('active');
    
    applyFilters();
}


function applyFilters() {
    currentSearchTerm = document.getElementById('eventSearch').value.toLowerCase();
    currentPage = 1; // Reset to first page when searching
    renderFilteredEvents();
}

function renderFilteredEvents() {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    let filteredEvents = allEvents.filter(event => {
        // Apply status filter
        const isExpired = Number(event.eventTimestamp) < currentTimestamp;
        if (currentFilter === 'available' && isExpired) return false;
        if (currentFilter === 'expired' && !isExpired) return false;
        
        // Apply search filter
        if (currentSearchTerm) {
            const searchFields = [
                event.eventName.toLowerCase(),
                event.eventLocation.toLowerCase(),
                event.eventId.toString()
            ];
            return searchFields.some(field => field.includes(currentSearchTerm));
        }
        
        return true;
    });

    renderEvents(filteredEvents);
}

// ✅ Create Event
async function createEvent() {
    try {
        await initializeWeb3(); // Ensure Web3 is initialized
        await initializeContract(); // Ensure contract is initialized

        enforceAdminPrivileges();

        // ✅ Ensure Web3 is initialized before using it
        if (!window.web3 || !window.web3.utils) {
            console.error("❌ Web3 is not properly initialized.");
            alert("⚠️ Web3 is not initialized. Please ensure MetaMask is connected.");
            return;
        }

        // ✅ Retrieve values from form
        const eventName = document.getElementById("eventName").value.trim();
        const eventDate = document.getElementById("eventDate").value.trim(); // Assuming this is a date input
        const eventLocation = document.getElementById("eventLocation").value.trim();
        const price = document.getElementById("price").value.trim();
        const maxTickets = document.getElementById("availableTickets").value.trim();

        // ✅ Validate inputs
        if (!eventName || !eventDate || !eventLocation || !price || !maxTickets) {
            alert("⚠️ All fields must be filled.");
            return;
        }

        if (isNaN(price) || Number(price) <= 0) {
            alert("⚠️ Price must be a valid positive number.");
            return;
        }

        if (isNaN(maxTickets) || maxTickets <= 0) {
            alert("⚠️ Max tickets must be a valid number.");
            return;
        }

        // ✅ Convert date to Unix timestamp
        const eventTimestamp = Math.floor(new Date(eventDate).getTime() / 1000);

        // ✅ Convert price to Wei safely
        let priceInWei;
        try {
            priceInWei = window.web3.utils.toWei(price.toString(), "ether");
        } catch (conversionError) {
            console.error("❌ Failed to convert price to Wei:", conversionError);
            alert("⚠️ Invalid price format.");
            return;
        }
        
        // ✅ Check if event exists by accessing result properties
        const result = await window.contract.methods.eventExists(
            eventName,
            eventTimestamp,
            eventLocation,
            priceInWei
        ).call();

        const exists = result[0]; // Access first return value
        const eventId = result[1]; // Access second return value
        

        if (exists) {
            const proceed = confirm("You have created an event with the exact same values in it. We will instead increment the amount of available tickets for that event for you. Proceed?");
            if (proceed) {
                await window.contract.methods.incrementMaxTickets(
                    eventId,
                    maxTickets
                ).send({ from: window.currentAccount });

                alert("✅ Available tickets incremented successfully!");
                window.location.href = "eventview.html"; // Redirect to event list
                return;
            } else {
                return;
            }
        }

        // ✅ Send transaction to the smart contract
        console.log("🔹 Sending transaction to create event:", {
            eventName,
            eventTimestamp,
            eventLocation,
            priceInWei,
            maxTickets,
        });

        const tx = await window.contract.methods.createEvent(
            eventName,
            eventTimestamp,
            eventLocation,
            priceInWei,
            maxTickets
        ).send({ from: window.currentAccount });

        console.log("✅ Event created successfully:", tx);

        alert("✅ Event created successfully!");
        window.location.href = "eventview.html"; // Redirect to event list
    } catch (error) {
        console.error("❌ Error creating event:", error);

        // Extract the exact error message from the EVM revert
        let errorMessage = "Transaction has been rejected by the EVM: ";
        if (error.message && error.message.includes("revert")) {
            // Extract the revert reason from the error message
            const revertReason = error.message.split("revert ")[1] || "Unknown error";
            errorMessage += revertReason;
        } else if (error.data && error.data.message) {
            // Extract the revert reason from the error data
            const revertReason = error.data.message.split("revert ")[1] || "Unknown error";
            errorMessage += revertReason;
        } else if (error.receipt && error.receipt.logs && error.receipt.logs.length > 0) {
            // Fallback: Try to extract the revert reason from the transaction receipt logs
            const logs = error.receipt.logs;
            for (const log of logs) {
                if (log.data && log.data.includes("revert")) {
                    const revertReason = log.data.split("revert ")[1] || "Unknown error";
                    errorMessage += revertReason;
                    break;
                }
            }
        } else {
            errorMessage += "Unknown error";
        }

        // Display the exact error message in the popup
        alert(errorMessage);
    }
}

// ✅ Update Event Max Tickets
async function updateEventMaxTickets(eventId, newMaxTickets) {
    try {
        await initializeWeb3(); // Ensure Web3 is initialized
        await initializeContract(); // Ensure contract is initialized

        enforceAdminPrivileges();

        // ✅ Ensure Web3 is initialized before using it
        if (!window.web3 || !window.web3.utils) {
            console.error("❌ Web3 is not properly initialized.");
            alert("⚠️ Web3 is not initialized. Please ensure MetaMask is connected.");
            return;
        }

        // ✅ Get current event details
        const event = await window.contract.methods.events(eventId).call();
        const ticketsMinted = event.ticketsMinted;

        // ✅ Client-side validation
        if (Number(newMaxTickets) < Number(ticketsMinted)) {
            alert(`⚠️ Cannot reduce below ${ticketsMinted} tickets (already minted).`);
            return;
        }

        // ✅ Send transaction to the smart contract
        console.log("🔹 Sending transaction to update event max tickets:", {
            eventId,
            newMaxTickets,
        });

        const tx = await window.contract.methods.updateMaxTickets(
            eventId,
            newMaxTickets
        ).send({ from: window.currentAccount });

        console.log("✅ Event max tickets updated successfully:", tx);

        alert("✅ Event max tickets updated successfully!");
        window.location.href = "eventview.html"; // Redirect to event list
    } catch (error) {
        console.error("❌ Error updating event max tickets:", error);

        // Extract the exact error message from the EVM revert
        let errorMessage = "Transaction has been rejected by the EVM: ";
        if (error.message && error.message.includes("revert")) {
            // Extract the revert reason from the error message
            const revertReason = error.message.split("revert ")[1] || "Unknown error";
            errorMessage += revertReason;
        } else if (error.data && error.data.message) {
            // Extract the revert reason from the error data
            const revertReason = error.data.message.split("revert ")[1] || "Unknown error";
            errorMessage += revertReason;
        } else if (error.receipt && error.receipt.logs && error.receipt.logs.length > 0) {
            // Fallback: Try to extract the revert reason from the transaction receipt logs
            const logs = error.receipt.logs;
            for (const log of logs) {
                if (log.data && log.data.includes("revert")) {
                    const revertReason = log.data.split("revert ")[1] || "Unknown error";
                    errorMessage += revertReason;
                    break;
                }
            }
        } else {
            errorMessage += "Unknown error";
        }

        // Display the exact error message in the popup
        alert(errorMessage);
    }
}

// Load Tickets
async function loadTickets() {
    const ticketTableBody = document.getElementById("ticketsTableBody");
    if (!ticketTableBody) return;

    try {
        const ticketCount = await contract.methods.ticketCount().call();
        ticketTableBody.innerHTML = "";

        for (let i = 1; i <= ticketCount; i++) {
            const ticket = await contract.methods.getTicket(i).call();
            const priceETH = web3.utils.fromWei(ticket[5], "ether");
            const ticketStatus = ticket[7] ? "Expired" : "Available";

            const row = `
                <tr>
                    <td>${ticket[0]}</td>
                    <td>${ticket[1]}</td>
                    <td>${ticket[2]}</td>
                    <td>${ticket[3]}</td>
                    <td>${priceETH} ETH</td>
                    <td>${ticketStatus}</td>
                    <td>
                        <button class="btn btn-primary btn-sm purchaseButton" data-ticket-id="${ticket[0]}">Purchase</button>
                    </td>
                </tr>
            `;
            ticketTableBody.innerHTML += row;
        }

        // Attach event listeners to purchase buttons
        document.querySelectorAll(".purchaseButton").forEach((button) => {
            button.addEventListener("click", (event) => {
                const ticketId = event.target.getAttribute("data-ticket-id");
                purchaseTicket(ticketId);
            });
        });
    } catch (error) {
        console.error("Error loading tickets:", error);
    }
}

// Purchase Ticket
async function purchaseTicket(ticketId) {
    try {
        await contract.methods.purchaseTicket(ticketId).send({ from: currentAccount });
        alert("Ticket purchased successfully!");
        await loadTickets();
    } catch (error) {
        console.error("Error purchasing ticket:", error);
    }
}

// ✅ Attach updateEvent() to the button
document.addEventListener("DOMContentLoaded", () => {
    const updateEventButton = document.getElementById("updateEventButton");
    if (updateEventButton) {
        updateEventButton.addEventListener("click", updateEvent);
    } else {
        console.warn("⚠️ 'updateEventButton' not found in the DOM.");
    }
    const searchInput = document.getElementById('eventSearch');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                applyFilters();
            }
        });
    }
});


document.addEventListener("DOMContentLoaded", async () => {
    console.log("🔹 DOM Content Loaded: Initializing Web3...");

    const storedWallet = sessionStorage.getItem("connectedWallet");
    if (storedWallet) {
        window.currentAccount = storedWallet;
        console.log("Using stored wallet:", storedWallet);
    }

    // Initialize core components
    await initializeWeb3();
    await initializeContract();
    await verifyAccess();
    await updateWalletDisplay();

    const createEventButton = document.getElementById("createEventButton");

    if (createEventButton) {
        createEventButton.addEventListener("click", async () => {
            await createEvent();
        });
    } else {
        console.warn("⚠️ 'createEventButton' not found in the DOM.");
    }
});

// Attach event listeners to the delete buttons
document.addEventListener("DOMContentLoaded", async () => {
    await initializeWeb3();
    await initializeContract();
    await verifyAccess();
    

    // Load events without attaching delete listeners
    await loadEvents();
});

document.addEventListener("DOMContentLoaded", async () => {
    console.log("🔹 DOM Content Loaded: Initializing Web3...");

    await initializeWeb3(); // ✅ Ensure Web3 is initialized before any button click
    await initializeContract();
    await verifyAccess();

    const params = new URLSearchParams(window.location.search);
    const eventId = params.get("eventId");


    console.log("📋 Event ID from URL:", eventId); // Debugging

    try {
        // Fetch event details from the contract
        const event = await window.contract.methods.events(eventId).call();

        // Populate the form with event details
        document.getElementById("eventName").value = event.eventName;
        document.getElementById("eventDate").value = new Date(event.eventTimestamp * 1000).toLocaleDateString();
        document.getElementById("eventLocation").value = event.eventLocation;
        document.getElementById("price").value = window.web3.utils.fromWei(event.price, "ether");
        document.getElementById("availableTickets").value = event.maxTickets;
        document.getElementById("mintedTickets").value = event.ticketsMinted;
        document.getElementById("currentMaxTickets").value = event.maxTickets; // Set current max
        document.getElementById("availableTickets").value = ""; // Clear new max field

        console.log("✅ Form populated with event data.");
    } catch (error) {
        console.error("❌ Error fetching event details:", error);
    }

    const updateEventForm = document.getElementById("updateEventForm");

    if (updateEventForm) {
        updateEventForm.addEventListener("submit", async (event) => {
            event.preventDefault();
    
            const newMaxTickets = document.getElementById("availableTickets").value.trim();
            const ticketsMinted = document.getElementById("mintedTickets").value;
    
            if (!newMaxTickets || isNaN(newMaxTickets) || Number(newMaxTickets) <= 0) {
                alert("⚠️ Available tickets must be a valid positive number.");
                return;
            }
    
            if (Number(newMaxTickets) < Number(ticketsMinted)) {
                alert(`⚠️ Cannot set max tickets below ${ticketsMinted} (already minted).`);
                return;
            }
    
            await updateEventMaxTickets(eventId, newMaxTickets);
        });
    } else {
        console.warn("⚠️ 'updateEventForm' not found in the DOM.");
    }
});