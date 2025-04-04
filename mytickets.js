// Global Variables
let isWeb3Initialized = false;
let isContractInitialized = false;
let isTicketsLoaded = false;
let isConnecting = false

// ✅ Initialize Web3 and Smart Contract
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

// ✅ Load Tickets Owned by Connected Wallet
async function loadMyTickets() {
    await initializeWeb3();
    await initializeContract();
    const myTicketsTableBody = document.getElementById("myTicketsTableBody");
    myTicketsTableBody.innerHTML = "";

    try {
        const ticketCount = await window.contract.methods.ticketCount().call();
        if (ticketCount == 0) {
            myTicketsTableBody.innerHTML = `<tr><td colspan="6" class="text-center">No tickets available</td></tr>`;
            return;
        }

        let hasOwnedTickets = false;
        const currentTimestamp = Math.floor(Date.now() / 1000);

        for (let i = 1; i <= ticketCount; i++) {
            const ticket = await window.contract.methods.tickets(i).call();
            const owner = ticket.currentOwner.toLowerCase();
            
            if (owner === window.currentAccount.toLowerCase()) {
                hasOwnedTickets = true;
                const priceETH = window.web3.utils.fromWei(ticket.price, "ether");
                const eventTimestamp = Number(ticket.eventTimestamp);
                const isExpired = eventTimestamp < currentTimestamp;

                // Base button template
                let actionButton = '';
                let statusMessage = '';
                
                if (!isExpired) {
                    // Only show sell/unsell if event is not expired
                    actionButton = ticket.isForResale 
                        ? `<button class="btn btn-danger btn-sm" onclick="confirmUnsell(${ticket.ticketId})">Unsell</button>`
                        : `<button class="btn btn-warning btn-sm" onclick="confirmSell(
                            ${ticket.ticketId}, 
                            '${ticket.eventName}', 
                            '${new Date(eventTimestamp * 1000).toLocaleDateString()}', 
                            '${ticket.eventLocation}', 
                            '${priceETH}'
                        )">Sell</button>`;
                } else {
                    statusMessage = `<span class="text-danger">Expired</span>`;
                }

                const viewQRButton = `<button class="btn btn-info btn-sm" onclick="viewQRCode(
                    ${ticket.ticketId}, 
                    '${ticket.eventName}', 
                    '${new Date(eventTimestamp * 1000).toLocaleDateString()}', 
                    '${ticket.eventLocation}', 
                    '${priceETH}'
                )">View QR Code</button>`;

                const row = `
                    <tr>
                        <td>${ticket.ticketId}</td>
                        <td>${ticket.eventName}</td>
                        <td>${new Date(eventTimestamp * 1000).toLocaleDateString()}</td>
                        <td>${ticket.eventLocation}</td>
                        <td>${priceETH} ETH</td>
                        <td>
                            ${viewQRButton}
                            ${statusMessage}
                            ${actionButton}
                        </td>
                    </tr>
                `;

                myTicketsTableBody.innerHTML += row;
            }
        }

        if (!hasOwnedTickets) {
            myTicketsTableBody.innerHTML = `<tr><td colspan="6" class="text-center">You did not purchase any tickets.</td></tr>`;
        }
    } catch (error) {
        console.error("❌ Ticket loading error:", error);
    }
}

// Check if the connected wallet is an Admin or Organizer
async function isOrganizerOrAdmin(walletAddress) {
    if (!window.web3) {
        console.error("❌ Web3 is not initialized. Initializing...");
        await initializeWeb3();
    }
    if (!window.contract) {
        console.error("❌ Contract is not initialized. Initializing...");
        await initializeContract();
    }

    try {
        // Fetch Admin and Organizer status using contract methods
        const isAdmin = await checkIsAdmin(walletAddress);
        const isOrganizer = await checkIsOrganizer(walletAddress);

        console.log(`🔹 Checking Admin/Organizer Role for ${walletAddress}: isAdmin = ${isAdmin}, isOrganizer = ${isOrganizer}`);
        return isAdmin || isOrganizer;
    } catch (error) {
        console.error("❌ Error checking admin/organizer role:", error);
        return false;
    }
}


async function checkIsAdmin(walletAddress) {
    try {
        if (!window.web3) {
            console.error("❌ Web3 is not initialized. Initializing...");
            await initializeWeb3();
        }
        if (!window.contract) {
            console.error("❌ Contract not initialized. Initializing...");
            await initializeContract();
        }

        // Ensure Web3 is available before calling utils
        const ADMIN_ROLE = window.web3.utils.keccak256("ADMIN_ROLE");
        const isAdmin = await window.contract.methods.hasRole(ADMIN_ROLE, walletAddress).call();

        console.log(`🔹 Admin Check for ${walletAddress}: ${isAdmin}`);
        return isAdmin;
    } catch (error) {
        console.error("❌ Error checking Admin status:", error);
        return false;
    }
}

async function checkIsOrganizer(walletAddress) {
    try {
        if (!window.web3) {
            console.error("❌ Web3 is not initialized. Initializing...");
            await initializeWeb3();
        }
        if (!window.contract) {
            console.error("❌ Contract not initialized. Initializing...");
            await initializeContract();
        }

        // Ensure Web3 is available before calling utils
        const ORGANIZER_ROLE = window.web3.utils.keccak256("ORGANIZER_ROLE");
        const isOrganizer = await window.contract.methods.hasRole(ORGANIZER_ROLE, walletAddress).call();

        console.log(`🔹 Organizer Check for ${walletAddress}: ${isOrganizer}`);
        return isOrganizer;
    } catch (error) {
        console.error("❌ Error checking Organizer status:", error);
        return false;
    }
}

// Function to redirect to the QR code view page
function viewQRCode(ticketId, eventName, eventDate, eventLocation, priceETH) {
    // Store ticket details in sessionStorage
    const ticket = {
        ticketId: ticketId,
        eventName: eventName,
        eventDate: eventDate,
        eventLocation: eventLocation,
        price: priceETH
    };
    sessionStorage.setItem("ticketToView", JSON.stringify(ticket));

    // Redirect to the QR code view page
    window.location.href = "viewqr.html";
}

// ✅ Updated Confirm Sell (Trigger Contract Resell) & Function to store ticket details in sessionStorage before redirecting to sell.html
function confirmSell(ticketID, eventName, eventDate, eventLocation, currentPriceETH) {
    if (!ticketID || !eventName || !eventDate || !eventLocation || !currentPriceETH) {
        alert("⚠️ Missing ticket data. Cannot proceed.");
        return;
    }

    // ✅ Store ticket data in sessionStorage
    const ticket = {
        ticketId: ticketID,
        eventName: eventName,
        eventDate: eventDate,
        eventLocation: eventLocation,
        price: currentPriceETH
    };

    sessionStorage.setItem("ticketToSell", JSON.stringify(ticket));

    console.log("🔹 Stored ticket data in sessionStorage:", ticket); // ✅ Debugging log

    // ✅ Redirect only after data is stored
    window.location.href = "sell.html";
}

// ✅ Updated Confirm Unsell (Trigger Contract Cancel)
function confirmUnsell(ticketID) {
    if (!confirm("Remove from marketplace?")) return;
    window.contract.methods.cancelResale(ticketID)
        .send({ from: window.currentAccount })
        .then(() => {
            alert("✅ Removed from marketplace!");
            loadMyTickets();
        })
        .catch(error => {
            console.error("Unsell failed:", error);
            alert("❌ Cancel failed: " + error.message);
        });
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
        await loadMyTickets()

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

// // Function to update Navbar Wallet Display & Staff Nav Item
// async function updateNavbarWalletDisplay(walletAddress) {
//     const walletDisplay = document.getElementById("walletDisplay");
//     const navConnectButton = document.getElementById("navConnectWalletButton");
//     const staffNavItem = document.getElementById("staffNavItem");
//     const connectedIndicator = walletDisplay.querySelector(".connected-indicator");

//     if (!walletDisplay || !navConnectButton || !staffNavItem) {
//         console.error("❌ Navbar elements not found.");
//         return;
//     }

//     if (walletAddress) {
//         walletDisplay.textContent = `Connected: ${walletAddress}`;
//         walletDisplay.style.display = "block";
//         if (connectedIndicator) connectedIndicator.style.display = "block"; // Show the indicator
//         navConnectButton.textContent = "Disconnect Wallet";
//         navConnectButton.classList.remove("btn-danger");
//         navConnectButton.classList.add("btn-secondary");
//         navConnectButton.onclick = disconnectWallet;

//         // Check if the user is an Admin or Organizer
//         const isAdminOrOrganizer = await isOrganizerOrAdmin(walletAddress);
//         staffNavItem.style.display = isAdminOrOrganizer ? "block" : "none"; // Show staff tab if admin/organizer
//     } else {
//         walletDisplay.textContent = "Connected: Not Connected";
//         walletDisplay.style.display = "none";
//         if (connectedIndicator) connectedIndicator.style.display = "none"; // Hide the indicator
//         navConnectButton.textContent = "Connect Wallet";
//         navConnectButton.classList.add("btn-danger");
//         navConnectButton.classList.remove("btn-secondary");
//         navConnectButton.onclick = connectWallet;
//         staffNavItem.style.display = "none"; // Hide staff tab if no wallet connected
//     }
// }

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

// Ensure UI Updates on Page Load
window.addEventListener("load", async () => {
    console.log("🔹 Window fully loaded...");
    await initializeWeb3();
    safeUpdateNavbar()

    const connectedWallet = sessionStorage.getItem("connectedWallet");
    if (connectedWallet) {
        safeUpdateNavbar(connectedWallet);
        if (!isTicketsLoaded) {
            isTicketsLoaded = true;
            await loadMyTickets();
        }
    }
});

// window.onload = async () => {
//     console.log("🔹 Window fully loaded...");
//     await initializeWeb3();
//     await initializeContract();
//     await loadMyTickets();
// };

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