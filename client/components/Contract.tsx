"use client";

import { useState, useCallback, useEffect } from "react";
import {
  createEvent,
  buyTicket,
  transferTicket,
  burnTicket,
  getEvent,
  getAllEvents,
  getTicketCount,
  getTicketsRemaining,
  CONTRACT_ADDRESS,
} from "@/hooks/contract";
import { AnimatedCard } from "@/components/ui/animated-card";
import { Spotlight } from "@/components/ui/spotlight";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────

interface Event {
  id: number;
  name: string;
  description: string;
  date: string;
  location: string;
  total_tickets: number;
  tickets_sold: number;
  created_at: string;
}

// ── Icons ────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" />
      <path d="M13 17v2" />
      <path d="M13 11v2" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function FireIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

// ── Styled Input ─────────────────────────────────────────────

function Input({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-medium uppercase tracking-wider text-white/30">
        {label}
      </label>
      <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-px transition-all focus-within:border-[#7c6cf0]/30 focus-within:shadow-[0_0_20px_rgba(124,108,240,0.08)]">
        <input
          {...props}
          className="w-full rounded-[11px] bg-transparent px-4 py-3 font-mono text-sm text-white/90 placeholder:text-white/15 outline-none"
        />
      </div>
    </div>
  );
}

// ── Event Card ───────────────────────────────────────────────

function EventCard({ event, onBuy, onView }: { event: Event; onBuy: () => void; onView: () => void }) {
  const available = event.total_tickets - event.tickets_sold;
  const soldPercent = (event.tickets_sold / event.total_tickets) * 100;
  const isSoldOut = available === 0;
  
  const formatDate = (timestamp: string | number) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden hover:border-white/[0.1] transition-all animate-fade-in-up">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-white/90 text-sm leading-tight">{event.name}</h4>
          {isSoldOut ? (
            <Badge variant="error" className="shrink-0 text-[10px]">Sold Out</Badge>
          ) : (
            <Badge variant="success" className="shrink-0 text-[10px]">{available} left</Badge>
          )}
        </div>
        
        <p className="text-xs text-white/40 line-clamp-2">{event.description}</p>
        
        <div className="flex items-center gap-4 text-[11px] text-white/50">
          <span className="flex items-center gap-1.5">
            <CalendarIcon />
            {formatDate(event.date)}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPinIcon />
            {event.location}
          </span>
        </div>

        {/* Ticket progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-white/30">
            <span>{event.tickets_sold} sold</span>
            <span>{event.total_tickets} total</span>
          </div>
          <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
            <div 
              className="h-full rounded-full transition-all bg-gradient-to-r from-[#7c6cf0] to-[#4fc3f7]"
              style={{ width: `${soldPercent}%` }}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onView}
            className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] py-2 text-xs text-white/50 hover:text-white/80 hover:border-white/[0.1] transition-all"
          >
            View
          </button>
          <button
            onClick={onBuy}
            disabled={isSoldOut}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-medium transition-all",
              isSoldOut
                ? "bg-white/[0.02] text-white/20 cursor-not-allowed"
                : "bg-gradient-to-r from-[#7c6cf0] to-[#4fc3f7] text-white hover:shadow-lg hover:shadow-[#7c6cf0]/20 active:scale-[0.98]"
            )}
          >
            Buy Ticket
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Method Signature ─────────────────────────────────────────

function MethodSignature({
  name,
  params,
  returns,
  color,
}: {
  name: string;
  params: string;
  returns?: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 font-mono text-sm">
      <span style={{ color }} className="font-semibold">fn</span>
      <span className="text-white/70">{name}</span>
      <span className="text-white/20 text-xs">{params}</span>
      {returns && (
        <span className="ml-auto text-white/15 text-[10px]">{returns}</span>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

type Tab = "browse" | "create" | "my-tickets" | "transfer";

interface ContractUIProps {
  walletAddress: string | null;
  onConnect: () => void;
  isConnecting: boolean;
}

export default function ContractUI({ walletAddress, onConnect, isConnecting }: ContractUIProps) {
  const [activeTab, setActiveTab] = useState<Tab>("browse");
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  // Create event form
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createLocation, setCreateLocation] = useState("");
  const [createDate, setCreateDate] = useState("");
  const [createTickets, setCreateTickets] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Buy ticket
  const [buyEventId, setBuyEventId] = useState("");
  const [buyQuantity, setBuyQuantity] = useState("1");
  const [isBuying, setIsBuying] = useState(false);

  // Transfer
  const [transferTo, setTransferTo] = useState("");
  const [transferEventId, setTransferEventId] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("1");
  const [isTransferring, setIsTransferring] = useState(false);

  // Browse events
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // My tickets
  const [myTicketCounts, setMyTicketCounts] = useState<Map<number, number>>(new Map());
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);

  // Burn ticket
  const [burnEventId, setBurnEventId] = useState("");
  const [burnQuantity, setBurnQuantity] = useState("1");
  const [isBurning, setIsBurning] = useState(false);

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // Load events
  const loadEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    try {
      const result = await getAllEvents();
      if (Array.isArray(result)) {
        setEvents(result as Event[]);
      }
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setIsLoadingEvents(false);
    }
  }, []);

  // Load my tickets
  const loadMyTickets = useCallback(async () => {
    if (!walletAddress) return;
    setIsLoadingTickets(true);
    try {
      const result = await getAllEvents();
      const ticketCounts = new Map<number, number>();
      if (Array.isArray(result)) {
        for (const event of result as Event[]) {
          const count = await getTicketCount(walletAddress, event.id);
          if (count && count > 0) {
            ticketCounts.set(event.id, count);
          }
        }
      }
      setMyTicketCounts(ticketCounts);
    } catch (err) {
      console.error("Failed to load tickets:", err);
    } finally {
      setIsLoadingTickets(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    loadEvents();
    if (walletAddress) {
      loadMyTickets();
    }
  }, [loadEvents, loadMyTickets, walletAddress]);

  // Handle create event
  const handleCreateEvent = useCallback(async () => {
    if (!walletAddress) return setError("Connect wallet first");
    if (!createName.trim() || !createDesc.trim() || !createLocation.trim() || !createDate || !createTickets) {
      return setError("Fill in all fields");
    }
    setError(null);
    setIsCreating(true);
    setTxStatus("Awaiting signature...");

    try {
      const eventDate = Math.floor(new Date(createDate).getTime() / 1000);
      await createEvent(
        walletAddress,
        createName.trim(),
        createDesc.trim(),
        BigInt(eventDate),
        createLocation.trim(),
        parseInt(createTickets)
      );
      setTxStatus("Event created on-chain!");
      setCreateName("");
      setCreateDesc("");
      setCreateLocation("");
      setCreateDate("");
      setCreateTickets("");
      loadEvents();
      setTimeout(() => setTxStatus(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus(null);
    } finally {
      setIsCreating(false);
    }
  }, [walletAddress, createName, createDesc, createLocation, createDate, createTickets, loadEvents]);

  // Handle buy ticket
  const handleBuyTicket = useCallback(async () => {
    if (!walletAddress) return setError("Connect wallet first");
    if (!buyEventId) return setError("Select an event");
    const qty = parseInt(buyQuantity);
    if (isNaN(qty) || qty < 1) return setError("Enter valid quantity");

    setError(null);
    setIsBuying(true);
    setTxStatus("Awaiting signature...");

    try {
      await buyTicket(walletAddress, parseInt(buyEventId), qty);
      setTxStatus("Ticket purchased!");
      setBuyQuantity("1");
      loadEvents();
      loadMyTickets();
      setTimeout(() => setTxStatus(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus(null);
    } finally {
      setIsBuying(false);
    }
  }, [walletAddress, buyEventId, buyQuantity, loadEvents, loadMyTickets]);

  // Handle transfer
  const handleTransfer = useCallback(async () => {
    if (!walletAddress) return setError("Connect wallet first");
    if (!transferTo.trim()) return setError("Enter recipient address");
    if (!transferEventId) return setError("Select an event");
    const qty = parseInt(transferQuantity);
    if (isNaN(qty) || qty < 1) return setError("Enter valid quantity");

    setError(null);
    setIsTransferring(true);
    setTxStatus("Awaiting signature...");

    try {
      await transferTicket(walletAddress, transferTo.trim(), parseInt(transferEventId), qty);
      setTxStatus("Ticket transferred!");
      setTransferTo("");
      setTransferQuantity("1");
      loadMyTickets();
      setTimeout(() => setTxStatus(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus(null);
    } finally {
      setIsTransferring(false);
    }
  }, [walletAddress, transferTo, transferEventId, transferQuantity, loadMyTickets]);

  // Handle burn
  const handleBurn = useCallback(async () => {
    if (!walletAddress) return setError("Connect wallet first");
    if (!burnEventId) return setError("Select an event");
    const qty = parseInt(burnQuantity);
    if (isNaN(qty) || qty < 1) return setError("Enter valid quantity");

    setError(null);
    setIsBurning(true);
    setTxStatus("Awaiting signature...");

    try {
      await burnTicket(walletAddress, parseInt(burnEventId), qty);
      setTxStatus("Ticket burned!");
      setBurnQuantity("1");
      loadMyTickets();
      setTimeout(() => setTxStatus(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus(null);
    } finally {
      setIsBurning(false);
    }
  }, [walletAddress, burnEventId, burnQuantity, loadMyTickets]);

  // Quick buy from event card
  const handleQuickBuy = useCallback((event: Event) => {
    setBuyEventId(String(event.id));
    setActiveTab("my-tickets");
  }, []);

  // View event details
  const handleViewEvent = useCallback(async (event: Event) => {
    try {
      const result = await getEvent(event.id);
      if (result) {
        setSelectedEvent(result as Event);
      }
    } catch (err) {
      setError("Failed to load event details");
    }
  }, []);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "browse", label: "Browse", icon: <CalendarIcon />, color: "#7c6cf0" },
    { key: "create", label: "Create", icon: <TicketIcon />, color: "#fbbf24" },
    { key: "my-tickets", label: "My Tickets", icon: <UsersIcon />, color: "#34d399" },
    { key: "transfer", label: "Transfer", icon: <SendIcon />, color: "#4fc3f7" },
  ];

  // Get events user has tickets for
  const myEvents = events.filter(e => myTicketCounts.has(e.id));

  return (
    <div className="w-full max-w-2xl animate-fade-in-up-delayed">
      {/* Toasts */}
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#f87171]/15 bg-[#f87171]/[0.05] px-4 py-3 backdrop-blur-sm animate-slide-down">
          <span className="mt-0.5 text-[#f87171]"><AlertIcon /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#f87171]/90">Error</p>
            <p className="text-xs text-[#f87171]/50 mt-0.5 break-all">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="shrink-0 text-[#f87171]/30 hover:text-[#f87171]/70 text-lg leading-none">&times;</button>
        </div>
      )}

      {txStatus && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#34d399]/15 bg-[#34d399]/[0.05] px-4 py-3 backdrop-blur-sm shadow-[0_0_30px_rgba(52,211,153,0.05)] animate-slide-down">
          <span className="text-[#34d399]">
            {txStatus.includes("on-chain") || txStatus.includes("!") ? <CheckIcon /> : <SpinnerIcon />}
          </span>
          <span className="text-sm text-[#34d399]/90">{txStatus}</span>
        </div>
      )}

      {/* Main Card */}
      <Spotlight className="rounded-2xl">
        <AnimatedCard className="p-0" containerClassName="rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c6cf0]/20 to-[#4fc3f7]/20 border border-white/[0.06]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#7c6cf0]">
                  <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                  <path d="M13 5v2" />
                  <path d="M13 17v2" />
                  <path d="M13 11v2" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white/90">Event Ticketing</h3>
                <p className="text-[10px] text-white/25 font-mono mt-0.5">{truncate(CONTRACT_ADDRESS)}</p>
              </div>
            </div>
            <Badge variant="info" className="text-[10px]">Soroban</Badge>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.06] px-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setError(null); setSelectedEvent(null); }}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-3.5 text-sm font-medium transition-all",
                  activeTab === t.key ? "text-white/90" : "text-white/35 hover:text-white/55"
                )}
              >
                <span style={activeTab === t.key ? { color: t.color } : undefined}>{t.icon}</span>
                {t.label}
                {activeTab === t.key && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full transition-all"
                    style={{ background: `linear-gradient(to right, ${t.color}, ${t.color}66)` }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Browse Events */}
            {activeTab === "browse" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <MethodSignature name="get_all_events" params="()" returns="-> Vec<Event>" color="#7c6cf0" />
                  <button 
                    onClick={loadEvents}
                    disabled={isLoadingEvents}
                    className="p-2 rounded-lg border border-white/[0.06] hover:border-white/[0.1] transition-all"
                  >
                    <RefreshIcon />
                  </button>
                </div>

                {isLoadingEvents ? (
                  <div className="flex items-center justify-center py-8">
                    <SpinnerIcon />
                    <span className="ml-2 text-sm text-white/50">Loading events...</span>
                  </div>
                ) : events.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-white/40">No events yet. Be the first to create one!</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {events.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onBuy={() => handleQuickBuy(event)}
                        onView={() => handleViewEvent(event)}
                      />
                    ))}
                  </div>
                )}

                {/* Selected Event Details */}
                {selectedEvent && (
                  <div className="mt-4 p-4 rounded-xl border border-[#7c6cf0]/20 bg-[#7c6cf0]/[0.05]">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-white/90">Event Details</h4>
                      <button onClick={() => setSelectedEvent(null)} className="text-white/30 hover:text-white/60">✕</button>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-white/40">Name</span>
                        <span className="text-white/80">{selectedEvent.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40">Description</span>
                        <span className="text-white/80 text-right max-w-[200px]">{selectedEvent.description}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40">Location</span>
                        <span className="text-white/80">{selectedEvent.location}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40">Tickets Sold</span>
                        <span className="text-white/80">{selectedEvent.tickets_sold} / {selectedEvent.total_tickets}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Create Event */}
            {activeTab === "create" && (
              <div className="space-y-5">
                <MethodSignature 
                  name="create_event" 
                  params="(creator, name, desc, date, location, total)" 
                  color="#fbbf24" 
                />
                <Input label="Event Name" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="e.g. Tech Conference 2026" />
                <Input label="Description" value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} placeholder="e.g. Annual tech gathering" />
                <Input label="Location" value={createLocation} onChange={(e) => setCreateLocation(e.target.value)} placeholder="e.g. San Francisco" />
                <Input label="Event Date" type="date" value={createDate} onChange={(e) => setCreateDate(e.target.value)} />
                <Input label="Total Tickets" type="number" value={createTickets} onChange={(e) => setCreateTickets(e.target.value)} placeholder="e.g. 500" />
                
                {walletAddress ? (
                  <ShimmerButton onClick={handleCreateEvent} disabled={isCreating} shimmerColor="#fbbf24" className="w-full">
                    {isCreating ? <><SpinnerIcon /> Creating...</> : <><TicketIcon /> Create Event</>}
                  </ShimmerButton>
                ) : (
                  <button
                    onClick={onConnect}
                    disabled={isConnecting}
                    className="w-full rounded-xl border border-dashed border-[#fbbf24]/20 bg-[#fbbf24]/[0.03] py-4 text-sm text-[#fbbf24]/60 hover:border-[#fbbf24]/30 hover:text-[#fbbf24]/80 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    Connect wallet to create events
                  </button>
                )}
              </div>
            )}

            {/* Buy Ticket */}
            {activeTab === "my-tickets" && (
              <div className="space-y-5">
                <MethodSignature name="buy_ticket" params="(buyer, event_id, qty)" color="#34d399" />
                
                {walletAddress ? (
                  <>
                    <div className="space-y-4">
                      <Input label="Event ID" type="number" value={buyEventId} onChange={(e) => setBuyEventId(e.target.value)} placeholder="e.g. 0" />
                      <Input label="Quantity" type="number" value={buyQuantity} onChange={(e) => setBuyQuantity(e.target.value)} placeholder="e.g. 2" min="1" />
                    </div>
                    <ShimmerButton onClick={handleBuyTicket} disabled={isBuying} shimmerColor="#34d399" className="w-full">
                      {isBuying ? <><SpinnerIcon /> Processing...</> : <><TicketIcon /> Buy Tickets</>}
                    </ShimmerButton>
                  </>
                ) : (
                  <button
                    onClick={onConnect}
                    disabled={isConnecting}
                    className="w-full rounded-xl border border-dashed border-[#34d399]/20 bg-[#34d399]/[0.03] py-4 text-sm text-[#34d399]/60 hover:border-[#34d399]/30 hover:text-[#34d399]/80 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    Connect wallet to buy tickets
                  </button>
                )}

                {/* My Tickets */}
                {walletAddress && (
                  <div className="pt-4 border-t border-white/[0.06]">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-white/70">My Tickets</h4>
                      <button 
                        onClick={loadMyTickets}
                        disabled={isLoadingTickets}
                        className="p-1.5 rounded-lg border border-white/[0.06] hover:border-white/[0.1] transition-all text-white/40"
                      >
                        <RefreshIcon />
                      </button>
                    </div>
                    
                    {isLoadingTickets ? (
                      <div className="flex items-center justify-center py-4">
                        <SpinnerIcon />
                        <span className="ml-2 text-sm text-white/50">Loading...</span>
                      </div>
                    ) : myEvents.length === 0 ? (
                      <p className="text-sm text-white/30 text-center py-4">No tickets yet. Browse events to get started!</p>
                    ) : (
                      <div className="space-y-2">
                        {myEvents.map((event) => (
                          <div key={event.id} className="flex items-center justify-between p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                            <div>
                              <p className="text-sm text-white/80">{event.name}</p>
                              <p className="text-xs text-white/40">Event #{event.id}</p>
                            </div>
                            <Badge variant="success">{myTicketCounts.get(event.id)} tickets</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Transfer */}
            {activeTab === "transfer" && (
              <div className="space-y-5">
                <MethodSignature name="transfer_ticket" params="(from, to, event_id, qty)" color="#4fc3f7" />
                
                <Input label="Recipient Address" value={transferTo} onChange={(e) => setTransferTo(e.target.value)} placeholder="G..." />
                <Input label="Event ID" type="number" value={transferEventId} onChange={(e) => setTransferEventId(e.target.value)} placeholder="e.g. 0" />
                <Input label="Quantity" type="number" value={transferQuantity} onChange={(e) => setTransferQuantity(e.target.value)} placeholder="e.g. 1" min="1" />

                {walletAddress ? (
                  <ShimmerButton onClick={handleTransfer} disabled={isTransferring} shimmerColor="#4fc3f7" className="w-full">
                    {isTransferring ? <><SpinnerIcon /> Transferring...</> : <><SendIcon /> Transfer Tickets</>}
                  </ShimmerButton>
                ) : (
                  <button
                    onClick={onConnect}
                    disabled={isConnecting}
                    className="w-full rounded-xl border border-dashed border-[#4fc3f7]/20 bg-[#4fc3f7]/[0.03] py-4 text-sm text-[#4fc3f7]/60 hover:border-[#4fc3f7]/30 hover:text-[#4fc3f7]/80 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    Connect wallet to transfer tickets
                  </button>
                )}

                {/* Burn Tickets */}
                <div className="pt-4 border-t border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-3">
                    <FireIcon />
                    <h4 className="text-sm font-medium text-white/70">Burn Tickets (Check-in)</h4>
                  </div>
                  <div className="space-y-3">
                    <Input label="Event ID" type="number" value={burnEventId} onChange={(e) => setBurnEventId(e.target.value)} placeholder="e.g. 0" />
                    <Input label="Quantity" type="number" value={burnQuantity} onChange={(e) => setBurnQuantity(e.target.value)} placeholder="e.g. 1" min="1" />
                    
                    {walletAddress ? (
                      <button
                        onClick={handleBurn}
                        disabled={isBurning}
                        className="w-full rounded-xl border border-[#f87171]/20 bg-[#f87171]/[0.03] py-3 text-sm text-[#f87171]/60 hover:border-[#f87171]/30 hover:text-[#f87171]/80 active:scale-[0.99] transition-all disabled:opacity-50"
                      >
                        {isBurning ? <><SpinnerIcon /> Burning...</> : <><FireIcon /> Burn Tickets</>}
                      </button>
                    ) : (
                      <button
                        onClick={onConnect}
                        disabled={isConnecting}
                        className="w-full rounded-xl border border-dashed border-[#f87171]/20 bg-[#f87171]/[0.03] py-4 text-sm text-[#f87171]/60 hover:border-[#f87171]/30 hover:text-[#f87171]/80 active:scale-[0.99] transition-all disabled:opacity-50"
                      >
                        Connect wallet to burn tickets
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.04] px-6 py-3 flex items-center justify-between">
            <p className="text-[10px] text-white/15">Event Ticketing &middot; Soroban</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/15">Permissionless</span>
              <span className="h-1 w-1 rounded-full bg-[#34d399]" />
              <span className="text-[10px] text-white/15">No Admin</span>
            </div>
          </div>
        </AnimatedCard>
      </Spotlight>
    </div>
  );
}
