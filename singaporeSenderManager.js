// File: singaporeSenderManager.js
// Description: ULTRA-FAST Singapore regional Helius Sender endpoint manager for sub-200ms trade execution

const { Connection, PublicKey, LAMPORTS_PER_SOL, ComputeBudgetProgram, SystemProgram, VersionedTransaction, TransactionMessage } = require('@solana/web3.js');
const config = require('./config.js');
const { shortenAddress } = require('./utils.js');
const performanceMonitor = require('./performanceMonitor.js');

class SingaporeSenderManager {
    constructor() {
        // ULTRA-FAST Singapore regional endpoints (optimized for Asia-Pacific)
        this.singaporeEndpoints = {
            rpc: 'https://mainnet.helius-rpc.com/?api-key=b9a69ad0-d823-429e-8c18-7cbea0e31769',
            sender: 'https://sender.helius-rpc.com/fast', // ULTRA-FAST global sender
            laserstream: 'wss://mainnet.helius-rpc.com/?api-key=b9a69ad0-d823-429e-8c18-7cbea0e31769'
        };

        // Jito tip accounts for maximum MEV protection
        this.tipAccounts = [
            "4ACfpUFoaSD9bfPdeu6DBt89gB6ENTeHBXCAi87NhDEE",
            "D2L6yPZ2FmmmTKPgzaMKdhu6EWZcTpLy1Vhx8uvZe7NZ", 
            "9bnz4RShgq1hAnLnZbP8kbgBg1kEmcJBYQq3gQbmnSta",
            "5VY91ws6B2hMmBFRsXkoAAdsPHBJwRfBht4DXox3xkwn",
            "2nyhqdwKcJZR2vcqCyrYsaPVdAnFoJjiksCXJ7hfEYgD",
            "2q5pghRs6arqVjRvT5gfgWfWcHWmw1ZuCzphgd5KfWGJ",
            "wyvPkWjVZz1M8fHQnMMCDTQDbkManefNNhweYk5WkcF",
            "3KCKozbAaF75qEU33jtzozcJ29yJuaLJTy2jFdzUY8bT",
            "4vieeGHPYPG2MmyPRcYjdiDmmhN3ww7hsFNap8pVN3Ey",
            "4TQLFNWK8AovT1gFvda5jfw2oJeRMKEmw7aH6MGBJ3or"
        ];

        this.connection = new Connection(this.singaporeEndpoints.rpc, {
            commitment: 'confirmed',
            wsEndpoint: this.singaporeEndpoints.laserstream.replace('wss://', 'ws://')
        });

        this.isHealthy = true;
        this.lastHealthCheck = Date.now();
        this.healthCheckInterval = 30000; // 30 seconds
        
        // PERFORMANCE METRICS
        this.executionStats = {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            averageExecutionTime: 0,
            lastExecutionTime: 0,
            totalExecutionTime: 0
        };

        console.log('[SINGAPORE-SENDER] 🚀 ULTRA-FAST Manager initialized with Singapore regional endpoints');
        console.log(`[SINGAPORE-SENDER] 🌏 Endpoints: ${JSON.stringify(this.singaporeEndpoints, null, 2)}`);
        console.log(`[SINGAPORE-SENDER] ⚡ Target execution time: <200ms`);
        console.log(`[SINGAPORE-SENDER] 🔧 Jito tip accounts: ${this.tipAccounts.length} configured`);
        
        // Start health monitoring
        this.startHealthMonitoring();
    }

    // Start periodic health monitoring
    startHealthMonitoring() {
        setInterval(async () => {
            await this.healthCheck();
        }, this.healthCheckInterval);
    }

    // Health check for Singapore endpoints
    async healthCheck() {
        try {
            const response = await fetch(this.singaporeEndpoints.rpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getHealth'
                })
            });
            
            const result = await response.json();
            this.isHealthy = result.result === 'ok';
            this.lastHealthCheck = Date.now();
            
            if (this.isHealthy) {
                console.log(`[SINGAPORE-SENDER] ✅ Health check passed at ${new Date().toISOString()}`);
            } else {
                console.warn(`[SINGAPORE-SENDER] ⚠️ Health check failed at ${new Date().toISOString()}`);
            }
            
        } catch (error) {
            console.error('[SINGAPORE-SENDER] ❌ Health check error:', error);
            this.isHealthy = false;
        }
    }

    // Get dynamic tip amount from Jito API (75th percentile) for maximum MEV protection
    async getDynamicTipAmount() {
        try {
            const response = await fetch('https://bundles.jito.wtf/api/v1/bundles/tip_floor');
            const data = await response.json();
            
            if (data && data[0] && typeof data[0].landed_tips_75th_percentile === 'number') {
                const tip75th = data[0].landed_tips_75th_percentile;
                // Use 75th percentile but minimum 0.001 SOL for maximum MEV protection
                const dynamicTip = Math.max(tip75th, 0.001);
                console.log(`[SINGAPORE-SENDER] 💰 Dynamic tip calculated: ${dynamicTip} SOL (75th percentile)`);
                return dynamicTip;
            }
            
            // Fallback if API fails or data is invalid
            console.warn('[SINGAPORE-SENDER] ⚠️ Using fallback tip amount: 0.001 SOL');
            return 0.001;
        } catch (error) {
            console.warn('[SINGAPORE-SENDER] ⚠️ Failed to fetch dynamic tip amount, using fallback:', error);
            return 0.001; // Fallback to minimum
        }
    }

    // ULTRA-FAST transaction execution with Helius Sender
    async executeTransactionWithSender(transaction, keypair, options = {}) {
        const startTime = Date.now();
        
        try {
            console.log(`[SINGAPORE-SENDER] 🚀 Starting ULTRA-FAST execution...`);
            
            // VALIDATE TRANSACTION
            if (!this.validateTransaction(transaction)) {
                throw new Error('Invalid transaction format');
            }
            
            // GET DYNAMIC TIP AMOUNT
            const tipAmountSOL = await this.getDynamicTipAmount();
            const tipAccount = new PublicKey(this.tipAccounts[Math.floor(Math.random() * this.tipAccounts.length)]);
            
            console.log(`[SINGAPORE-SENDER] 💰 Using tip amount: ${tipAmountSOL} SOL to ${shortenAddress(tipAccount)}`);
            
            // BUILD OPTIMIZED TRANSACTION
            const optimizedTransaction = await this.buildOptimizedTransaction(
                transaction, 
                keypair, 
                tipAccount, 
                tipAmountSOL,
                options
            );
            
            // EXECUTE VIA SENDER ENDPOINT
            const signature = await this.sendViaSender(optimizedTransaction);
            
            // CONFIRM TRANSACTION
            const confirmationTime = await this.confirmTransaction(signature);
            
            // CALCULATE EXECUTION TIME
            const executionTime = Date.now() - startTime;
            this.updateExecutionStats(executionTime, true);
            
            // RECORD WITH PERFORMANCE MONITOR
            performanceMonitor.recordExecutionLatency(executionTime);
            
            console.log(`[SINGAPORE-SENDER] ✅ ULTRA-FAST execution completed in ${executionTime}ms!`);
            console.log(`[SINGAPORE-SENDER] 📝 Signature: ${signature}`);
            console.log(`[SINGAPORE-SENDER] ⚡ Execution time: ${executionTime}ms`);
            console.log(`[SINGAPORE-SENDER] 🔍 Confirmation time: ${confirmationTime}ms`);
            
            // Check if execution meets ultra-fast targets
            if (executionTime < 200) {
                console.log(`[SINGAPORE-SENDER] ⚡ ULTRA-FAST TARGET ACHIEVED: ${executionTime}ms execution!`);
            } else if (executionTime < 400) {
                console.log(`[SINGAPORE-SENDER] 🚀 FAST TARGET ACHIEVED: ${executionTime}ms execution`);
            } else {
                console.log(`[SINGAPORE-SENDER] ⚠️ Execution time: ${executionTime}ms (above target)`);
            }
            
            return {
                signature,
                executionTime,
                confirmationTime,
                tipAmount: tipAmountSOL,
                tipAccount: tipAccount.toString()
            };
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            this.updateExecutionStats(executionTime, false);
            
            console.error(`[SINGAPORE-SENDER] ❌ Execution failed after ${executionTime}ms:`, error.message);
            throw error;
        }
    }

    // Validate transaction before execution
    validateTransaction(transaction) {
        try {
            // Check if transaction has required fields
            if (!transaction || !transaction.instructions || transaction.instructions.length === 0) {
                console.log(`[SINGAPORE-SENDER] ❌ Validation failed: Missing instructions`);
                return false;
            }
            
            // Check if instructions are valid Solana instructions
            for (const instruction of transaction.instructions) {
                if (!instruction.programId || !instruction.keys || !instruction.data) {
                    console.log(`[SINGAPORE-SENDER] ❌ Validation failed: Invalid instruction format`);
                    return false;
                }
            }
            
            console.log(`[SINGAPORE-SENDER] ✅ Transaction validation passed with ${transaction.instructions.length} instructions`);
            return true;
        } catch (error) {
            console.log(`[SINGAPORE-SENDER] ❌ Validation error:`, error.message);
            return false;
        }
    }

    // Build optimized transaction with tip and compute budget
    async buildOptimizedTransaction(originalTransaction, keypair, tipAccount, tipAmountSOL, options = {}) {
        try {
            console.log(`[SINGAPORE-SENDER] 🔧 Building optimized transaction...`);
            console.log(`[SINGAPORE-SENDER] 📊 Original instructions: ${originalTransaction.instructions.length}`);
            
            // Get recent blockhash
            const { value: { blockhash, lastValidBlockHeight } } = await this.connection.getLatestBlockhashAndContext('confirmed');
            
            // Create copy of instructions to avoid modifying the original
            const allInstructions = [...originalTransaction.instructions];
            
            // ADD COMPUTE BUDGET INSTRUCTIONS (must be first)
            const computeUnits = options.computeUnits || 100_000;
            const priorityFee = typeof options.priorityFee === 'string' && options.priorityFee === 'dynamic' ? 
                200_000 : (options.priorityFee || 200_000); // Convert 'dynamic' to default value
            
            allInstructions.unshift(
                ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
                ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee })
            );
            
            // ADD TIP TRANSFER INSTRUCTION
            allInstructions.push(
                SystemProgram.transfer({
                    fromPubkey: keypair.publicKey,
                    toPubkey: tipAccount,
                    lamports: tipAmountSOL * LAMPORTS_PER_SOL,
                })
            );
            
            console.log(`[SINGAPORE-SENDER] 🔧 Total instructions after optimization: ${allInstructions.length}`);
            
            // BUILD FINAL TRANSACTION
            const optimizedTransaction = new VersionedTransaction(
                new TransactionMessage({
                    instructions: allInstructions,
                    payerKey: keypair.publicKey,
                    recentBlockhash: blockhash,
                }).compileToV0Message()
            );
            
            // Sign transaction
            optimizedTransaction.sign([keypair]);
            
            console.log(`[SINGAPORE-SENDER] ✅ Optimized transaction built with ${allInstructions.length} instructions`);
            console.log(`[SINGAPORE-SENDER] 🔧 Compute units: ${computeUnits}, Priority fee: ${priorityFee} microLamports`);
            console.log(`[SINGAPORE-SENDER] 📝 Transaction size: ${optimizedTransaction.serialize().length} bytes`);
            
            return {
                transaction: optimizedTransaction,
                blockhash,
                lastValidBlockHeight
            };
            
        } catch (error) {
            console.error(`[SINGAPORE-SENDER] ❌ Error building optimized transaction:`, error);
            throw error;
        }
    }

    // Send transaction via Helius Sender endpoint
    async sendViaSender(transactionData, retries = 3) {
        const { transaction, blockhash, lastValidBlockHeight } = transactionData;
        
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                console.log(`[SINGAPORE-SENDER] 📤 Sending via Sender endpoint (attempt ${attempt + 1}/${retries})...`);
                
                // Check blockhash validity
                const currentHeight = await this.connection.getBlockHeight('confirmed');
                if (currentHeight > lastValidBlockHeight) {
                    throw new Error('Blockhash expired');
                }
                
                // Send via Sender endpoint
                const response = await fetch(this.singaporeEndpoints.sender, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: Date.now().toString(),
                        method: 'sendTransaction',
                        params: [
                            Buffer.from(transaction.serialize()).toString('base64'),
                            {
                                encoding: 'base64',
                                skipPreflight: true,    // Required for Sender
                                maxRetries: 0           // Implement our own retry logic
                            }
                        ]
                    })
                });
                
                const result = await response.json();
                if (result.error) {
                    throw new Error(result.error.message);
                }
                
                console.log(`[SINGAPORE-SENDER] ✅ Transaction sent successfully: ${result.result}`);
                return result.result;
                
            } catch (error) {
                console.warn(`[SINGAPORE-SENDER] ⚠️ Attempt ${attempt + 1} failed:`, error.message);
                
                if (attempt === retries - 1) {
                    throw new Error(`All ${retries} attempts failed: ${error.message}`);
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
        
        throw new Error('All retry attempts failed');
    }

    // Confirm transaction with timeout
    async confirmTransaction(signature, timeout = 15000) {
        const startTime = Date.now();
        const interval = 1000; // Check every 1 second
        
        console.log(`[SINGAPORE-SENDER] 🔍 Confirming transaction: ${signature}...`);
        
        while (Date.now() - startTime < timeout) {
            try {
                const status = await this.connection.getSignatureStatuses([signature]);
                const confirmationStatus = status?.value[0]?.confirmationStatus;
                
                if (confirmationStatus === 'confirmed' || confirmationStatus === 'finalized') {
                    const confirmationTime = Date.now() - startTime;
                    console.log(`[SINGAPORE-SENDER] ✅ Transaction confirmed in ${confirmationTime}ms`);
                    return confirmationTime;
                }
                
                // Log progress
                if (Date.now() - startTime > 5000) { // After 5 seconds
                    console.log(`[SINGAPORE-SENDER] ⏳ Still waiting for confirmation... (${Date.now() - startTime}ms elapsed)`);
                }
                
            } catch (error) {
                console.warn('[SINGAPORE-SENDER] ⚠️ Status check failed:', error.message);
            }
            
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        
        throw new Error(`Transaction confirmation timeout after ${timeout}ms`);
    }

    // Update execution statistics
    updateExecutionStats(executionTime, success) {
        this.executionStats.totalExecutions++;
        this.executionStats.totalExecutionTime += executionTime;
        this.executionStats.lastExecutionTime = executionTime;
        
        if (success) {
            this.executionStats.successfulExecutions++;
        } else {
            this.executionStats.failedExecutions++;
        }
        
        // Calculate average execution time
        this.executionStats.averageExecutionTime = this.executionStats.totalExecutionTime / this.executionStats.totalExecutions;
    }

    // Get execution statistics
    getExecutionStats() {
        return {
            ...this.executionStats,
            successRate: this.executionStats.totalExecutions > 0 ? 
                (this.executionStats.successfulExecutions / this.executionStats.totalExecutions) * 100 : 0,
            healthStatus: this.isHealthy,
            lastHealthCheck: this.lastHealthCheck
        };
    }

    // Get dynamic priority fee from Helius API
    async getDynamicPriorityFee(instructions, payerKey, blockhash) {
        try {
            console.log(`[SINGAPORE-SENDER] 🔍 Fetching dynamic priority fee...`);
            
            // Create temporary transaction for fee estimation
            const tempTx = new VersionedTransaction(
                new TransactionMessage({
                    instructions,
                    payerKey,
                    recentBlockhash: blockhash,
                }).compileToV0Message()
            );
            
            const response = await fetch(this.singaporeEndpoints.rpc, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: "1",
                    method: "getPriorityFeeEstimate",
                    params: [{
                        transaction: Buffer.from(tempTx.serialize()).toString('base64'),
                        options: { recommended: true },
                    }],   
                }),
            });
            
            const data = await response.json();
            const priorityFee = data.result?.priorityFeeEstimate ? 
                Math.ceil(data.result.priorityFeeEstimate * 1.2) : 50_000; // 20% buffer
            
            console.log(`[SINGAPORE-SENDER] 💰 Dynamic priority fee: ${priorityFee} microLamports`);
            return priorityFee;
            
        } catch (error) {
            console.warn('[SINGAPORE-SENDER] ⚠️ Failed to fetch dynamic priority fee, using fallback:', error.message);
            return 50_000; // Fallback fee
        }
    }

    // Simulate transaction to get compute units
    async simulateTransaction(instructions, keypair, blockhash) {
        try {
            console.log(`[SINGAPORE-SENDER] 🔍 Simulating transaction for compute units...`);
            
            const testInstructions = [
                ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
                ...instructions,
            ];

            const testTransaction = new VersionedTransaction(
                new TransactionMessage({
                    instructions: testInstructions,
                    payerKey: keypair.publicKey,
                    recentBlockhash: blockhash,
                }).compileToV0Message()
            );
            testTransaction.sign([keypair]);

            const simulation = await this.connection.simulateTransaction(testTransaction, {
                replaceRecentBlockhash: true,
                sigVerify: false,
            });

            if (!simulation.value.unitsConsumed) {
                throw new Error('Simulation failed to return compute units');
            }

            const units = simulation.value.unitsConsumed;
            const computeUnits = units < 1000 ? 1000 : Math.ceil(units * 1.1); // 10% margin
            
            console.log(`[SINGAPORE-SENDER] 🔧 Simulated compute units: ${units}, Using: ${computeUnits}`);
            return computeUnits;
            
        } catch (error) {
            console.warn('[SINGAPORE-SENDER] ⚠️ Simulation failed, using default compute units:', error.message);
            return 100_000; // Default compute units
        }
    }

    // ULTRA-FAST copy trade execution
    async executeCopyTrade(instructions, keypair, options = {}) {
        try {
            console.log(`[SINGAPORE-SENDER] 🚀 Starting ULTRA-FAST copy trade execution...`);
            
            // Debug: Log instruction structure
            console.log(`[SINGAPORE-SENDER] 🔍 Instructions received:`, instructions.length);
            if (instructions.length > 0) {
                console.log(`[SINGAPORE-SENDER] 🔍 First instruction keys:`, Object.keys(instructions[0]));
                console.log(`[SINGAPORE-SENDER] 🔍 First instruction programId:`, instructions[0].programId);
                
                // Validate instruction structure
                for (let i = 0; i < instructions.length; i++) {
                    const ix = instructions[i];
                    if (!ix.programId) {
                        console.error(`[SINGAPORE-SENDER] ❌ Instruction ${i} missing programId:`, ix);
                        throw new Error(`Instruction ${i} is missing programId - invalid instruction format`);
                    }
                    if (!ix.programId.equals) {
                        console.error(`[SINGAPORE-SENDER] ❌ Instruction ${i} programId is not a PublicKey:`, ix.programId);
                        throw new Error(`Instruction ${i} programId is not a valid PublicKey object`);
                    }
                }
            }
            
            // Validate user hasn't included compute budget instructions
            const hasComputeBudget = instructions.some(ix => 
                ix.programId && ix.programId.equals && ix.programId.equals(ComputeBudgetProgram.programId)
            );
            if (hasComputeBudget) {
                throw new Error('Do not include compute budget instructions - they are added automatically');
            }
            
            // Get recent blockhash
            const { value: blockhashInfo } = await this.connection.getLatestBlockhashAndContext('confirmed');
            const { blockhash, lastValidBlockHeight } = blockhashInfo;
            
            // Get dynamic compute units
            const computeUnits = await this.simulateTransaction(instructions, keypair, blockhash);
            
            // Get dynamic priority fee
            const priorityFee = await this.getDynamicPriorityFee(instructions, keypair.publicKey, blockhash);
            
            // Get dynamic tip amount
            const tipAmountSOL = await this.getDynamicTipAmount();
            const tipAccount = new PublicKey(this.tipAccounts[Math.floor(Math.random() * this.tipAccounts.length)]);
            
            console.log(`[SINGAPORE-SENDER] 🔧 Copy trade optimization complete:`);
            console.log(`[SINGAPORE-SENDER]   - Compute units: ${computeUnits}`);
            console.log(`[SINGAPORE-SENDER]   - Priority fee: ${priorityFee} microLamports`);
            console.log(`[SINGAPORE-SENDER]   - Tip amount: ${tipAmountSOL} SOL`);
            
            // Execute with optimized parameters
            return await this.executeTransactionWithSender(
                { instructions },
                keypair,
                {
                    computeUnits,
                    priorityFee,
                    tipAmount: tipAmountSOL,
                    tipAccount: tipAccount.toString(),
                    ...options
                }
            );
            
        } catch (error) {
            console.error(`[SINGAPORE-SENDER] ❌ Copy trade execution failed:`, error.message);
            throw error;
        }
    }
}

module.exports = { SingaporeSenderManager };
