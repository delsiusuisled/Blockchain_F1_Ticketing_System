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

document.getElementById("sellTicketForm").addEventListener("submit", async function (event) {
    event.preventDefault();

    // ✅ Retrieve ticketData again in case it was lost
    const ticketDataJSON = sessionStorage.getItem("ticketToSell");

    if (!ticketDataJSON) {
        alert("⚠️ No ticket data found. Cannot proceed.");
        console.error("❌ sessionStorage does not contain 'ticketToSell'");
        return;
    }

    const ticketData = JSON.parse(ticketDataJSON);
    console.log("✅ Using ticket data:", ticketData);

    if (!ticketData.ticketId) {
        alert("⚠️ Invalid ticket data. Please try again.");
        return;
    }

    if (!window.currentAccount) {
        alert("⚠️ Wallet not connected. Please connect your wallet first.");
        return;
    }

    const newPriceETH = document.getElementById("newPriceETH").value;
    if (!newPriceETH || newPriceETH <= 0) {
        alert("⚠️ Price must be greater than 0 ETH.");
        return;
    }

    try {
        const priceWei = window.web3.utils.toWei(newPriceETH, "ether");

        console.log(`🔹 Listing ticket ${ticketData.ticketId} for ${newPriceETH} ETH...`);

        await window.contract.methods.resellTicket(
            ticketData.ticketId, 
            priceWei
        ).send({ 
            from: window.currentAccount,
            gas: 300000
        });

        alert("✅ Ticket listed successfully!");
        sessionStorage.removeItem("ticketToSell");
        window.location.href = "mytickets.html";
    } catch (error) {
        console.error("❌ Resell failed:", error);
        alert(`⚠️ Resell failed: ${error.message.split("\n")[0]}`);
    }
});

document.addEventListener("DOMContentLoaded", async function () {
    console.log("🔹 Checking sessionStorage for ticket data...");

    // ✅ Initialize Web3 and Contract
    await initializeWeb3();
    await initializeContract();

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

    // ✅ Retrieve ticket data from sessionStorage
    const ticketDataJSON = sessionStorage.getItem("ticketToSell");

    if (!ticketDataJSON) {
        alert("⚠️ No ticket data found. Redirecting...");
        console.error("❌ sessionStorage does not contain 'ticketToSell'");
        window.location.href = "mytickets.html";
        return;
    }

    // ✅ Parse ticket data safely
    let ticketData;
    try {
        ticketData = JSON.parse(ticketDataJSON);
    } catch (error) {
        console.error("❌ Failed to parse ticket data:", error);
        alert("⚠️ Invalid ticket data. Redirecting...");
        window.location.href = "mytickets.html";
        return;
    }

    console.log("✅ Retrieved ticket data:", ticketData);

    // ✅ Ensure the expected properties exist
    if (!ticketData.ticketId || !ticketData.eventName || !ticketData.eventDate || !ticketData.eventLocation || !ticketData.price) {
        alert("⚠️ Incomplete ticket data. Redirecting...");
        console.error("❌ Missing properties in ticketData:", ticketData);
        window.location.href = "mytickets.html";
        return;
    }

    // ✅ Populate form fields with ticket data
    document.getElementById("ticketID").value = ticketData.ticketId;
    document.getElementById("eventName").value = ticketData.eventName;
    document.getElementById("eventDate").value = ticketData.eventDate;
    document.getElementById("eventLocation").value = ticketData.eventLocation;
    document.getElementById("currentPrice").value = ticketData.price;
});
