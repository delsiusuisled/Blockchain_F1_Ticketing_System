// Constants
const ADMIN_ACCOUNT = "0x39022f2935339Ff128e2917AFF08867098Fffc4e"; // Admin account for privileged actions
let isWeb3Initialized = false; // Track Web3 initialization status

// Initialize Web3
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
        }
        return false;
    }
}

// Update Wallet Display
async function updateWalletDisplay() {
    try {
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

// Initialize Contract
async function initializeContract() {
    if (!isWeb3Initialized) {
        await initializeWeb3();
    }

    if (!window.contract && window.web3) {
        window.contract = new window.web3.eth.Contract(
            F1TicketContract.abi,
            CONTRACT_ADDRESS
        );
        console.log("🔹 Contract initialized.");
    }
}

// Fetch All Events from Smart Contract
async function fetchAllEvents() {
    try {
        if (!window.contract) await initializeContract();

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
            availableTickets: event[5],
            ticketIds: event[6],
            status: event[7]
        }));
    } catch (error) {
        console.error("❌ Failed to fetch events from contract:", error);
        return [];
    }
}

// Load Tickets into Table
// Load Tickets into Table
async function loadTickets() {
    console.log("✅ Running loadTickets...");

    const ticketTableBody = document.getElementById("ticketTableBody");
    if (!ticketTableBody) {
        console.error("❌ Ticket table not found.");
        return;
    }

    ticketTableBody.innerHTML = `<tr><td colspan="7" class="text-center">Loading events, please wait...</td></tr>`;

    try {
        const events = await fetchAllEvents();

        if (!events.length) {
            ticketTableBody.innerHTML = `<tr><td colspan="7" class="text-center">No events available</td></tr>`;
            return;
        }

        ticketTableBody.innerHTML = ""; // Clear previous entries

        events.forEach((event, index) => {
            try {
                console.log(`🔍 Processing Event ${index}:`, event);

                // Convert Unix timestamp to a readable date
                let eventDate;
                if (event.eventTimestamp && !isNaN(event.eventTimestamp)) {
                    eventDate = new Date(event.eventTimestamp * 1000).toLocaleDateString();
                } else {
                    console.warn(`⚠️ Event ${index} has an invalid timestamp:`, event.eventTimestamp);
                    eventDate = "N/A";
                }

                // Convert price to Ether
                const priceInEther = window.web3.utils.fromWei(String(event.price), "ether");

                // Determine event availability based on the timestamp
                let availability;
                const currentTimestamp = Math.floor(Date.now() / 1000); // Current time in Unix timestamp

                if (event.eventTimestamp < currentTimestamp) {
                    availability = "Expired";
                } else if (event.availableTickets > 0) {
                    availability = "Available";
                } else {
                    availability = "Sold Out";
                }

                // Construct event row in HTML
                const row = `
                    <tr>
                        <td>${event.eventId}</td>
                        <td>${event.eventName}</td>
                        <td>${eventDate}</td>
                        <td>${event.eventLocation}</td>
                        <td>${priceInEther} ETH</td>
                        <td>${availability}</td>
                        <td>
                            <button class="btn btn-primary" onclick="navigateToEvent(${event.eventId})">View Tickets</button>
                        </td>
                    </tr>
                `;
                ticketTableBody.innerHTML += row;
            } catch (error) {
                console.error(`❌ Error processing event ${index}:`, event, error);
            }
        });

        console.log("✅ Events displayed successfully.");
    } catch (error) {
        console.error("❌ Error loading events:", error);
        ticketTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error loading events. Please try again.</td></tr>`;
    }
}


// Navigate to Ticket Details
function navigateToEvent(eventId) {
    window.location.href = `ticketdataview.html?eventId=${eventId}`;
}

// Handle Wallet Changes
window.ethereum.on("accountsChanged", async (accounts) => {
    if (accounts.length > 0) {
        window.currentAccount = accounts[0];
        sessionStorage.setItem("connectedWallet", window.currentAccount);
        await updateWalletDisplay();
        await loadTickets(); // Reload tickets when wallet changes
    } else {
        window.currentAccount = null;
        sessionStorage.removeItem("connectedWallet");
        await updateWalletDisplay();
    }
});

// DOMContentLoaded Handler
document.addEventListener("DOMContentLoaded", async () => {
    console.log("🔹 DOM Content Loaded: Initializing Web3...");

    // Check for stored wallet first
    const storedWallet = sessionStorage.getItem("connectedWallet");
    if (storedWallet) {
        window.currentAccount = storedWallet;
        console.log("Using stored wallet:", storedWallet);
    }

    // Initialize Web3
    const web3Initialized = await initializeWeb3();
    if (!web3Initialized) {
        console.error("❌ Web3 initialization failed.");
        return;
    }

    // Initialize contract
    await initializeContract();

    // Update wallet display
    await updateWalletDisplay();

    // Load tickets
    await loadTickets();
});