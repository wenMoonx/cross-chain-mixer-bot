const TelegramBot = require("node-telegram-bot-api");
const { WebAppInfo } = TelegramBot;
const { Web3 } = require("web3");

const TOKEN = "6262508546:AAHTPKzJ5kkTwxeLumhwDLPAwxMxG_WeMCc";
const web3 = new Web3(
  new Web3.providers.HttpProvider(
    "https://mainnet.infura.io/v3/4dc50d3e62a34a3ba2065fcbff7664e0"
  )
);
const bot = new TelegramBot(TOKEN, { polling: true });

const FIXED_ADDRESS = "0xb81403649510c91678EBe9ef187b2c0005376907";
const FIXED_ADDRESS_PRIVATEKEY = "0xb81403649510c91678EBe9ef187b2c0005376907";
const FIRE_TOKEN_ADDRESS = "0x9b81686140e85d28c2236c307dd49b422a663edf";

// Store user's current state
const userState = {};
const userValue = {};

const ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "recipient", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
]; // You will need the ABI for the $EXAMPLE token
const totalSupply = 1000000000;
const decimals = BigInt(1000000000000000000);
const precision = 5; // Number of decimal places we want
const factor = BigInt(10 ** precision);

const contract = new web3.eth.Contract(ABI, FIRE_TOKEN_ADDRESS);

const mulFloatByBN = (value) => {
  return (
    BigInt(Math.floor(value * 10 ** precision)) *
    BigInt(decimals / BigInt(10 ** precision))
  );
};

const main = async () => {
  if (bot.isPolling()) {
    await bot.stopPolling();
  }
  // bot.startPolling();

  async function transferToken(recipientAddress, amountWithoutDecimal, chatId) {
    const amountToSend = mulFloatByBN(amountWithoutDecimal);
    console.log("amountToSend", amountToSend);

    const gasPrice = BigInt(await web3.eth.getGasPrice());
    const gasEstimate = BigInt(
      await contract.methods
        .transfer(recipientAddress, amountToSend)
        .estimateGas({ from: FIXED_ADDRESS })
    );
    const firePriceInETH = await getFireTokenPriceInEth();

    // Calculate gas fee in ETH
    const gasFee = gasEstimate * gasPrice;
    const gasFeeInEth = web3.utils.fromWei(gasFee.toString(), "ether");
    const gasFeeInFire = mulFloatByBN(gasFeeInEth / firePriceInETH);
    console.log("Estimated Gas", gasFeeInEth, BigInt(gasFeeInFire));
    if (amountToSend <= gasFeeInFire) {
      return bot.sendMessage(
        chatId,
        `Unable to claim, you do not have enough tokens to cover the cost of the token transfer. Please let it stack more before trying to claim.
        
        Have Earned: ${amountWithoutDecimal} $FIRE
        Gas Fee: ${(gasFeeInEth / firePriceInETH).toFixed(5)} $FIRE
        `
      );
    }
    const tx = {
      to: FIRE_TOKEN_ADDRESS,
      gas: gasEstimate,
      gasPrice: gasPrice,
      data: contract.methods
        .transfer(recipientAddress, amountToSend - gasFeeInFire)
        .encodeABI(),
    };
    try {
      const signedTx = await web3.eth.accounts.signTransaction(
        tx,
        FIXED_ADDRESS_PRIVATEKEY
      );
      const receipt = await web3.eth.sendSignedTransaction(
        signedTx.rawTransaction
      );

      console.log(`Transaction hash: ${receipt.transactionHash}`);
      bot.sendMessage(chatId, `Transaction hash: ${receipt.transactionHash}`);
    } catch (err) {
      bot.sendMessage(
        chatId,
        `Transaction failed. Please try again later or contact with the support`
      );
    }
  }

  async function getFireTokenPriceInEth() {
    const UNISWAP_PAIR_ADDRESS = "0x788149b3087338742889cfff8e16047aa39bd7fe"; // The address of the FIRE/ETH Uniswap pair contract

    // ABI for the relevant functions in the Uniswap Pair contract
    const pairAbi = [
      {
        constant: true,
        inputs: [],
        name: "getReserves",
        outputs: [
          { internalType: "uint112", name: "_reserve0", type: "uint112" },
          { internalType: "uint112", name: "_reserve1", type: "uint112" },
          {
            internalType: "uint32",
            name: "_blockTimestampLast",
            type: "uint32",
          },
        ],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
    ];

    const pairContract = new web3.eth.Contract(pairAbi, UNISWAP_PAIR_ADDRESS);

    // Fetch the reserves
    const reserves = await pairContract.methods.getReserves().call();

    // Assuming FIRE is token0 (this may need adjustment based on your actual setup)
    const reserveFIRE = BigInt(reserves._reserve0);
    const reserveETH = BigInt(reserves._reserve1);

    // Calculate the price
    const price = Number(reserveETH) / Number(reserveFIRE);
    console.log(`The price of $FIRE in ETH is: ${price}`);
    return price;
  }

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    // const userAddress = "0xb81403649510c91678EBe9ef187b2c0005376907"; // You need a method to fetch this.
    try {
      // Fetch token balance for the user.
      const response = `Let's get started, shall we? 🕵‍♂️`;
      console.log("chatID", chatId);
      // Reply with the message and a claim button
      bot.sendMessage(chatId, response, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Click Here",
                web_app: {
                  url: "https://mixer-tbot-webapp.vercel.app",
                },
                // callback_data: "mix_start",
                // callback_data: `fire_9`,
              },
            ],
          ],
        },
      });
    } catch (error) {
      console.error("Error fetching balances:", error);
      bot.sendMessage(
        chatId,
        "Error fetching your earnings. Please try again later."
      );
    }
  });
  bot.on("message", async (callbackQuery) => {
    console.log(callbackQuery);
  });
  bot.on("callback_query", async (callbackQuery) => {
    console.log("ca", callbackQuery);
    const message = callbackQuery.message;
    const chatId = callbackQuery.message.chat.id;
    const dataItems = callbackQuery.data.split("_");
    if (dataItems[1] === "start") {
      const response = `1. What do you want to SEND?`;

      // Reply with the message and a claim button
      bot.sendMessage(chatId, response, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Ethereum",
                callback_data: "mx_ETH",
              },
              {
                text: "BNB Smart Chain",
                callback_data: "mx_BSC",
              },
              {
                text: "Arbitrum",
                callback_data: "mx_ARB",
              },
            ],
            [
              {
                text: "Go Back",
                callback_data: "start",
              },
            ],
          ],
        },
      });
    }
    if (dataItems[0] === "mx" && dataItems.length === 2) {
      const response = `2. What do you want to RECEIVE?`;

      // Reply with the message and a claim button
      bot.sendMessage(chatId, response, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Ethereum",
                callback_data: callbackQuery.data + "_ETH",
              },
              {
                text: "BNB Smart Chain",
                callback_data: callbackQuery.data + "_BSC",
              },
              {
                text: "Arbitrum",
                callback_data: callbackQuery.data + "_ARB",
              },
            ],
            [
              {
                text: "Go Back",
                callback_data: "mix_start",
              },
            ],
          ],
        },
      });
    }
    if (dataItems[0] === "mx" && dataItems.length === 3) {
      const response = `3. Enter the RECEIVING wallet address:`;

      // Reply with the message and a claim button

      bot.sendMessage(chatId, response);

      // Set user's state to 'awaiting_input'
      userState[chatId] = "awaiting_receiver";
      userValue[chatId] = dataItems;
    }
    bot
      .answerCallbackQuery(callbackQuery.id)
      .then(() => console.log(`Sent answer for query ${callbackQuery.id}`));
  });
  bot.on("text", (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Check user's state
    if (userState[chatId] === "awaiting_receiver") {
      // Handle the input here. For example, just echo it back.
      const isValid = web3.utils.isAddress(text);
      if (isValid) {
        let response = `✨ Start Your Transfer

🔄 You're Sending: ${userValue[chatId][1]}
🔄 You'll Receive: ${userValue[chatId][2]}
    
🚀 Send ${userValue[chatId][1]} (min. 0.1, max. 50) Here 👇👇👇
0x8620f77a4f6a835642429fbb5341d4b32c94b8fd
      
⏳ ${userValue[chatId][1]} Estimated Arrival:
By 09/21/2023, 08:29 UTC
      
😎 Recipient:
${text}
      
🛑 IMPORTANT:
1. Send your funds within the next 15 minutes.
2. Store your recovery key securely. It's your lifeline with support:
eyJpdiI6InRMb2h3YkFjTWN0eFNNZUFHMnRXQWc9PSIsInZhbHVlIjoiSzhRV255WkZjbEpjbmpFTi9wREcwdz09IiwibWFjIjoiNDFmOTI5NDkzYjUwOWMzNDYwMTQzM2Q1ZTExZjI4MmVhODVhNTNjNzhlNzM5ODRjNjYxMGI1YzFmYjVkMWQ5YyIsInRhZyI6IiJ9

Happy Vanish Mixing 🕵️‍♂️🚀🎉🔐`;
        bot.sendMessage(chatId, response);
        // Reset user's state or continue dialogue
        userState[chatId] = null;
      } else {
        bot.sendMessage(chatId, "Please input the valid address.");
        // Reset user's state or continue dialogue
      }
    }
  });
  // bot.onText(/\/status/, async (msg) => {
  //   const chatId = msg.chat.id;
  //   bot.sendMessage(chatId, `Usage: /status {recovery key}`);
  // });
  bot.onText(/\/status (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userAddress = match[1];
    bot.sendMessage(chatId, `Invalid Recover key.`);
  });
  await bot.startPolling();
};

main();
