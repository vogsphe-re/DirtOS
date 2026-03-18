pub mod greet;
// Re-export everything so macro-generated symbols (__cmd__*, __specta__fn__*)
// are visible at the `commands::` path used by collect_commands! and invoke_handler.
pub use greet::*;
