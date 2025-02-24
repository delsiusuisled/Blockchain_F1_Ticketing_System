async function initializeWeb3() {
    if (typeof window.ethereum === "undefined") {
        alert("⚠️ MetaMask is not installed. Please install it.");
        return;
    }

    window.web3 = new Web3(window.ethereum);

    try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        window.currentAccount = accounts[0];
        console.log("✅ Wallet connected:", window.currentAccount);
    } catch (error) {
        console.error("❌ Failed to connect wallet:", error);
    }
}


// ✅ Ensure Web3 is initialized before contract initialization
async function initializeContract() {
    if (typeof window.web3 === "undefined") {
        console.error("❌ Web3 is not initialized. Initializing...");
        await initializeWeb3();
    }

    if (!window.contract) {
        try {
            window.contract = new window.web3.eth.Contract(F1TicketContract.abi, CONTRACT_ADDRESS);
            console.log("🔹 Smart Contract initialized successfully.");
        } catch (error) {
            console.error("❌ Error initializing smart contract:", error);
        }
    }
}


// ✅ Fetch Tickets from Smart Contract for a Specific Event
async function fetchTicketsForEvent(eventId) {
    try {
        if (!window.contract) await initializeContract();

        // ✅ Fetch tickets using the correct eventId
        const tickets = await window.contract.methods.getTicketsForEvent(eventId).call();
        console.log(`✅ Tickets for Event ID ${eventId} fetched from contract:`, tickets);

        if (!Array.isArray(tickets) || tickets.length === 0) {
            console.warn("⚠️ No tickets found for this event.");
            return [];
        }

        return tickets.map(ticket => ({
            ticketId: ticket.ticketId,
            eventName: ticket.eventName,
            eventDate: ticket.eventDate,
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


// ✅ Load and Display Tickets for an Event
async function loadTicketsForEvent(eventId) {
    const ticketDataTable = document.getElementById("ticketDataTable");
    const eventTitle = document.getElementById("eventTitle");

    if (!ticketDataTable || !eventTitle) {
        console.error("❌ Required elements for displaying tickets not found.");
        return;
    }

    try {
        ticketDataTable.innerHTML = `<tr><td colspan="8" class="text-center">Loading tickets...</td></tr>`;

        const tickets = await fetchTicketsForEvent(eventId);

        if (!tickets.length) {
            eventTitle.textContent = `No tickets available for Event ID: ${eventId}`;
            ticketDataTable.innerHTML = `<tr><td colspan="8" class="text-center">No tickets found.</td></tr>`;
            return;
        }

        eventTitle.textContent = `Tickets for ${tickets[0].eventName}`;
        ticketDataTable.innerHTML = ""; // Clear table

        tickets.forEach(ticket => {
            const owner = ticket.currentOwner === "0x0000000000000000000000000000000000000000" ? "Available" : ticket.currentOwner;
            const status = ticket.isExpired ? "Expired" : ticket.isForSale ? "For Sale" : "Sold";
            const priceInEther = window.web3.utils.fromWei(ticket.price, "ether");
            // ✅ Ensure "View" button is always enabled, even if ticket is sold or expired
            const viewButton = `<button class="btn btn-primary" onclick="viewTransaction('${ticket.ticketId}', '${eventId}')">View</button>`;

            const row = `
                <tr>
                    <td>${ticket.ticketId}</td>
                    <td>${ticket.eventName}</td>
                    <td>${ticket.eventDate}</td>
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

// ✅ Ensure Tickets Load on Page Load
document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get("eventId");

    if (eventId) {
        await initializeWeb3();
        await loadTicketsForEvent(eventId);
    } else {
        console.error("❌ Event ID not found in URL.");
        document.getElementById("eventTitle").textContent = "Event not found.";
    }
});

// Redirect to transaction details
function viewTransaction(ticketId, eventId) {
    if (!ticketId || !eventId) {
        console.error("❌ Missing eventId or ticketId when redirecting.");
        alert("⚠️ Missing eventId or ticketId.");
        return;
    }

    window.location.href = `ticketownerrecordview.html?eventId=${eventId}&ticketId=${ticketId}`;
}



// Function to create a new ticket
// Function to create a new ticket
async function createNewTicket(eventId) {
    try {
        // Ensure the contract is initialized
        if (!window.contract) await initializeContract();

        console.log(`🔹 Fetching current ticket count from the smart contract...`);

        // ✅ Fetch the global ticket count from the smart contract
        const globalTicketCount = await window.contract.methods.ticketCount().call();
        const nextTicketId = parseInt(globalTicketCount) + 1; // ✅ Correct next ID

        console.log(`✅ Next available Ticket ID: ${nextTicketId}`);

        // ✅ Fetch event details to use for ticket creation
        const events = await window.contract.methods.getAllEvents().call();
        const event = events.find(e => parseInt(e.eventId) === parseInt(eventId));

        if (!event) {
            alert("⚠️ Event not found.");
            return;
        }

        console.log("🔹 Event Details:", event);

        // ✅ Convert price from Wei to ETH for Display
        const priceInEth = window.web3.utils.fromWei(event.price.toString(), "ether");

        // Confirm creation with the admin
        if (!confirm(`Do you want to create a new ticket with ID ${nextTicketId} for ${event.eventName} at ${priceInEth} ETH?`)) {
            return;
        }

        console.log("🔹 Sending transaction to create ticket...");

        // ✅ Call the smart contract function `createTicket` with ETH value directly
        const tx = await window.contract.methods.createTicket(
            event.eventId,       // ✅ Pass the eventId
            event.eventName,
            event.eventDate,
            event.eventLocation,
            event.price // ✅ Send the price as ETH, NOT Wei
        ).send({ from: window.currentAccount });

        console.log(`✅ Ticket with ID ${nextTicketId} created successfully!`, tx);

        alert(`✅ Ticket with ID ${nextTicketId} created successfully!`);
        await loadTicketsForEvent(eventId); // ✅ Reload the tickets for the correct event
    } catch (error) {
        console.error("❌ Error creating ticket:", error);
        alert(`⚠️ Failed to create ticket: ${error.message}`);
    }
}


function markTicketAsSold(eventId, ticketId) {
    let storedTickets = getPresetTicketsFromStorage();
    let eventTickets = storedTickets.find(ticket => String(ticket.id) === String(eventId));

    if (!eventTickets) {
        console.error(`❌ No tickets found for Event ID ${eventId}`);
        return;
    }

    let ticketIndex = storedTickets.findIndex(ticket => ticket.id === eventId);
    
    if (ticketIndex === -1) {
        console.error(`❌ Ticket ID ${ticketId} not found in Event ID ${eventId}`);
        return;
    }

    storedTickets[ticketIndex].owner = window.currentAccount;
    localStorage.setItem("presetTickets", JSON.stringify(storedTickets));

    console.log(`✅ Ticket ${ticketId} marked as sold for Event ${eventId}`);
}


// Add event listener for the "Create Ticket" button
document.addEventListener("DOMContentLoaded", () => {
    const createTicketButton = document.getElementById("createTicketBtn");
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get("eventId");

    if (createTicketButton && eventId) {
        createTicketButton.addEventListener("click", () => {
            createNewTicket(eventId);
        });
    }
});
