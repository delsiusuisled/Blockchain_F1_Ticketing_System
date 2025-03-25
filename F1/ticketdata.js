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

// Fetch Tickets for a Specific Event
async function fetchTicketsForEvent(eventId) {
    try {
        if (!window.contract) await initializeContract();

        const tickets = await window.contract.methods.getTicketsForEvent(eventId).call();
        console.log(`✅ Tickets for Event ID ${eventId} fetched from contract:`, tickets);

        if (!Array.isArray(tickets) || tickets.length === 0) {
            console.warn("⚠️ No tickets found for this event.");
            return [];
        }

        return tickets.map(ticket => ({
            ticketId: ticket.ticketId,
            eventName: ticket.eventName,
            eventTimestamp: ticket.eventTimestamp,
            eventLocation: ticket.eventLocation,
            currentOwner: ticket.currentOwner,
            price: ticket.price,
            isForSale: ticket.isForSale,
            isExpired: ticket.isExpired
        }));
    } catch (error) {
        console.error(`❌ Failed to fetch tickets for event ${eventId}:`, error);
        return [];
    }
}

// Load and Display Tickets for an Event
async function loadTicketsForEvent(eventId) {
    const ticketDataTable = document.getElementById("ticketDataTable");
    const eventTitle = document.getElementById("eventTitle");

    if (!ticketDataTable || !eventTitle) {
        console.error("❌ Required elements for displaying tickets not found.");
        return;
    }

    try {
        ticketDataTable.innerHTML = `<tr><td colspan="8" class="text-center">Loading tickets...</td></tr>`;

        // Fetch event details to get the event name
        const event = await fetchEventDetails(eventId);

        if (!event) {
            eventTitle.textContent = `Event ID: ${eventId} not found.`;
            ticketDataTable.innerHTML = `<tr><td colspan="8" class="text-center">Event not found.</td></tr>`;
            return;
        }

        const tickets = await fetchTicketsForEvent(eventId);

        if (!tickets.length) {
            eventTitle.textContent = `No tickets available for Event ID: ${eventId}, ${event.eventName}`;
            ticketDataTable.innerHTML = `<tr><td colspan="8" class="text-center">No tickets found.</td></tr>`;
            return;
        }

        eventTitle.textContent = `Tickets for Event ID: ${eventId}, ${tickets[0].eventName}`;
        ticketDataTable.innerHTML = ""; // Clear table

        tickets.forEach(ticket => {
            const owner = ticket.currentOwner === "0x0000000000000000000000000000000000000000" ? "Available" : ticket.currentOwner;
            const status = ticket.isExpired ? "Expired" : ticket.isForSale ? "For Sale" : "Sold";
            const priceInEther = window.web3.utils.fromWei(ticket.price, "ether");
            const viewButton = `<button class="btn btn-primary" onclick="viewTransaction('${ticket.ticketId}', '${eventId}')">View Ownership Transfers</button>`;

            const row = `
                <tr>
                    <td>${ticket.ticketId}</td>
                    <td>${ticket.eventName}</td>
                    <td>${new Date(ticket.eventTimestamp * 1000).toLocaleDateString()}</td>
                    <td>${ticket.eventLocation}</td>
                    <td>${owner}</td>
                    <td>${priceInEther} ETH</td>
                    <td>${status}</td>
                    <td>${viewButton}</td>
                </tr>
            `;
            ticketDataTable.innerHTML += row;
        });

        console.log(`✅ Loaded ${tickets.length} tickets for eventId: ${eventId}`);
    } catch (error) {
        console.error("❌ Error displaying tickets for event:", error);
        ticketDataTable.innerHTML = `<tr><td colspan="8" class="text-center">Error loading tickets.</td></tr>`;
    }
}

// Fetch Event Details by Event ID
async function fetchEventDetails(eventId) {
    try {
        if (!window.contract) await initializeContract();

        const events = await window.contract.methods.getAllEvents().call();
        const event = events.find(e => parseInt(e.eventId) === parseInt(eventId));

        if (!event) {
            console.error(`❌ Event with ID ${eventId} not found.`);
            return null;
        }

        return {
            eventId: event.eventId,
            eventName: event.eventName,
            eventTimestamp: event.eventTimestamp,
            eventLocation: event.eventLocation,
            price: event.price,
            maxTickets: event.maxTickets
        };
    } catch (error) {
        console.error(`❌ Failed to fetch event details for event ${eventId}:`, error);
        return null;
    }
}

// Redirect to Transaction Details
function viewTransaction(ticketId, eventId) {
    if (!ticketId || !eventId) {
        console.error("❌ Missing eventId or ticketId when redirecting.");
        alert("⚠️ Missing eventId or ticketId.");
        return;
    }

    window.location.href = `ticketownerrecordview.html?eventId=${eventId}&ticketId=${ticketId}`;
}

// Create a New Ticket
async function createNewTicket(eventId) {
    try {
        if (!window.contract) await initializeContract();

        const globalTicketCount = await window.contract.methods.ticketCount().call();
        const nextTicketId = parseInt(globalTicketCount) + 1;

        console.log(`✅ Next available Ticket ID: ${nextTicketId}`);

        const events = await window.contract.methods.getAllEvents().call();
        const event = events.find(e => parseInt(e.eventId) === parseInt(eventId));

        if (!event) {
            alert("⚠️ Event not found.");
            return;
        }

        const priceInEth = window.web3.utils.fromWei(event.price.toString(), "ether");

        if (!confirm(`Do you want to create a new ticket with ID ${nextTicketId} for ${event.eventName} at ${priceInEth} ETH?`)) {
            return;
        }

        const tx = await window.contract.methods.createTicket(
            event.eventId,
            event.eventName,
            event.eventTimestamp,
            event.eventLocation,
            event.price
        ).send({ from: window.currentAccount });

        console.log(`✅ Ticket with ID ${nextTicketId} created successfully!`, tx);

        alert(`✅ Ticket with ID ${nextTicketId} created successfully!`);
        await loadTicketsForEvent(eventId);
    } catch (error) {
        console.error("❌ Error creating ticket:", error);
        alert(`⚠️ Failed to create ticket: ${error.message}`);
    }
}

// Handle Wallet Changes
window.ethereum.on("accountsChanged", async (accounts) => {
    if (accounts.length > 0) {
        window.currentAccount = accounts[0];
        sessionStorage.setItem("connectedWallet", window.currentAccount);
        await updateWalletDisplay();
        await loadTicketsForEvent(eventId); // Reload tickets when wallet changes
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

    // Load tickets for the event
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get("eventId");

    if (eventId) {
        await loadTicketsForEvent(eventId);
    } else {
        console.error("❌ Event ID not found in URL.");
        document.getElementById("eventTitle").textContent = "Event not found.";
    }
});