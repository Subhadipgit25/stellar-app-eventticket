#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Map, String, Symbol, Vec};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    EventIds,              // Vec<u32> - all event IDs
    Event(u32),            // Event struct
    Tickets(u32, Address), // (event_id, owner) -> ticket count
}

#[contracttype]
#[derive(Clone)]
pub struct Event {
    pub id: u32,
    pub name: String,
    pub description: String,
    pub date: u64, // timestamp
    pub location: String,
    pub total_tickets: u32,
    pub tickets_sold: u32,
    pub created_at: u64,
}

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    /// Initialize the contract - sets up empty event list
    pub fn init(env: Env) {
        let event_ids: Vec<u32> = Vec::new(&env);
        env.storage().instance().set(&DataKey::EventIds, &event_ids);
    }

    /// Create a new event - PERMISSIONLESS: anyone can create events
    pub fn create_event(
        env: Env,
        creator: Address,
        name: String,
        description: String,
        date: u64,
        location: String,
        total_tickets: u32,
    ) -> u32 {
        creator.require_auth();

        // Validate inputs
        assert!(total_tickets > 0, "total_tickets must be > 0");
        assert!(
            date > env.ledger().timestamp(),
            "event date must be in the future"
        );

        // Get next event ID
        let event_ids: Vec<u32> = env.storage().instance().get(&DataKey::EventIds).unwrap();
        let event_id = event_ids.len();

        // Create event
        let event = Event {
            id: event_id,
            name,
            description,
            date,
            location,
            total_tickets,
            tickets_sold: 0,
            created_at: env.ledger().timestamp(),
        };

        // Store event
        env.storage()
            .instance()
            .set(&DataKey::Event(event_id), &event);

        // Add to event list
        let mut updated_ids = event_ids;
        updated_ids.push_back(event_id);
        env.storage()
            .instance()
            .set(&DataKey::EventIds, &updated_ids);

        event_id
    }

    /// Buy/Claim tickets for an event - PERMISSIONLESS: anyone can buy
    pub fn buy_ticket(env: Env, buyer: Address, event_id: u32, quantity: u32) {
        buyer.require_auth();
        assert!(quantity > 0, "quantity must be > 0");

        // Get event
        let event: Event = env
            .storage()
            .instance()
            .get(&DataKey::Event(event_id))
            .expect("event not found");

        // Check event hasn't passed
        assert!(
            event.date > env.ledger().timestamp(),
            "event has already occurred"
        );

        // Check availability
        let available = event.total_tickets - event.tickets_sold;
        assert!(available >= quantity, "not enough tickets available");

        // Update event tickets_sold
        let mut updated_event = event;
        updated_event.tickets_sold += quantity;
        env.storage()
            .instance()
            .set(&DataKey::Event(event_id), &updated_event);

        // Update buyer's ticket count
        let mut tickets: Map<(u32, Address), u32> = env
            .storage()
            .instance()
            .get(&DataKey::Tickets(event_id, buyer.clone()))
            .unwrap_or(Map::new(&env));
        let current = tickets.get((event_id, buyer.clone())).unwrap_or(0);
        tickets.set((event_id, buyer.clone()), current + quantity);
        env.storage()
            .instance()
            .set(&DataKey::Tickets(event_id, buyer), &tickets);

        // Emit event
        env.events()
            .publish((Symbol::new(&env, "ticket_bought"),), (event_id, quantity));
    }

    /// Transfer tickets to another address - PERMISSIONLESS transfer
    pub fn transfer_ticket(env: Env, from: Address, to: Address, event_id: u32, quantity: u32) {
        from.require_auth();
        assert!(quantity > 0, "quantity must be > 0");
        assert!(!from.eq(&to), "cannot transfer to yourself");

        // Get sender's tickets
        let mut from_tickets: Map<(u32, Address), u32> = env
            .storage()
            .instance()
            .get(&DataKey::Tickets(event_id, from.clone()))
            .unwrap_or(Map::new(&env));

        let from_balance = from_tickets.get((event_id, from.clone())).unwrap_or(0);
        assert!(from_balance >= quantity, "insufficient tickets to transfer");

        // Deduct from sender
        if from_balance == quantity {
            from_tickets.remove((event_id, from.clone()));
        } else {
            from_tickets.set((event_id, from.clone()), from_balance - quantity);
        }
        env.storage()
            .instance()
            .set(&DataKey::Tickets(event_id, from.clone()), &from_tickets);

        // Add to receiver
        let mut to_tickets: Map<(u32, Address), u32> = env
            .storage()
            .instance()
            .get(&DataKey::Tickets(event_id, to.clone()))
            .unwrap_or(Map::new(&env));
        let to_balance = to_tickets.get((event_id, to.clone())).unwrap_or(0);
        to_tickets.set((event_id, to.clone()), to_balance + quantity);
        env.storage()
            .instance()
            .set(&DataKey::Tickets(event_id, to.clone()), &to_tickets);

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "ticket_transferred"),),
            (event_id, quantity, from, to),
        );
    }

    /// Get event details
    pub fn get_event(env: Env, event_id: u32) -> Option<Event> {
        env.storage().instance().get(&DataKey::Event(event_id))
    }

    /// Get all events
    pub fn get_all_events(env: Env) -> Vec<Event> {
        let event_ids: Vec<u32> = env.storage().instance().get(&DataKey::EventIds).unwrap();
        let mut events: Vec<Event> = Vec::new(&env);

        for i in 0..event_ids.len() {
            let id = event_ids.get(i).unwrap();
            if let Some(event) = env
                .storage()
                .instance()
                .get::<_, Event>(&DataKey::Event(id))
            {
                events.push_back(event);
            }
        }
        events
    }

    /// Get ticket count for an address and event
    pub fn get_ticket_count(env: Env, owner: Address, event_id: u32) -> u32 {
        let tickets: Map<(u32, Address), u32> = env
            .storage()
            .instance()
            .get(&DataKey::Tickets(event_id, owner.clone()))
            .unwrap_or(Map::new(&env));
        tickets.get((event_id, owner)).unwrap_or(0)
    }

    /// Get tickets remaining for an event
    pub fn get_tickets_remaining(env: Env, event_id: u32) -> u32 {
        let event: Event = env
            .storage()
            .instance()
            .get(&DataKey::Event(event_id))
            .expect("event not found");
        event.total_tickets - event.tickets_sold
    }

    /// Burn tickets (e.g., at event check-in) - anyone can call, ticket owner burns their own
    pub fn burn_ticket(env: Env, owner: Address, event_id: u32, quantity: u32) {
        owner.require_auth();
        assert!(quantity > 0, "quantity must be > 0");

        let mut tickets: Map<(u32, Address), u32> = env
            .storage()
            .instance()
            .get(&DataKey::Tickets(event_id, owner.clone()))
            .unwrap_or(Map::new(&env));

        let balance = tickets.get((event_id, owner.clone())).unwrap_or(0);
        assert!(balance >= quantity, "insufficient tickets to burn");

        if balance == quantity {
            tickets.remove((event_id, owner.clone()));
        } else {
            tickets.set((event_id, owner.clone()), balance - quantity);
        }
        env.storage()
            .instance()
            .set(&DataKey::Tickets(event_id, owner.clone()), &tickets);

        env.events()
            .publish((Symbol::new(&env, "ticket_burned"),), (event_id, quantity));
    }
}

mod test;
