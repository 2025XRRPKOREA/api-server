const { Client, Wallet, isValidClassicAddress } = require('xrpl');
const crypto = require('crypto');

class WalletService {
  constructor() {
    this.client = null;
  }

  /**
   * Initialize XRPL client connection
   * @param {string} server - XRPL server URL
   */
  async initializeClient(server = 'wss://s.devnet.rippletest.net:51233') {
    try {
      if (!this.client || !this.client.isConnected()) {
        this.client = new Client(server);
        await this.client.connect();
        console.log('Connected to XRPL server:', server);
      }
      return this.client;
    } catch (error) {
      console.error('Failed to connect to XRPL:', error);
      throw new Error('XRPL connection failed');
    }
  }

  /**
   * Disconnect from XRPL client
   */
  async disconnect() {
    if (this.client && this.client.isConnected()) {
      await this.client.disconnect();
      console.log('Disconnected from XRPL server');
    }
  }

  /**
   * Generate a new XRP wallet using XRPL best practices
   * @returns {Object} Wallet information including address, seed, public key, and private key
   */
  static generateWallet() {
    try {
      // Generate a new wallet using XRPL library
      const wallet = Wallet.generate();

      // Validate the generated wallet
      if (!wallet.address || !wallet.seed || !wallet.publicKey || !wallet.privateKey) {
        throw new Error('Invalid wallet generated');
      }

      // Additional validation
      if (!isValidClassicAddress(wallet.address)) {
        throw new Error('Generated wallet address is invalid');
      }

      return {
        address: wallet.address,
        seed: wallet.seed,
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey
      };
    } catch (error) {
      console.error('Error generating wallet:', error);
      throw new Error('Failed to generate wallet');
    }
  }

  /**
   * Validate XRP address format using XRPL utility
   * @param {string} address - XRP address to validate
   * @returns {boolean} True if valid, false otherwise
   */
  static isValidAddress(address) {
    try {
      return isValidClassicAddress(address);
    } catch (error) {
      return false;
    }
  }

  /**
   * Create wallet from seed using XRPL best practices
   * @param {string} seed - Wallet seed
   * @returns {Object} Wallet information
   */
  static walletFromSeed(seed) {
    try {
      if (!seed || typeof seed !== 'string') {
        throw new Error('Invalid seed provided');
      }

      const wallet = Wallet.fromSeed(seed);

      // Validate the wallet
      if (!isValidClassicAddress(wallet.address)) {
        throw new Error('Wallet address is invalid');
      }

      return {
        address: wallet.address,
        seed: wallet.seed,
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey
      };
    } catch (error) {
      console.error('Error creating wallet from seed:', error);
      throw new Error('Failed to create wallet from seed');
    }
  }

  /**
   * Get account info from XRPL
   * @param {string} address - XRP address
   * @returns {Object} Account information
   */
  async getAccountInfo(address) {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      const accountInfo = await this.client.request({
        command: 'account_info',
        account: address,
        ledger_index: 'validated'
      });

      return accountInfo.result.account_data;
    } catch (error) {
      if (error.data && error.data.error === 'actNotFound') {
        // Account doesn't exist yet (not activated)
        return null;
      }
      console.error('Error fetching account info:', error);
      throw new Error('Failed to fetch account information');
    }
  }

  /**
   * Get account balance
   * @param {string} address - XRP address
   * @returns {string} Balance in drops (1 XRP = 1,000,000 drops)
   */
  async getBalance(address) {
    try {
      const accountInfo = await this.getAccountInfo(address);
      return accountInfo ? accountInfo.Balance : '0';
    } catch (error) {
      console.error('Error fetching balance:', error);
      return '0';
    }
  }

  /**
   * Encrypt sensitive wallet data
   * @param {string} data - Data to encrypt
   * @param {string} password - Encryption password
   * @returns {string} Encrypted data
   */
  static encryptWalletData(data, password) {
    try {
      const algorithm = 'aes-256-gcm';
      const key = crypto.scryptSync(password, 'salt', 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, key);

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Error encrypting wallet data:', error);
      throw new Error('Failed to encrypt wallet data');
    }
  }

  /**
   * Decrypt sensitive wallet data
   * @param {string} encryptedData - Encrypted data
   * @param {string} password - Decryption password
   * @returns {string} Decrypted data
   */
  static decryptWalletData(encryptedData, password) {
    try {
      const algorithm = 'aes-256-gcm';
      const key = crypto.scryptSync(password, 'salt', 32);
      const [ivHex, encrypted] = encryptedData.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipher(algorithm, key);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Error decrypting wallet data:', error);
      throw new Error('Failed to decrypt wallet data');
    }
  }
}

module.exports = WalletService;