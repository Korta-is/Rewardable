import {
  createThirdwebClient,
  getContract,
  prepareContractCall,
  sendTransaction,
} from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { privateKeyToAccount } from "thirdweb/wallets";
import chalk from 'chalk';
import figlet from 'figlet';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();

// Setup logging
const LOG_DIR = 'logs';
const LOG_FILE = path.join(LOG_DIR, `bot_${new Date().toISOString().split('T')[0]}.log`);

if (!fs.existsSync(LOG_DIR)){
    fs.mkdirSync(LOG_DIR);
}

const logToFile = (message, isError = false) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${isError ? 'ERROR: ' : ''}${message}\n`;
  fs.appendFileSync(LOG_FILE, logMessage);
  console.log(isError ? chalk.hex('#FF5733')(message) : message);
};

const separator = () => {
  const sep = '━'.repeat(50);
  console.log(chalk.hex('#E2E2E2')(sep));
  logToFile(sep);
};

const showBanner = () => {
  const banner = figlet.textSync('REWARD BOT', {
    font: 'Standard',
    horizontalLayout: 'fitted'
  });
  console.log(chalk.hex('#19747E')(banner));
  logToFile(banner);
  separator();
}

const calculateResetTime = () => {
  const now = new Date();
  const target = new Date();
  target.setHours(7, 0, 0, 0);
  
  if (now.getHours() >= 7) {
    target.setDate(target.getDate() + 1);
  }
  
  return target.getTime() - now.getTime();
}

const showTimeInfo = () => {
  const now = new Date();
  const timeLeft = calculateResetTime();
  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  const remainingTime = `${hours}h ${minutes}m ${seconds}s`;

  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(
    chalk.hex('#D1E8E2')(`Current time: ${timeString} WIB | `) +
    chalk.hex('#A9D6E5')(`Next reset in: ${remainingTime}`)
  );

  if (now.getHours() === 7 && now.getMinutes() === 0 && now.getSeconds() === 3) {
    console.log(chalk.hex('#19747E')('\nReset time reached! Restarting bot...'));
    logToFile('Reset time reached! Restarting bot...');
    separator();
    startBot();
  }

  setTimeout(showTimeInfo, 1000);
};

async function checkTransactionStatus(client, hash, maxAttempts = 20) {
  const provider = client.getProvider();
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const receipt = await provider.getTransactionReceipt(hash);
      if (receipt) return receipt;
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    } catch (error) {
      logToFile(`Attempt ${attempts + 1} failed: ${error.message}`, true);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  throw new Error('Transaction confirmation timeout');
}

async function withdrawRewards() {
  try {
    showBanner();

    const client = createThirdwebClient({
      clientId: process.env.CLIENT_ID,
    });

    const account = privateKeyToAccount({
      client,
      privateKey: process.env.PRIVATE_KEY,
    });

    console.log(chalk.hex('#D1E8E2')('Connected as:'), chalk.hex('#19747E')(account.address));
    logToFile(`Connected as: ${account.address}`);
    separator();

    const contract = getContract({
      client,
      chain: defineChain(8453),
      address: process.env.CONTRACT_ADDRESS,
    });

    if (!contract) throw new Error("Failed to connect to contract");

    const _identity = process.env.IDENTITY_ADDRESS;
    const _amount = process.env.WITHDRAWAL_AMOUNT;
    const _data = process.env.TX_DATA;
    const _lzSendParam = {
      destinationChainId: 30184,
      addGas: "0",
      addEther: "0",
      topUp: "0"
    };

    if (!_identity || !_amount) throw new Error("Invalid parameters: identity and amount are required");

    console.log(chalk.hex('#A9D6E5')('Preparing transaction...'));
    logToFile('Preparing transaction...');
    
    const transaction = await prepareContractCall({
      contract,
      method: "function withdrawRewards(address _identity, uint256 _amount, bytes _data, (uint32 destinationChainId, uint128 addGas, uint128 addEther, uint128 topUp) _lzSendParam) payable",
      params: [_identity, _amount, _data, _lzSendParam],
    });

    console.log(chalk.hex('#A9D6E5')('Sending transaction...'));
    logToFile('Sending transaction...');
    
    const { transactionHash } = await sendTransaction({
      transaction,
      account,
    });

    console.log(chalk.hex('#19747E')('Transaction sent!'));
    console.log(chalk.hex('#D1E8E2')('Transaction hash:'), chalk.hex('#A9D6E5')(transactionHash));
    logToFile(`Transaction sent! Hash: ${transactionHash}`);
    separator();

    console.log(chalk.hex('#A9D6E5')('Waiting for confirmation...'));
    logToFile('Waiting for confirmation...');
    
    const receipt = await checkTransactionStatus(client, transactionHash);
    
    if (receipt.status === 1) {
      console.log(chalk.hex('#19747E')('Transaction confirmed successfully!'));
      console.log(chalk.hex('#D1E8E2')('Block number:'), chalk.hex('#A9D6E5')(receipt.blockNumber));
      console.log(chalk.hex('#D1E8E2')('Gas used:'), chalk.hex('#A9D6E5')(receipt.gasUsed.toString()));
      
      logToFile(`Transaction confirmed successfully!\nBlock number: ${receipt.blockNumber}\nGas used: ${receipt.gasUsed.toString()}`);

      if (receipt.logs.length > 0) {
        console.log(chalk.hex('#19747E')('Events emitted:'));
        logToFile('Events emitted:');
        receipt.logs.forEach((log, index) => {
          console.log(chalk.hex('#D1E8E2')(`Event ${index + 1}:`), chalk.hex('#A9D6E5')(log.topics[0]));
          logToFile(`Event ${index + 1}: ${log.topics[0]}`);
        });
      }
    } else {
      throw new Error('Transaction failed');
    }
    
    separator();
    return { success: true, hash: transactionHash, receipt };

  } catch (error) {
    separator();

    const errorTypes = {
      'Daily withdrawal limit exceeded': 'Please wait for the daily reset to withdraw again',
      '4001': 'Transaction rejected by user',
      '-32603': 'Internal JSON-RPC error',
      'insufficient funds': 'Insufficient funds for transaction',
      'nonce': 'Nonce too high. Reset your MetaMask account'
    };

    const errorMessage = Object.entries(errorTypes).find(([key]) => 
      error.message?.includes(key) || error.code?.toString() === key
    )?.[1] || error.message || "Unknown error occurred";

    console.log(chalk.hex('#FF5733')('Error:'), errorMessage);
    logToFile(`Error: ${errorMessage}`, true);
    separator();

    return { success: false, error: errorMessage, details: error };
  }
}

async function startBot() {
  console.clear();
  try {
    const result = await withdrawRewards();
    if (result.success) {
      console.log(chalk.hex('#19747E')('Operation completed successfully'));
      logToFile('Operation completed successfully');
    } else {
      console.log(chalk.hex('#FF5733')('Operation failed:'), result.error);
      logToFile(`Operation failed: ${result.error}`, true);
    }
    separator();
  } catch (error) {
    console.error(chalk.hex('#FF5733')('Unexpected error:'), error);
    logToFile(`Unexpected error: ${error}`, true);
    separator();
  }
}

startBot();
showTimeInfo();
