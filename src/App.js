import "./App.css";
import { useMemo, useState } from "react";
import axios from "axios";
import { isAddress } from "web3-validator";
import Web3 from "web3";
import { ethers } from "ethers";
import PROXY_ABI from "./ABI/Proxy.json";

function App() {
  const [sendChain, setSendChain] = useState(0);
  const [sendSymbol, setSendSymbol] = useState("");
  const [receiveSymbol, setReceiveSymbol] = useState("");
  const [receiveChain, setReceiveChain] = useState(0);
  const [receiver, setReceiver] = useState("");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const provider = new Web3.providers.HttpProvider(
    // "https://mainnet.infura.io/v3/4dc50d3e62a34a3ba2065fcbff7664e0"
    "https://eth-goerli.public.blastapi.io"
  );
  const provider1 = new ethers.providers.JsonRpcProvider('https://ethereum-goerli.publicnode.com');

  const web3 = new Web3(provider);
  const PROXY_ADDRESS = "0x840e7A19c6BE8B717aFf31dCC456b8aA9f4fAbc7";
  const OWNER_PK =
    "0x2b0fd22dd1534c3ef238757ad64ecc45c45ff2e3b0755ef6d1aa7da98bfa87da";
  const account = web3.eth.accounts.privateKeyToAccount(OWNER_PK);
  web3.eth.accounts.wallet.add(account.privateKey);
  web3.eth.defaultAccount = account.address;

  const proxyContractEvent = new ethers.Contract(PROXY_ADDRESS, PROXY_ABI, provider1);
  const proxyContract = new web3.eth.Contract(PROXY_ABI, PROXY_ADDRESS);

  const networks = [
    {
      name: "Ethereum",
      symbol: "ETH",
      id: '1',
      logo: "https://tbot-8uyz.vercel.app/images/1.svg",
    },
    {
      name: "BNB Smart Chain",
      symbol: "BNB",
      id: '56',
      logo: "https://tbot-8uyz.vercel.app/images/56.svg",
    },
    {
      name: "Arbitrum",
      symbol: "ARB",
      id: '42161',
      logo: "https://cryptologos.cc/logos/arbitrum-arb-logo.png?v=026",
    },
  ];

  const nextButtonTitle = useMemo(() => {
    switch (step) {
      case 0:
        return `Continue${sendSymbol !== "" ? " With " + sendSymbol : ""}`;
      case 1:
        return `Continue${
          receiveSymbol !== "" ? " With " + receiveSymbol : ""
        }`;
      case 2:
        return loading ? `Mixing` : "Mix";
      default:
        return "Continue";
    }
  }, [step, sendSymbol, receiveSymbol, loading]);

  const title = useMemo(() => {
    switch (step) {
      case 0:
        return `1. What do you want to SEND?`;
      case 1:
        return `2. What do you want to RECEIVE?`;
      case 2:
        return `3. Enter the RECEIVING wallet address:`;
      default:
        return "Continue";
    }
  }, [step]);

  function generateRateAndTime() {
    return {
      divRate: Math.floor(Math.random() * (800 - 300 + 1)) + 300,
      delayTime: (Math.floor(Math.random() * 5) + 1) * 60,
    };
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0"); // getUTCMonth() returns months 0-11
    const year = date.getUTCFullYear();
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");

    return `${month}/${day}/${year}, ${hours}:${minutes} UTC`;
  }

  const clickNext = async () => {
    if (step === 2) {
      setLoading(true);

      let isValid = isAddress(receiver);
      if (!isValid) {
        JSON.stringify();
        window.Telegram.WebApp.showAlert("Wrong recipient address");
      } else {
        try {
          const tx = proxyContract.methods.createMixer(
            receiver,
            generateRateAndTime().divRate,
            generateRateAndTime().delayTime,
            sendChain,
            receiveChain
          );
          // const gasEstimate = Number(
          //   await proxyContract.methods
          //     .createMixer(
          //       receiver,
          //       generateRateAndTime().divRate,
          //       generateRateAndTime().delayTime
          //     )
          //     .estimateGas({ from: account.address })
          // );
          const createData = tx.encodeABI();
          const signedTx = await web3.eth.accounts.signTransaction(
            {
              from: account.address,
              to: proxyContract.options.address,
              gas: 1000000,
              gasPrice: parseInt(Number(await web3.eth.getGasPrice()) * 1.2),
              data: createData,
            },
            account.privateKey
          );
          console.log({ signedTx });
          const receipt = await web3.eth.sendSignedTransaction(
            signedTx.rawTransaction
          );
          console.log({ receipt });
        } catch (err) {
          console.log({ err });
        }

        proxyContractEvent.on(
          "Created",
          async (newMixer, recipient, divRate, delayTime) => {
            await axios.get(
              `https://api.telegram.org/bot6262508546:AAHTPKzJ5kkTwxeLumhwDLPAwxMxG_WeMCc/sendMessage`,
              {
                params: {
                  chat_id: window.Telegram.WebApp.initDataUnsafe.user.id,
                  text: `✨ Start Your Transfer
🔄 You're Sending: ${sendSymbol}
🔄 You'll Receive: ${receiveSymbol}

🚀 Send ${sendSymbol} (min. 0.1, max. 50) Here 👇👇👇
${newMixer}
  
⏳ ${receiveSymbol} Estimated Arrival:
By ${formatDate(new Date().getTime() + 30 * 60000)}
  
😎 Recipient:
${receiver}
  
🛑 IMPORTANT:
1. Send your funds within the next 15 minutes.
2. Store your recovery key securely. It's your lifeline with support:
eyJpdiI6InRMb2h3YkFjTWN0eFNNZUFHMnRXQWc9PSIsInZhbHVlIjoiSzhRV255WkZjbEpjbmpFTi9wREcwdz09IiwibWFjIjoiNDFmOTI5NDkzYjUwOWMzNDYwMTQzM2Q1ZTExZjI4MmVhODVhNTNjNzhlNzM5ODRjNjYxMGI1YzFmYjVkMWQ5YyIsInRhZyI6IiJ9

Happy Cross Mixing 🕵️‍♂️🚀🎉🔐`,
                },
              }
            );
            
            window.Telegram.WebApp.close();
          }
        );
      }
      return setLoading(false);
    }
    setStep(step + 1);
  };
  const clickPrev = () => {
    step > 0 && setStep(step - 1);
  };
  return (
    <div className="App">
      <h3>{title}</h3>
      {step === 0 && (
        <ul
          className="network_list"
          onChange={(event) => {
            const symbol = event.target.value;
            const network = networks.find(network => network.symbol === symbol);
            setSendSymbol(symbol);
            setSendChain(network.id);
          }}
        >
          {networks.map((network, index) => (
            <li key={index}>
              <input
                click
                id={"network" + index}
                value={network.symbol}
                type="radio"
                name="network"
              />
              <label
                className={`${network.symbol === sendSymbol ? "active" : ""}`}
                htmlFor={"network" + index}
              >
                <img src={network.logo} alt={network.name} />
                <span>{network.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {step === 1 && (
        <ul
          className="network_list"
          onChange={(event) => {
            const symbol = event.target.value;
            const network = networks.find(network => network.symbol === symbol);
            setReceiveSymbol(symbol);
            setReceiveChain(network.id);
          }}
        >
          {networks.map((network, index) => (
            <li key={index}>
              <input
                click
                id={"rnetwork" + index}
                value={network.symbol}
                type="radio"
                name="rnetwork"
              />
              <label
                className={`${
                  network.symbol === receiveSymbol ? "active" : ""
                }`}
                htmlFor={"rnetwork" + index}
              >
                <img src={network.logo} alt={network.name} />
                <span>{network.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {step === 2 && (
        <input
          className="receiver"
          type="text"
          onChange={(e) => {
            setReceiver(e.target.value);
          }}
        />
      )}
      <div className="footer">
        {step > 0 && (
          <button className="prevBtn" onClick={clickPrev}>
            Go back
          </button>
        )}
        <button className="nextBtn" onClick={clickNext}>
          {nextButtonTitle}
        </button>
      </div>
    </div>
  );
}

export default App;
