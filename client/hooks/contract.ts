"use client";

import {
  Contract,
  Networks,
  TransactionBuilder,
  Keypair,
  xdr,
  Address,
  nativeToScVal,
  scValToNative,
  rpc,
} from "@stellar/stellar-sdk";
import {
  isConnected,
  getAddress,
  signTransaction,
  setAllowed,
  isAllowed,
  requestAccess,
} from "@stellar/freighter-api";

// ============================================================
// CONSTANTS — Update these for your contract
// ============================================================

/** Your deployed Soroban contract ID */
export const CONTRACT_ADDRESS =
  "CDD7O6CL2ISVXSQBEJUWPCTVYBJVBRHR7WIO4VZFPCNFX5DALTX3XZHA";

/** Network passphrase (testnet by default) */
export const NETWORK_PASSPHRASE = Networks.TESTNET;

/** Soroban RPC URL */
export const RPC_URL = "https://soroban-testnet.stellar.org";

/** Horizon URL */
export const HORIZON_URL = "https://horizon-testnet.stellar.org";

/** Network name for Freighter */
export const NETWORK = "TESTNET";

// ============================================================
// RPC Server Instance
// ============================================================

const server = new rpc.Server(RPC_URL);

// ============================================================
// Wallet Helpers
// ============================================================

export async function checkConnection(): Promise<boolean> {
  const result = await isConnected();
  return result.isConnected;
}

export async function connectWallet(): Promise<string> {
  const connResult = await isConnected();
  if (!connResult.isConnected) {
    throw new Error("Freighter extension is not installed or not available.");
  }

  const allowedResult = await isAllowed();
  if (!allowedResult.isAllowed) {
    await setAllowed();
    await requestAccess();
  }

  const { address } = await getAddress();
  if (!address) {
    throw new Error("Could not retrieve wallet address from Freighter.");
  }
  return address;
}

export async function getWalletAddress(): Promise<string | null> {
  try {
    const connResult = await isConnected();
    if (!connResult.isConnected) return null;

    const allowedResult = await isAllowed();
    if (!allowedResult.isAllowed) return null;

    const { address } = await getAddress();
    return address || null;
  } catch {
    return null;
  }
}

// ============================================================
// Contract Interaction Helpers
// ============================================================

/**
 * Build, simulate, and optionally sign + submit a Soroban contract call.
 *
 * @param method   - The contract method name to invoke
 * @param params   - Array of xdr.ScVal parameters for the method
 * @param caller   - The public key (G...) of the calling account
 * @param sign     - If true, signs via Freighter and submits. If false, only simulates.
 * @returns        The result of the simulation or submission
 */
export async function callContract(
  method: string,
  params: xdr.ScVal[] = [],
  caller: string,
  sign: boolean = true
) {
  const contract = new Contract(CONTRACT_ADDRESS);
  const account = await server.getAccount(caller);

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...params))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(
      `Simulation failed: ${(simulated as rpc.Api.SimulateTransactionErrorResponse).error}`
    );
  }

  if (!sign) {
    // Read-only call — just return the simulation result
    return simulated;
  }

  // Prepare the transaction with the simulation result
  const prepared = rpc.assembleTransaction(tx, simulated).build();

  // Sign with Freighter
  const { signedTxXdr } = await signTransaction(prepared.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const txToSubmit = TransactionBuilder.fromXDR(
    signedTxXdr,
    NETWORK_PASSPHRASE
  );

  const result = await server.sendTransaction(txToSubmit);

  if (result.status === "ERROR") {
    throw new Error(`Transaction submission failed: ${result.status}`);
  }

  // Poll for confirmation
  let getResult = await server.getTransaction(result.hash);
  while (getResult.status === "NOT_FOUND") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    getResult = await server.getTransaction(result.hash);
  }

  if (getResult.status === "FAILED") {
    throw new Error("Transaction failed on chain.");
  }

  return getResult;
}

/**
 * Read-only contract call (does not require signing).
 */
export async function readContract(
  method: string,
  params: xdr.ScVal[] = [],
  caller?: string
) {
  const account =
    caller || Keypair.random().publicKey(); // Use a random keypair for read-only
  const sim = await callContract(method, params, account, false);
  if (
    rpc.Api.isSimulationSuccess(sim as rpc.Api.SimulateTransactionResponse) &&
    (sim as rpc.Api.SimulateTransactionSuccessResponse).result
  ) {
    return scValToNative(
      (sim as rpc.Api.SimulateTransactionSuccessResponse).result!.retval
    );
  }
  return null;
}

// ============================================================
// ScVal Conversion Helpers
// ============================================================

export function toScValString(value: string): xdr.ScVal {
  return nativeToScVal(value, { type: "string" });
}

export function toScValU32(value: number): xdr.ScVal {
  return nativeToScVal(value, { type: "u32" });
}

export function toScValU64(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: "u64" });
}

export function toScValI128(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: "i128" });
}

export function toScValAddress(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

export function toScValBool(value: boolean): xdr.ScVal {
  return nativeToScVal(value, { type: "bool" });
}

// ============================================================
// Event Ticketing System — Contract Methods
// ============================================================

/**
 * Initialize the contract
 */
export async function init(caller: string) {
  return callContract("init", [], caller, true);
}

/**
 * Create a new event - PERMISSIONLESS: anyone can create
 * Calls: create_event(creator: Address, name: String, description: String, date: u64, location: String, total_tickets: u32) -> u32
 */
export async function createEvent(
  caller: string,
  name: string,
  description: string,
  date: bigint,
  location: string,
  totalTickets: number
) {
  return callContract(
    "create_event",
    [
      toScValAddress(caller),
      toScValString(name),
      toScValString(description),
      toScValU64(date),
      toScValString(location),
      toScValU32(totalTickets),
    ],
    caller,
    true
  );
}

/**
 * Buy/Claim tickets for an event - PERMISSIONLESS: anyone can buy
 * Calls: buy_ticket(buyer: Address, event_id: u32, quantity: u32)
 */
export async function buyTicket(
  caller: string,
  eventId: number,
  quantity: number
) {
  return callContract(
    "buy_ticket",
    [toScValAddress(caller), toScValU32(eventId), toScValU32(quantity)],
    caller,
    true
  );
}

/**
 * Transfer tickets to another address
 * Calls: transfer_ticket(from: Address, to: Address, event_id: u32, quantity: u32)
 */
export async function transferTicket(
  caller: string,
  to: string,
  eventId: number,
  quantity: number
) {
  return callContract(
    "transfer_ticket",
    [toScValAddress(caller), toScValAddress(to), toScValU32(eventId), toScValU32(quantity)],
    caller,
    true
  );
}

/**
 * Burn tickets (e.g., at event check-in)
 * Calls: burn_ticket(owner: Address, event_id: u32, quantity: u32)
 */
export async function burnTicket(
  caller: string,
  eventId: number,
  quantity: number
) {
  return callContract(
    "burn_ticket",
    [toScValAddress(caller), toScValU32(eventId), toScValU32(quantity)],
    caller,
    true
  );
}

/**
 * Get event details (read-only)
 * Calls: get_event(event_id: u32) -> Event
 */
export async function getEvent(eventId: number) {
  return readContract("get_event", [toScValU32(eventId)]);
}

/**
 * Get all events (read-only)
 * Calls: get_all_events() -> Vec<Event>
 */
export async function getAllEvents() {
  return readContract("get_all_events", []);
}

/**
 * Get ticket count for an address and event
 * Calls: get_ticket_count(owner: Address, event_id: u32) -> u32
 */
export async function getTicketCount(owner: string, eventId: number) {
  return readContract("get_ticket_count", [toScValAddress(owner), toScValU32(eventId)]);
}

/**
 * Get remaining tickets for an event
 * Calls: get_tickets_remaining(event_id: u32) -> u32
 */
export async function getTicketsRemaining(eventId: number) {
  return readContract("get_tickets_remaining", [toScValU32(eventId)]);
}

export { nativeToScVal, scValToNative, Address, xdr };
