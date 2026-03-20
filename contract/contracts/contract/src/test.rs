#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Env, String};

#[test]
fn test_init() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    client.init();

    let events = client.get_all_events();
    assert_eq!(events.len(), 0);
}

#[test]
fn test_create_event_permissionless() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    client.init();

    let creator1 = Address::generate(&env);
    let creator2 = Address::generate(&env);

    // Any address can create events - no admin needed
    let event_id1 = client.create_event(
        &creator1,
        &String::from_str(&env, "Tech Conference 2026"),
        &String::from_str(&env, "Annual tech conference"),
        &(env.ledger().timestamp() + 86400 * 30), // 30 days from now
        &String::from_str(&env, "San Francisco"),
        &100,
    );

    let event_id2 = client.create_event(
        &creator2,
        &String::from_str(&env, "Music Festival"),
        &String::from_str(&env, "Summer music festival"),
        &(env.ledger().timestamp() + 86400 * 60), // 60 days from now
        &String::from_str(&env, "Austin"),
        &500,
    );

    assert_eq!(event_id1, 0);
    assert_eq!(event_id2, 1);

    let event1 = client.get_event(&event_id1).unwrap();
    assert_eq!(event1.name, String::from_str(&env, "Tech Conference 2026"));
    assert_eq!(event1.total_tickets, 100);
    assert_eq!(event1.tickets_sold, 0);
}

#[test]
#[should_panic(expected = "event date must be in the future")]
fn test_create_event_past_date_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    client.init();

    let creator = Address::generate(&env);
    // Set date to 0 (epoch) which is definitely in the past
    client.create_event(
        &creator,
        &String::from_str(&env, "Past Event"),
        &String::from_str(&env, "This should fail"),
        &0, // Past date (epoch time is 1970)
        &String::from_str(&env, "Location"),
        &100,
    );
}

#[test]
fn test_buy_ticket_permissionless() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    client.init();

    let creator = Address::generate(&env);
    let buyer1 = Address::generate(&env);
    let buyer2 = Address::generate(&env);

    let event_id = client.create_event(
        &creator,
        &String::from_str(&env, "Concert"),
        &String::from_str(&env, "Live concert"),
        &(env.ledger().timestamp() + 86400),
        &String::from_str(&env, "NYC"),
        &100,
    );

    // Anyone can buy tickets - no permission needed
    client.buy_ticket(&buyer1, &event_id, &3);
    client.buy_ticket(&buyer2, &event_id, &5);
    client.buy_ticket(&buyer1, &event_id, &2); // buy more

    assert_eq!(client.get_ticket_count(&buyer1, &event_id), 5);
    assert_eq!(client.get_ticket_count(&buyer2, &event_id), 5);
    assert_eq!(client.get_tickets_remaining(&event_id), 90);
}

#[test]
#[should_panic(expected = "not enough tickets available")]
fn test_buy_ticket_exceeds_availability() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    client.init();

    let creator = Address::generate(&env);
    let buyer = Address::generate(&env);

    let event_id = client.create_event(
        &creator,
        &String::from_str(&env, "Limited Event"),
        &String::from_str(&env, "Only 5 tickets"),
        &(env.ledger().timestamp() + 86400),
        &String::from_str(&env, "Venue"),
        &5,
    );

    client.buy_ticket(&buyer, &event_id, &3);
    client.buy_ticket(&buyer, &event_id, &5); // This exceeds remaining
}

#[test]
fn test_transfer_ticket_permissionless() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    client.init();

    let creator = Address::generate(&env);
    let holder = Address::generate(&env);
    let recipient = Address::generate(&env);

    let event_id = client.create_event(
        &creator,
        &String::from_str(&env, "Party"),
        &String::from_str(&env, "VIP Party"),
        &(env.ledger().timestamp() + 86400),
        &String::from_str(&env, "Club"),
        &50,
    );

    client.buy_ticket(&holder, &event_id, &5);
    assert_eq!(client.get_ticket_count(&holder, &event_id), 5);

    // Transfer some tickets - holder initiates
    client.transfer_ticket(&holder, &recipient, &event_id, &2);

    assert_eq!(client.get_ticket_count(&holder, &event_id), 3);
    assert_eq!(client.get_ticket_count(&recipient, &event_id), 2);
}

#[test]
#[should_panic(expected = "insufficient tickets to transfer")]
fn test_transfer_ticket_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    client.init();

    let creator = Address::generate(&env);
    let holder = Address::generate(&env);
    let recipient = Address::generate(&env);

    let event_id = client.create_event(
        &creator,
        &String::from_str(&env, "Show"),
        &String::from_str(&env, "Comedy Show"),
        &(env.ledger().timestamp() + 86400),
        &String::from_str(&env, "Theater"),
        &30,
    );

    client.buy_ticket(&holder, &event_id, &2);
    client.transfer_ticket(&holder, &recipient, &event_id, &5); // Only has 2
}

#[test]
#[should_panic(expected = "cannot transfer to yourself")]
fn test_transfer_ticket_to_self_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    client.init();

    let creator = Address::generate(&env);
    let holder = Address::generate(&env);

    let event_id = client.create_event(
        &creator,
        &String::from_str(&env, "Event"),
        &String::from_str(&env, "Test"),
        &(env.ledger().timestamp() + 86400),
        &String::from_str(&env, "Here"),
        &10,
    );

    client.buy_ticket(&holder, &event_id, &2);
    client.transfer_ticket(&holder, &holder, &event_id, &1);
}

#[test]
fn test_burn_ticket() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    client.init();

    let creator = Address::generate(&env);
    let holder = Address::generate(&env);

    let event_id = client.create_event(
        &creator,
        &String::from_str(&env, "Gala"),
        &String::from_str(&env, "Charity Gala"),
        &(env.ledger().timestamp() + 86400),
        &String::from_str(&env, "Ballroom"),
        &200,
    );

    client.buy_ticket(&holder, &event_id, &10);
    assert_eq!(client.get_ticket_count(&holder, &event_id), 10);

    // Burn some tickets (e.g., at check-in)
    client.burn_ticket(&holder, &event_id, &3);
    assert_eq!(client.get_ticket_count(&holder, &event_id), 7);

    // Burn remaining
    client.burn_ticket(&holder, &event_id, &7);
    assert_eq!(client.get_ticket_count(&holder, &event_id), 0);
}

#[test]
#[should_panic(expected = "insufficient tickets to burn")]
fn test_burn_ticket_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    client.init();

    let creator = Address::generate(&env);
    let holder = Address::generate(&env);

    let event_id = client.create_event(
        &creator,
        &String::from_str(&env, "Event"),
        &String::from_str(&env, "Test"),
        &(env.ledger().timestamp() + 86400),
        &String::from_str(&env, "Place"),
        &20,
    );

    client.buy_ticket(&holder, &event_id, &2);
    client.burn_ticket(&holder, &event_id, &5); // Only has 2
}

#[test]
fn test_get_all_events() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    client.init();

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);

    // Multiple users create events
    client.create_event(
        &user1,
        &String::from_str(&env, "Event 1"),
        &String::from_str(&env, "Desc 1"),
        &(env.ledger().timestamp() + 86400),
        &String::from_str(&env, "Loc 1"),
        &100,
    );

    client.create_event(
        &user2,
        &String::from_str(&env, "Event 2"),
        &String::from_str(&env, "Desc 2"),
        &(env.ledger().timestamp() + 86400 * 2),
        &String::from_str(&env, "Loc 2"),
        &200,
    );

    client.create_event(
        &user3,
        &String::from_str(&env, "Event 3"),
        &String::from_str(&env, "Desc 3"),
        &(env.ledger().timestamp() + 86400 * 3),
        &String::from_str(&env, "Loc 3"),
        &50,
    );

    let events = client.get_all_events();
    assert_eq!(events.len(), 3);
    assert_eq!(
        events.get(0).unwrap().name,
        String::from_str(&env, "Event 1")
    );
    assert_eq!(
        events.get(1).unwrap().name,
        String::from_str(&env, "Event 2")
    );
    assert_eq!(
        events.get(2).unwrap().name,
        String::from_str(&env, "Event 3")
    );
}

#[test]
fn test_full_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    client.init();

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let charlie = Address::generate(&env);

    // Alice creates an event
    let event_id = client.create_event(
        &alice,
        &String::from_str(&env, "Blockchain Summit"),
        &String::from_str(&env, "Annual blockchain gathering"),
        &(env.ledger().timestamp() + 86400 * 90), // 90 days out
        &String::from_str(&env, "Dubai"),
        &1000,
    );

    // Bob buys 5 tickets
    client.buy_ticket(&bob, &event_id, &5);

    // Charlie buys 3 tickets
    client.buy_ticket(&charlie, &event_id, &3);

    // Bob transfers 2 tickets to Charlie
    client.transfer_ticket(&bob, &charlie, &event_id, &2);

    // Verify final balances
    assert_eq!(client.get_ticket_count(&bob, &event_id), 3);
    assert_eq!(client.get_ticket_count(&charlie, &event_id), 5);
    assert_eq!(client.get_tickets_remaining(&event_id), 992);

    // Get event details
    let event = client.get_event(&event_id).unwrap();
    assert_eq!(event.tickets_sold, 8);
    assert_eq!(event.total_tickets, 1000);
}
