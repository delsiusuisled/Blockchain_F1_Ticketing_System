// Add initialization functions if not already present
async function initializeWeb3() {
    if (typeof window.ethereum === "undefined") {
        alert("⚠️ MetaMask is not installed. Please install it.");
        return;
    }

    window.web3 = new Web3(window.ethereum);

    try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        if (accounts.length === 0) {
            throw new Error("No accounts found. Please connect MetaMask.");
        }
        
        window.currentAccount = accounts[0]; // ✅ Store the wallet address globally
        console.log("✅ Wallet connected:", window.currentAccount);
    } catch (error) {
        console.error("❌ Wallet connection failed:", error);
    }
}


async function initializeContract() {
    if (!window.web3) await initializeWeb3();

    if (!window.contract) {
        window.contract = new window.web3.eth.Contract(F1TicketContract.abi, CONTRACT_ADDRESS);
        console.log("🔹 Contract initialized.");
    }
}


document.addEventListener("DOMContentLoaded", async function () {
    console.log("🔹 Checking sessionStorage for ticket data...");

    // ✅ Initialize Web3 and Contract
    await initializeWeb3();
    await initializeContract();

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
