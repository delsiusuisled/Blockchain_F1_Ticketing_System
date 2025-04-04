let isWeb3Initialized = false;
let isContractInitialized = false;
let isConnecting = false
let isEventsLoaded = false;

// ✅ Ensure Web3 is Initialized Before Interacting with the Contract
async function initializeWeb3() {
    if (isWeb3Initialized) {
        console.log("🔹 Web3 is already initialized.");
        return;
    }

    if (typeof window.ethereum === "undefined") {
        alert("⚠️ MetaMask is not installed. Please install it.");
        throw new Error("MetaMask not detected.");
    }

    try {
        console.log("🔹 Initializing Web3...");
        const provider = window.ethereum;
        window.web3 = new Web3(provider);

        const accounts = await provider.request({ method: "eth_requestAccounts" });
        window.currentAccount = accounts[0];
        sessionStorage.setItem("connectedWallet", window.currentAccount);
        console.log("✅ Wallet connected:", window.currentAccount);

        isWeb3Initialized = true;
    } catch (error) {
        console.error("❌ Failed to initialize Web3 or connect wallet:", error);
    }
}

// ✅ Ensure Contract is Initialized Before Interacting
async function initializeContract() {
    if (isContractInitialized) {
        console.log("🔹 Contract is already initialized.");
        return;
    }

    if (!window.web3) {
        console.error("Web3 is not initialized. Initializing now...");
        await initializeWeb3();
    }

    try {
        console.log("🔹 Initializing Contract...");
        window.contract = new window.web3.eth.Contract(F1TicketContract.abi, CONTRACT_ADDRESS);
        console.log("✅ Contract initialized successfully.");

        isContractInitialized = true;
    } catch (error) {
        console.error("❌ Error initializing contract:", error);
    }
}


// ✅ Fetch Events Directly from Smart Contract
async function fetchAllEvents() {
    try {
        if (!window.contract) await initializeContract(); // Ensure contract is initialized

        const events = await window.contract.methods.getAllEvents().call();
        console.log("✅ Raw Events fetched from smart contract:", events);

        if (!Array.isArray(events)) {
            console.error("❌ Unexpected data format. Expected an array but got:", events);
            return [];
        }

        if (events.length === 0) {
            console.warn("⚠️ No events found.");
            return [];
        }

        return events;
    } catch (error) {
        console.error("❌ Failed to fetch events from contract:", error);
        return [];
    }
}

// Check Admin Role
async function isAdmin(walletAddress) {
    try {
        await initializeWeb3();
        await initializeContract();

        const ADMIN_ROLE = window.web3.utils.keccak256("ADMIN_ROLE"); // Ensure web3.utils is available
        const isAdmin = await window.contract.methods.hasRole(ADMIN_ROLE, walletAddress).call();
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
        const admin = await isAdmin(walletAddress);
        const organizer = await isOrganizer(walletAddress);

        console.log(`🔹 Checking Admin/Organizer Role: isAdmin = ${admin}, isOrganizer = ${organizer}`);
        return admin || organizer;
    } catch (error) {
        console.error("❌ Error checking admin/organizer role:", error);
        return false;
    }
}

// ✅ Load Events and Display in the Table (Hidden Expired Events)
async function loadEvents() {
    console.log("✅ Running loadEvents...");

    const eventTableBody = document.getElementById("eventsTableBody");
    if (!eventTableBody) {
        console.error("❌ Event table not found.");
        return;
    }

    eventTableBody.innerHTML = `<tr><td colspan="7" class="text-center">Loading events, please wait...</td></tr>`;

    try {
        if (!window.web3) await initializeWeb3();
        if (!window.contract) await initializeContract();

        const events = await fetchAllEvents();
        console.log("✅ Raw Events:", events);

        if (!Array.isArray(events) || events.length === 0) {
            console.warn("⚠️ No valid events found.");
            eventTableBody.innerHTML = `<tr><td colspan="7" class="text-center">No events available.</td></tr>`;
            return;
        }

        eventTableBody.innerHTML = ""; // Clear table
        const currentTimestamp = Math.floor(Date.now() / 1000);

        // Filter out expired events (remain in blockchain storage)
        const activeEvents = events.filter(event => {
            const eventTimestamp = Number(event.eventTimestamp);
            return eventTimestamp > currentTimestamp;
        });

        if (activeEvents.length === 0) {
            eventTableBody.innerHTML = `<tr><td colspan="6" class="text-center">No upcoming events found.</td></tr>`;
            return;
        }

        activeEvents.forEach((event) => {
            try {
                const maxTickets = Number(event.maxTickets);
                const ticketsMinted = Number(event.ticketsMinted);
                const availableTickets = maxTickets - ticketsMinted; // Calculate available tickets
                const availability = availableTickets > 0 ? "Available" : "Sold Out";
                
                const eventPrice = event.price ? 
                    `${window.web3.utils.fromWei(event.price, "ether")} ETH` : 
                    "N/A";

                const row = `
                    <tr>
                        <td>${event.eventName}</td>
                        <td>${new Date(event.eventTimestamp * 1000).toLocaleDateString()}</td>
                        <td>${event.eventLocation}</td>
                        <td>${eventPrice}</td>
                        <td>${availableTickets}</td> <!-- Changed from maxTickets -->
                        <td>${availability}</td>
                        <td>
                            <button class="btn btn-primary" 
                                    onclick="navigateToEventDetails(${event.eventId})">
                                Details
                            </button>
                        </td>
                    </tr>
                `;
                eventTableBody.innerHTML += row;
            } catch (error) {
                console.error("❌ Error processing event:", event, error);
            }
        });

        console.log("✅ Active events displayed successfully.");
        console.log("ℹ️ Expired events remain stored in contract storage");
    } catch (error) {
        console.error("❌ Error loading events:", error);
        eventTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading events. Please try again.</td></tr>`;
    }
}

// ✅ Redirect to Event Details Page
function navigateToEventDetails(eventId) {
    window.location.href = `eventdetails.html?eventId=${eventId}`;
}

// ✅ Connect Wallet with Loading State
async function connectWallet() {
    if (isConnecting) return;
    isConnecting = true;

    const navConnectButton = document.getElementById("navConnectWalletButton");
    if (navConnectButton) {
        // Add spinner and disable button
        navConnectButton.innerHTML = `
            Connecting...
            <div class="animate-spin spinner-border h-5 w-5 border-b-2 rounded-full mr-2"></div>
        `;
        navConnectButton.disabled = true;
    }

    try {
        if (typeof window.ethereum === "undefined") {
            alert("⚠️ MetaMask is not installed. Please install it.");
            return;
        }

        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        const walletAddress = accounts[0];

        console.log("✅ Wallet Connected:", walletAddress);
        sessionStorage.setItem("connectedWallet", walletAddress);

        await initializeWeb3();
        await initializeContract();
        await safeUpdateNavbar(walletAddress);

    } catch (error) {
        console.error("❌ Error connecting wallet:", error);
        alert("Failed to connect wallet. Please try again.");
    } finally {
        isConnecting = false;
        if (navConnectButton) {
            navConnectButton.disabled = false;
        }
    }
}


// ✅ Disconnect Wallet with Proper UI Reset
async function disconnectWallet() {
    console.log("🔹 Disconnecting Wallet...");
    
    // Full cleanup
    sessionStorage.removeItem("connectedWallet");
    window.currentAccount = null;
    window.web3 = null;
    window.contract = null;
    isWeb3Initialized = false;
    isContractInitialized = false;

    // Force UI update
    await safeUpdateNavbar(null);
    
    // Page-specific cleanup
    if (window.location.pathname.includes("mytickets.html")) {
        document.getElementById("myTicketsTableBody").innerHTML = "";
    }
    
    console.log("✅ Wallet fully disconnected");

    // // Add a small delay for UI smoothness
    // setTimeout(() => {
    //     console.log("✅ Wallet Disconnected.");

    //     // Reset Navbar to "Connect Wallet" state
    //     if (navConnectButton) {
    //         navConnectButton.textContent = "Connect Wallet";
    //         navConnectButton.disabled = false; // Enable the button
    //         navConnectButton.classList.add("btn-danger");
    //         navConnectButton.classList.remove("btn-secondary");
    //         navConnectButton.onclick = connectWallet; // Reset to connect logic
    //     }
    // }, 500);
}

// ✅ Safe Update Navbar Function
async function safeUpdateNavbar(walletAddress) {
    const walletDisplay = document.getElementById("walletDisplay");
    const navConnectButton = document.getElementById("navConnectWalletButton");
    const staffNavItem = document.getElementById("staffNavItem");

    if (!walletDisplay || !navConnectButton) return;

    // Visual state management
    if (walletAddress) {
        // Connected state
        walletDisplay.innerHTML = `
            <div class="wallet-status">
                <span class="connected-indicator"></span>
                ${walletAddress}
            </div>
        `;
        walletDisplay.style.display = "flex";
        navConnectButton.classList.remove("btn-danger");
        navConnectButton.classList.add("btn-secondary");
        
        // Staff check
        if (staffNavItem) {
            const isAdminOrOrganizer = await isOrganizerOrAdmin(walletAddress);
            staffNavItem.style.display = isAdminOrOrganizer ? "inline-block" : "none";
        }
    } else {
        // Disconnected state
        walletDisplay.textContent = "Not Connected";
        walletDisplay.style.display = "inline-block"; // Changed from none to inline-block
        navConnectButton.classList.add("btn-danger");
        navConnectButton.classList.remove("btn-secondary");
        if (staffNavItem) staffNavItem.style.display = "none";
    }
    
    // Reset button to default state
    navConnectButton.innerHTML = walletAddress ? "Disconnect Wallet" : "Connect Wallet";
}

// ✅ Page Load Logic
document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initializeWeb3();
        await initializeContract();

        const navConnectButton = document.getElementById("navConnectWalletButton");
        if (!navConnectButton) return;

        // Single handler for all connection states
        navConnectButton.addEventListener("click", async () => {
            const connectedWallet = sessionStorage.getItem("connectedWallet");
            if (connectedWallet) {
                await disconnectWallet();
            } else {
                await connectWallet();
            }
        });

        // Initial UI update
        const connectedWallet = sessionStorage.getItem("connectedWallet");
        await safeUpdateNavbar(connectedWallet || null);
        
    } catch (error) {
        console.error("❌ Error during page initialization:", error);
    }
});

window.onload = async () => {
    console.log("🔹 Window fully loaded...");
    await initializeWeb3();
    await initializeContract();
    await loadEvents();
};