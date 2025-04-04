let isWeb3Initialized = false;
let isContractInitialized = false;
let isConnecting = false

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

// ✅ Load Marketplace Tickets from Contract (Updated)
// ✅ Load Marketplace Tickets from Contract (Updated)
async function loadMarketplaceTickets() {
    console.log("🔍 Fetching resale tickets...");
    const ticketsForSale = await window.contract.methods.getResaleTickets().call();
    console.log("📢 Tickets for sale:", ticketsForSale);

    const marketplaceTableBody = document.getElementById("marketplaceTableBody");
    marketplaceTableBody.innerHTML = "Loading...";

    try {
        if (!window.contract) {
            console.error("❌ Contract not initialized.");
            marketplaceTableBody.innerHTML = `<tr><td colspan="7" class="text-center">Marketplace not available</td></tr>`;
            return;
        }

        marketplaceTableBody.innerHTML = "";

        if (ticketsForSale.length === 0) {
            marketplaceTableBody.innerHTML = `<tr><td colspan="7" class="text-center">No tickets for sale yet!</td></tr>`;
            return;
        }

        ticketsForSale.forEach(ticket => {
            // Ensure eventTimestamp is properly handled as a UNIX timestamp (seconds)
            const eventDate = new Date(Number(ticket.eventTimestamp) * 1000).toLocaleDateString(); // Convert to milliseconds

            // Convert BigInt to string before passing to fromWei
            const priceETH = window.web3.utils.fromWei(ticket.price.toString(), "ether");  // Convert BigInt to string

            const row = `
                <tr>
                    <td>${ticket.ticketId}</td>
                    <td>${ticket.eventName}</td>
                    <td>${eventDate}</td>
                    <td>${ticket.eventLocation}</td>
                    <td>${ticket.currentOwner}</td>
                    <td>${priceETH} ETH</td>
                    <td>
                        <button class="btn btn-primary btn-sm buyButton" 
                                data-ticket-id="${ticket.ticketId}"
                                data-price="${ticket.price}"
                                data-owner="${ticket.currentOwner}">
                            Buy
                        </button>
                    </td>
                </tr>`;
            marketplaceTableBody.innerHTML += row;
        });

        attachBuyButtonListeners();
    } catch (error) {
        console.error("❌ Marketplace error:", error);
        marketplaceTableBody.innerHTML = `<tr><td colspan="7" class="text-center">Error loading tickets</td></tr>`;
    }
}

async function buyTicket(ticketID, price, ownerAddress) {
    try {
        if (!window.contract) {
            console.error("❌ Contract is not initialized.");
            alert("⚠️ Contract not ready. Try again.");
            return;
        }

        // Get current account
        const currentAccount = window.currentAccount || sessionStorage.getItem("connectedWallet");
        
        // Check if buyer is the seller
        if (currentAccount.toLowerCase() === ownerAddress.toLowerCase()) {
            alert("⚠️ You can't buy your own ticket! Perhaps you can unsell it at My Tickets page?");
            window.location.href = "mytickets.html"; // Redirect to My Tickets page
            return;
        }

        // Rest of your existing buyTicket logic
        const ticket = await window.contract.methods.tickets(ticketID).call();
        if (!ticket.isForResale) {
            alert("⚠️ Ticket is no longer available.");
            return;
        }

        const confirmation = confirm(`Buy ticket ${ticketID} for ${window.web3.utils.fromWei(price, 'ether')} ETH?`);
        if (!confirmation) return;

        await window.contract.methods.purchaseResaleTicket(ticketID)
            .send({ 
                from: currentAccount,
                value: price,
                gas: 300000 
            });

        alert("✅ Purchase successful!");
        loadMarketplaceTickets();
    } catch (error) {
        console.error("❌ Purchase failed:", error);
        alert("⚠️ Purchase failed: " + error.message);
    }
}

function attachBuyButtonListeners() {
    const buyButtons = document.querySelectorAll(".buyButton");
    buyButtons.forEach((button) => {
        button.addEventListener("click", async (event) => {
            const ticketId = event.target.getAttribute("data-ticket-id");
            const price = event.target.getAttribute("data-price");
            const ownerAddress = event.target.getAttribute("data-owner");
            await buyTicket(ticketId, price, ownerAddress);
        });
    });
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
    await loadMarketplaceTickets();
};
