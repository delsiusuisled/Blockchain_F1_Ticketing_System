// Global Variables
let isWeb3Initialized = false;
let isContractInitialized = false;
let isTicketsLoaded = false;
let isConnecting = false;

let allTickets = [];
let filteredTickets = [];

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

// Add at the top of your mytickets.js
function escapeSingleQuotes(str) {
    return str.replace(/'/g, "\\'");
}

// ✅ Load Tickets Owned by Connected Wallet
async function loadMyTickets() {
    await initializeWeb3();
    await initializeContract();
    const myTicketsTableBody = document.getElementById("myTicketsTableBody");
    myTicketsTableBody.innerHTML = `<tr><td colspan="6" class="text-center">Loading tickets...</td></tr>`;

    try {
        const ticketCount = await window.contract.methods.ticketCount().call();
        allTickets = [];
        filteredTickets = [];

        if (ticketCount == 0) {
            myTicketsTableBody.innerHTML = `<tr><td colspan="6" class="text-center">No tickets available</td></tr>`;
            return;
        }

        const currentTimestamp = Math.floor(Date.now() / 1000);
        
        // Fetch all tickets
        for (let i = 1; i <= ticketCount; i++) {
            const ticket = await window.contract.methods.tickets(i).call();
            if (ticket.currentOwner.toLowerCase() === window.currentAccount.toLowerCase()) {
                allTickets.push({
                    ...ticket,
                    eventTimestamp: Number(ticket.eventTimestamp),
                    isExpired: Number(ticket.eventTimestamp) < currentTimestamp
                });
            }
        }

        if (allTickets.length === 0) {
            myTicketsTableBody.innerHTML = `<tr><td colspan="6" class="text-center">You did not purchase any tickets.</td></tr>`;
            return;
        }

        // Initialize filters and pagination
        filteredTickets = [...allTickets];
        populateYearFilter();
        setupEventListeners();
        updatePagination();
        renderTickets(filteredTickets);

    } catch (error) {
        console.error("❌ Ticket loading error:", error);
        myTicketsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading tickets</td></tr>`;
    }
}

function filterTickets(searchTerm = '', selectedYear = 'all') {
    return allTickets.filter(ticket => {
        const matchesSearch = ticket.eventName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            ticket.eventLocation.toLowerCase().includes(searchTerm.toLowerCase());
        
        const eventYear = new Date(ticket.eventTimestamp * 1000).getFullYear();
        const matchesYear = selectedYear === 'all' || eventYear.toString() === selectedYear;
        
        return matchesSearch && matchesYear;
    });
}

function populateYearFilter() {
    const yearSelect = document.getElementById('yearFilter');
    const years = new Set();
    
    // Always include 2024 and current year
    const currentYear = new Date().getFullYear();
    years.add(2024);
    if (currentYear > 2024) years.add(currentYear);

    // Add years from tickets
    allTickets.forEach(ticket => {
        const eventYear = new Date(ticket.eventTimestamp * 1000).getFullYear();
        if (eventYear >= 2024) years.add(eventYear);
    });

    // Build options
    yearSelect.innerHTML = '<option value="all">All Years</option>';
    Array.from(years)
        .sort((a, b) => a - b)
        .forEach(year => {
            yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
        });
}

function setupEventListeners() {
    // Search input
    document.getElementById('ticketSearch').addEventListener('input', (e) => {
        const searchTerm = e.target.value;
        const selectedYear = document.getElementById('yearFilter').value;
        filteredTickets = filterTickets(searchTerm, selectedYear);
        currentPage = 1;
        updatePagination();
        renderTickets(filteredTickets);
    });

    // Year filter
    document.getElementById('yearFilter').addEventListener('change', (e) => {
        const searchTerm = document.getElementById('ticketSearch').value;
        const selectedYear = e.target.value;
        filteredTickets = filterTickets(searchTerm, selectedYear);
        currentPage = 1;
        updatePagination();
        renderTickets(filteredTickets);
    });

    // Pagination controls
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            updatePagination();
            renderTickets(filteredTickets);
        }
    });

    document.getElementById('nextPage').addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            updatePagination();
            renderTickets(filteredTickets);
        }
    });
}

function updatePagination() {
    totalPages = Math.ceil(filteredTickets.length / eventsPerPage);
    const pageStatus = document.getElementById('pageStatus');
    pageStatus.textContent = `Page ${currentPage} of ${totalPages}`;
    
    // Disable/enable pagination buttons
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}

function renderTickets(ticketsToRender) {
    const ticketTableBody = document.getElementById("myTicketsTableBody");
    if (!ticketTableBody) return;

    ticketTableBody.innerHTML = ""; // Clear existing content

    const start = (currentPage - 1) * eventsPerPage;
    const end = start + eventsPerPage;
    const paginatedTickets = ticketsToRender.slice(start, end);

    if (paginatedTickets.length === 0) {
        ticketTableBody.innerHTML = `<tr><td colspan="6" class="text-center">No tickets found matching your criteria</td></tr>`;
        return;
    }

    paginatedTickets.forEach(ticket => {
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const eventTimestamp = Number(ticket.eventTimestamp);
        const isExpired = eventTimestamp < currentTimestamp;
        const priceETH = window.web3.utils.fromWei(ticket.price, "ether");
        
        // Generate action buttons
        let actionButton = '';
        let statusMessage = '';

        if (!isExpired) {
            actionButton = ticket.isForResale
                ? `<button class="btn btn-danger btn-sm" onclick="confirmUnsell(${ticket.ticketId})">Unsell</button>`
                : `<button class="btn btn-warning btn-sm" onclick="confirmSell(
                    ${ticket.ticketId}, 
                    '${ticket.eventName.replace(/'/g, "\\'")}', 
                    '${new Date(eventTimestamp * 1000).toLocaleDateString().replace(/'/g, "\\'")}', 
                    '${ticket.eventLocation.replace(/'/g, "\\'")}', 
                    '${priceETH}'
                )">Sell</button>`;
        } else {
            statusMessage = `<span class="text-danger">Expired</span>`;
        }

        const viewPDFButton = `<button class="btn btn-info btn-sm" onclick="viewPDF(
            ${ticket.ticketId}, 
            '${ticket.eventName.replace(/'/g, "\\'")}', 
            '${new Date(eventTimestamp * 1000).toLocaleDateString().replace(/'/g, "\\'")}', 
            '${ticket.eventLocation.replace(/'/g, "\\'")}', 
            '${priceETH}',
            '${ticket.qrCodeHash.replace(/'/g, "\\'")}'
        )">View PDF</button>`;

        const downloadPDFButton = `<button class="btn btn-success btn-sm" onclick="downloadPDF(
            ${ticket.ticketId}, 
            '${ticket.eventName.replace(/'/g, "\\'")}', 
            '${new Date(eventTimestamp * 1000).toLocaleDateString().replace(/'/g, "\\'")}', 
            '${ticket.eventLocation.replace(/'/g, "\\'")}', 
            '${priceETH}',
            '${ticket.qrCodeHash.replace(/'/g, "\\'")}'
        )">Download PDF</button>`;

        const viewQRButton = `<button class="btn btn-info btn-sm" onclick="viewQRCode(
            ${ticket.ticketId}, 
            '${ticket.eventName.replace(/'/g, "\\'")}', 
            '${new Date(eventTimestamp * 1000).toLocaleDateString().replace(/'/g, "\\'")}', 
            '${ticket.eventLocation.replace(/'/g, "\\'")}', 
            '${priceETH}'
        )">View QR</button>`;

        const row = `
            <tr>
                <td>${ticket.ticketId}</td>
                <td>${ticket.eventName}</td>
                <td>${new Date(eventTimestamp * 1000).toLocaleDateString()}</td>
                <td>${ticket.eventLocation}</td>
                <td>${priceETH} ETH</td>
                <td>
                    ${viewPDFButton}
                    ${downloadPDFButton}
                    ${viewQRButton}
                    ${statusMessage}
                    ${actionButton}
                </td>
            </tr>
        `;
        ticketTableBody.innerHTML += row;
    });
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

async function createPDF(ticketId, eventName, eventDate, eventLocation, priceETH, qrCodeHash) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Add F1 Logo
        const logoUrl = 'f1-logo.png';
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        await new Promise((resolve, reject) => {
            img.onload = () => {
                doc.addImage(img, 'PNG', 10, 10, 30, 15);
                resolve();
            };
            img.onerror = reject;
            img.src = logoUrl;
        });

        // Ticket Details
        doc.setFontSize(18);
        doc.text("F1 Paddock Club Official Ticket", 50, 20);
        
        // Event Details
        doc.setFontSize(12);
        doc.text(`Ticket ID: #${ticketId}`, 10, 40);
        doc.text(`Event: ${eventName}`, 15, 55);
        doc.text(`Date: ${eventDate}`, 15, 62);
        doc.text(`Location: ${eventLocation}`, 15, 69);
        doc.text(`Price: ${priceETH} ETH`, 150, 55);

        // Generate QR Code
        const verificationURL = `${window.location.origin}/ticket-verification.html?id=${ticketId}&hash=${encodeURIComponent(qrCodeHash)}`;
        const qrDataURL = await QRCode.toDataURL(verificationURL, { width: 150 });
        doc.addImage(qrDataURL, 'PNG', 60, 80, 90, 90);

        // Footer
        doc.setFontSize(8);
        doc.text("© 2025 Formula One World Championship Limited", 10, 185);

        return doc;
    } catch (error) {
        console.error('PDF creation failed:', error);
        throw error;
    }
}

// async function createPDF(ticketId, eventName, eventDate, eventLocation, priceETH, qrCodeHash) {
//     try {
//         const { jsPDF } = window.jspdf;
//         const doc = new jsPDF();
        
//         // Add F1 Logo
//         const logoUrl = 'f1-logo.png';
//         const img = new Image();
//         img.crossOrigin = 'Anonymous';
        
//         await new Promise((resolve, reject) => {
//             img.onload = () => {
//                 doc.addImage(img, 'PNG', 10, 10, 30, 15);
//                 resolve();
//             };
//             img.onerror = reject;
//             img.src = logoUrl;
//         });

//         // Ticket Details
//         doc.setFontSize(18);
//         doc.setTextColor(40, 40, 40);
//         doc.text("F1 Paddock Club Official Ticket", 50, 20);
        
//         doc.setFontSize(12);
//         doc.setTextColor(100, 100, 100);
//         doc.text(`Ticket ID: #${ticketId}`, 10, 40);
        
//         // Event Details Box
//         doc.setFillColor(245, 245, 245);
//         doc.rect(10, 45, 190, 35, 'F');
//         doc.setFontSize(14);
//         doc.setTextColor(200, 0, 0);
//         doc.text(eventName, 15, 55);
//         doc.setFontSize(12);
//         doc.setTextColor(0, 0, 0);
//         doc.text(`Date: ${eventDate}`, 15, 62);
//         doc.text(`Location: ${eventLocation}`, 15, 69);

//         // Price and Issued To
//         doc.setFontSize(12);
//         doc.text(`Price: ${priceETH} ETH`, 150, 55);
//         const issuedTo = window.currentAccount;
//         const formattedIssuedTo = issuedTo.match(/.{1,12}/g) || [];
//         doc.text(`Issued To: ${formattedIssuedTo[0]}`, 150, 62);
//         if (formattedIssuedTo[1]) {
//             doc.text(`            ${formattedIssuedTo[1]}`, 150, 68);
//         }
        
//         // Create hidden QR container
//         const qrContainer = document.createElement('div');
//         qrContainer.style.cssText = `
//             position: fixed;
//             top: -1000px;
//             left: -1000px;
//             opacity: 0;
//             pointer-events: none;
//             height: 150px; 
//             width: 150px;
//         `;
//         document.body.appendChild(qrContainer);

//         // Generate QR code directly without DOM
//         const verificationURL = `${window.location.origin}/ticket-verification.html?id=${ticketId}&hash=${encodeURIComponent(qrCodeHash)}`;
//         const qrSvg = qr.imageSync(verificationURL, { type: 'png' });
//         const qrDataURL = `data:image/png;base64,${btoa(qrSvg)}`;
        
//         doc.addImage(qrDataURL, 'PNG', 60, 80, 90, 90);
            


//          // Terms and Conditions
//          doc.setFontSize(8);
//          doc.setTextColor(100, 100, 100);
//          doc.text("This ticket is non-transferable without prior authorization.", 10, 180);
//          doc.text("© 2025 Formula One World Championship Limited", 10, 185);
 
//          // PDF Metadata
//          doc.setProperties({
//              creator: 'F1 Paddock Club',
//              producer: 'F1 Paddock Club',
//              creationDate: new Date(),
//              title: `Ticket #${ticketId}`,
//          });
 

//         console.log('PDF creation completed');
//         return doc;
//     } catch (error) {
//         console.error('PDF creation failed:', error);
//         alert(`PDF Error: ${error.message}`);
//         throw error;
//     }
// }

async function viewPDF(ticketId, eventName, eventDate, eventLocation, priceETH, qrCodeHash) {
    try {
        console.log('Attempting to view PDF...');
        const doc = await createPDF(ticketId, eventName, eventDate, eventLocation, priceETH, qrCodeHash);
        
        console.log('Generating PDF blob...');
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        console.log('Opening PDF window...');
        const newWindow = window.open(pdfUrl, '_blank');
        
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            console.warn('Popup blocked');
            alert('Popups blocked! Please allow popups for this site.');
            URL.revokeObjectURL(pdfUrl);
        } else {
            console.log('PDF window opened');
            newWindow.onload = () => {
                URL.revokeObjectURL(pdfUrl);
                console.log('PDF loaded successfully');
            };
        }
    } catch (error) {
        console.error('PDF viewing failed:', error);
        alert(`PDF Error: ${error.message}`);
    }
}

async function downloadPDF(ticketId, eventName, eventDate, eventLocation, priceETH, qrCodeHash) {
    const doc = await createPDF(ticketId, eventName, eventDate, eventLocation, priceETH, qrCodeHash);
    doc.save(`F1-Ticket-${ticketId}.pdf`);
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