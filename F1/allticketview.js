// Constants
const ADMIN_ACCOUNT = "0x39022f2935339Ff128e2917AFF08867098Fffc4e"; // Admin account for privileged actions
let isWeb3Initialized = false; // Track Web3 initialization status

// Pagination Variables
let totalPages = 1;
let allTickets = [];
let filteredTickets = [];

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

// Load All Tickets and Implement Pagination
async function loadAllTickets() {
    const tableBody = document.getElementById("allTicketsTable");
    const pageInfo = document.getElementById("pageInfo");

    if (!tableBody || !pageInfo) {
        console.error("❌ Ticket table or pagination elements not found.");
        return;
    }

    try {
        // Fetch all events from contract
        const events = await window.contract.methods.getAllEvents().call();

        // Fetch all tickets for each event
        allTickets = [];
        for (const event of events) {
            const tickets = await window.contract.methods.getTicketsForEvent(event.eventId).call();
            allTickets = [...allTickets, ...tickets];
        }

        // ✅ Sort tickets by Ticket ID (ascending order)
        allTickets.sort((a, b) => a.ticketId - b.ticketId);
        filteredTickets = allTickets; // Initially, filteredTickets contains all tickets

        // ✅ Calculate Total Pages
        totalPages = Math.ceil(filteredTickets.length / ticketsPerPage);
        if (totalPages < 1) totalPages = 1;

        // ✅ Render First Page
        renderTickets();

        console.log("📢 Retrieved and sorted tickets:", allTickets);
    } catch (error) {
        console.error("❌ Error loading tickets:", error);
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center">Error loading tickets. Please try again</td></tr>`;
    }
}

// Render Paginated Tickets
function renderTickets() {
    const tableBody = document.getElementById("allTicketsTable");
    const pageInfo = document.getElementById("pageInfo");

    tableBody.innerHTML = "";

    if (filteredTickets.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center">No tickets found</td></tr>`;
        return;
    }

    // ✅ Calculate Indexes for Pagination
    const startIndex = (currentPage - 1) * ticketsPerPage;
    const endIndex = Math.min(startIndex + ticketsPerPage, filteredTickets.length);
    const paginatedTickets = filteredTickets.slice(startIndex, endIndex);

    // ✅ Populate Table with Current Page Data
    paginatedTickets.forEach(ticket => {
        const owner = ticket.currentOwner === "0x0000000000000000000000000000000000000000" ? "Available" : ticket.currentOwner;
        const status = ticket.isForSale ? "For Sale" : (ticket.isForResale ? "Resale" : "Owned");
        const priceETH = window.web3.utils.fromWei(ticket.price, "ether");

        // Convert Unix timestamp to a readable date
        let eventDate;
        if (ticket.eventTimestamp && !isNaN(ticket.eventTimestamp)) {
            eventDate = new Date(ticket.eventTimestamp * 1000).toLocaleDateString();
        } else {
            console.warn(`⚠️ Ticket ${ticket.ticketId} has an invalid timestamp:`, ticket.eventTimestamp);
            eventDate = "N/A";
        }

        const row = `
            <tr>
                <td>${ticket.ticketId}</td>
                <td>${ticket.eventName}</td>
                <td>${eventDate}</td> <!-- Updated to display readable date -->
                <td>${ticket.eventLocation}</td>
                <td>${owner}</td>
                <td>${priceETH} ETH</td>
                <td>${status}</td>
            </tr>`;
        tableBody.innerHTML += row;
    });

    // ✅ Update Page Info
    pageInfo.innerHTML = `Page ${currentPage} of ${totalPages}`;
}

// Search Functionality
function searchTickets() {
    const query = document.getElementById("searchInput").value.toLowerCase();

    filteredTickets = allTickets.filter(ticket => {
        // Convert Unix timestamp to a readable date for searching
        let eventDate;
        if (ticket.eventTimestamp && !isNaN(ticket.eventTimestamp)) {
            eventDate = new Date(ticket.eventTimestamp * 1000).toLocaleDateString();
        } else {
            eventDate = "N/A";
        }

        return (
            ticket.ticketId.toString().includes(query) ||
            ticket.eventName.toLowerCase().includes(query) ||
            eventDate.toLowerCase().includes(query) || // Include the readable date in the search
            ticket.eventLocation.toLowerCase().includes(query) ||
            ticket.currentOwner.toLowerCase().includes(query) ||
            window.web3.utils.fromWei(ticket.price, "ether").includes(query) ||
            (ticket.isForSale ? "for sale" : ticket.isForResale ? "resale" : "owned").includes(query)
        );
    });

    // ✅ Reset Pagination
    currentPage = 1;
    totalPages = Math.ceil(filteredTickets.length / ticketsPerPage);
    if (totalPages < 1) totalPages = 1;

    // ✅ Render Filtered Results
    renderTickets();
}

// Pagination Controls
document.getElementById("prevPage").addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage--;
        renderTickets();
    }
});

document.getElementById("nextPage").addEventListener("click", () => {
    if (currentPage < totalPages) {
        currentPage++;
        renderTickets();
    }
});

// Search Button Event Listener
document.getElementById("searchButton").addEventListener("click", searchTickets);

// Handle Wallet Changes
window.ethereum.on("accountsChanged", async (accounts) => {
    if (accounts.length > 0) {
        window.currentAccount = accounts[0];
        sessionStorage.setItem("connectedWallet", window.currentAccount);
        await updateWalletDisplay();
        await loadAllTickets(); // Reload tickets when wallet changes
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

    // Load all tickets
    await loadAllTickets();
});