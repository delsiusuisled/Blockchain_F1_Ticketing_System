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

// Enhanced access verification
async function verifyAccess() {
    try {
        console.log("🔹 Starting access verification...");
        
        // Ensure Web3 and contract are initialized
        if (!window.web3) {
            const initialized = await initializeWeb3();
            if (!initialized) {
                throw new Error("Failed to initialize Web3");
            }
        }

        if (!window.contract) {
            await initializeContract();
            if (!window.contract) {
                throw new Error("Failed to initialize contract");
            }
        }

        // Get current account
        const accounts = await window.web3.eth.getAccounts();
        if (!accounts || accounts.length === 0) {
            throw new Error("No connected wallet");
        }
        
        const connectedWallet = accounts[0];
        if (!connectedWallet) {
            throw new Error("Invalid wallet address");
        }

        // Check both admin and organizer roles
        const [isAdmin, isOrganizer] = await Promise.all([
            checkAdminRole(connectedWallet),
            checkOrganizerRole(connectedWallet)
        ]);

        console.log(`🔹 Access check: isAdmin=${isAdmin}, isOrganizer=${isOrganizer}`);

        if (!isAdmin && !isOrganizer) {
            throw new Error("Unauthorized access - neither admin nor organizer");
        }

        console.log("✅ Access granted!");
        await updateWalletDisplay(connectedWallet);
        return true;
    } catch (error) {
        console.error("❌ Access verification failed:", error);
        alert(`Access Denied: ${error.message}`);
        window.location.href = "index.html";
        return false;
    }
}

// Check Admin Role
async function checkAdminRole(walletAddress) {
    try {
        if (!walletAddress || !window.web3.utils.isAddress(walletAddress)) {
            console.error("❌ Invalid wallet address:", walletAddress);
            return false;
        }

        // Check against the constant admin address
        if (walletAddress.toLowerCase() === ADMIN_ACCOUNT.toLowerCase()) {
            return true;
        }

        // Then check against the contract's admin role
        const ADMIN_ROLE = await window.contract.methods.DEFAULT_ADMIN_ROLE().call();
        const hasRole = await window.contract.methods.hasRole(ADMIN_ROLE, walletAddress).call();
        
        console.log(`🔹 Admin check for ${walletAddress}: ${hasRole}`);
        return hasRole;
    } catch (error) {
        console.error("❌ Error checking admin role:", error);
        return false;
    }
}

// Check Organizer Role
async function checkOrganizerRole(walletAddress) {
    try {
        if (!walletAddress || !window.web3.utils.isAddress(walletAddress)) {
            console.error("❌ Invalid wallet address:", walletAddress);
            return false;
        }

        // First try the getOrganizerByAdmin function
        try {
            const organizerAddress = await window.contract.methods.getOrganizerByAdmin(walletAddress).call();
            if (organizerAddress && organizerAddress !== "0x0000000000000000000000000000000000000000") {
                console.log(`🔹 Organizer found via getOrganizerByAdmin: ${organizerAddress}`);
                return true;
            }
        } catch (e) {
            console.log("ℹ️ getOrganizerByAdmin check failed, trying hasRole...");
        }

        // Then check against the contract's organizer role
        const ORGANIZER_ROLE = await window.contract.methods.ORGANIZER_ROLE().call();
        const hasRole = await window.contract.methods.hasRole(ORGANIZER_ROLE, walletAddress).call();
        
        console.log(`🔹 Organizer role check for ${walletAddress}: ${hasRole}`);
        return hasRole;
    } catch (error) {
        console.error("❌ Error checking organizer role:", error);
        return false;
    }
}

// Improved loadOwnershipRecords with access control
async function loadOwnershipRecords() {
    const ownerRecordTable = document.getElementById("ownerRecordTable");
    if (!ownerRecordTable) {
        console.error("❌ Owner record table not found.");
        return;
    }

    try {
        // Get eventId and ticketId from URL
        const urlParams = new URLSearchParams(window.location.search);
        const eventId = urlParams.get("eventId");
        const ticketId = urlParams.get("ticketId");

        if (!eventId || !ticketId) {
            alert("⚠️ Missing eventId or ticketId in URL.");
            return;
        }

        // Verify access again before loading sensitive data
        const accessGranted = await verifyAccess();
        if (!accessGranted) return;

        // Fetch ticket details from blockchain
        const ticket = await window.contract.methods.tickets(ticketId).call();
        const resaleHistory = await window.contract.methods.getResaleHistory(ticketId).call();

        // Clear existing table content
        ownerRecordTable.innerHTML = "";

        // Handle case where there is only one record (i.e., no resale)
        if (resaleHistory.length === 1) {
            const currentOwner = resaleHistory[0];
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${ticketId}</td>
                <td>${ticket.eventName}</td>
                <td>${new Date(ticket.eventTimestamp * 1000).toLocaleDateString()}</td>
                <td>${ticket.eventLocation}</td>
                <td>N/A</td>
                <td>${currentOwner}</td>
            `;
            ownerRecordTable.appendChild(row);
            console.log(`✅ Displayed 1 transfer (initial ownership) for ticket ${ticketId}`);
            return;
        }

        // Handle no resale history case
        if (resaleHistory.length < 2) {
            ownerRecordTable.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        No ownership transfer records available for this ticket.
                    </td>
                </tr>
            `;
            return;
        }

        // Display all ownership transfers
        for (let i = 0; i < resaleHistory.length - 1; i++) {
            const previousOwner = resaleHistory[i];
            const currentOwner = resaleHistory[i + 1];

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${ticketId}</td>
                <td>${ticket.eventName}</td>
                <td>${new Date(ticket.eventTimestamp * 1000).toLocaleDateString()}</td>
                <td>${ticket.eventLocation}</td>
                <td>${previousOwner}</td>
                <td>${currentOwner}</td>
            `;
            ownerRecordTable.appendChild(row);
        }

        console.log(`✅ Displayed ${resaleHistory.length - 1} transfers for ticket ${ticketId}`);

    } catch (error) {
        console.error("❌ Error loading ownership records:", error);
        ownerRecordTable.innerHTML = ` 
            <tr>
                <td colspan="6" class="text-center">
                    Error: Unable to retrieve ownership record. This ticket may not have an owner during its lifetime. Please try again later.
                </td>
            </tr>
        `;
    }
}


// Handle Wallet Changes
window.ethereum.on("accountsChanged", async (accounts) => {
    if (accounts.length > 0) {
        window.currentAccount = accounts[0];
        sessionStorage.setItem("connectedWallet", window.currentAccount);
        await verifyAccess();
        await updateWalletDisplay();
        await loadOwnershipRecords(); // Reload ownership records when wallet changes
    } else {
        window.currentAccount = null;
        sessionStorage.removeItem("connectedWallet");
        await verifyAccess();
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

    // Verify access before proceeding
    const accessGranted = await verifyAccess();
    if (!accessGranted) return;

    // Update wallet display
    await updateWalletDisplay();

    // Load ownership records
    await loadOwnershipRecords();
});