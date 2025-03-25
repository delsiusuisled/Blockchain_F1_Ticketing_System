let isTicketsLoaded = false;

// ✅ Initialize Web3 (Safe version without auto-connect)
async function initializeWeb3() {
    if (typeof window.ethereum === "undefined") {
        alert("⚠️ MetaMask is not installed.");
        return;
    }

    window.web3 = new Web3(window.ethereum);
    
    try {
        // Check existing connection without prompting
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            window.currentAccount = accounts[0];
            sessionStorage.setItem("connectedWallet", window.currentAccount);
        }
    } catch (error) {
        console.error("❌ Wallet connection check failed:", error);
    }
}

// ✅ Universal Disconnect Handler
function disconnectWallet() {
    console.log("🔹 Disconnecting Wallet...");
    
    // Clear all wallet-related data
    sessionStorage.removeItem("connectedWallet");
    window.currentAccount = null;
    
    // Reset all UI elements
    safeUpdateNavbar(null);
    
    // Page-specific cleanup
    if (window.location.pathname.includes("mytickets.html")) {
        document.getElementById("myTicketsTableBody").innerHTML = "";
        isTicketsLoaded = false;
    }
}

// ✅ Universal Connect Handler
async function connectWallet() {
    try {
        if (typeof window.ethereum === "undefined") {
            alert("⚠️ MetaMask is not installed. Please install it.");
            return;
        }

        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        window.currentAccount = accounts[0];
        sessionStorage.setItem("connectedWallet", window.currentAccount);
        
        // Post-connection actions
        safeUpdateNavbar(window.currentAccount);
        
        if (window.location.pathname.includes("mytickets.html")) {
            await loadMyTickets();
            isTicketsLoaded = true;
        }
        
    } catch (error) {
        console.error("❌ Error connecting wallet:", error);
        alert("Failed to connect wallet. Please try again.");
    }
}

// ✅ Universal Navbar Update
async function safeUpdateNavbar(walletAddress) {
    const walletDisplay = document.getElementById("walletDisplay");
    const navConnectButton = document.getElementById("navConnectWalletButton");
    const staffNavItem = document.getElementById("staffNavItem");

    if (!walletDisplay || !navConnectButton) return;

    if (walletAddress) {
        walletDisplay.textContent = `Connected: ${walletAddress}`;
        walletDisplay.style.display = "block";
        navConnectButton.textContent = "Disconnect Wallet";
        navConnectButton.classList.remove("btn-danger");
        navConnectButton.classList.add("btn-secondary");
        navConnectButton.onclick = disconnectWallet;

        // Role check
        const isAdminOrOrganizer = await isOrganizerOrAdmin(walletAddress);
        if (staffNavItem) staffNavItem.style.display = isAdminOrOrganizer ? "block" : "none";
    } else {
        walletDisplay.textContent = "";
        walletDisplay.style.display = "none";
        navConnectButton.textContent = "Connect Wallet";
        navConnectButton.classList.add("btn-danger");
        navConnectButton.classList.remove("btn-secondary");
        navConnectButton.onclick = connectWallet;
        if (staffNavItem) staffNavItem.style.display = "none";
    }
}