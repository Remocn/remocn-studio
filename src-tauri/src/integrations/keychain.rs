use keyring::{Entry, Error as KeyringError};

const KEYCHAIN_SERVICE: &str = "com.remocn.remocn-studio";

pub fn reference_for(connection_id: &str) -> String {
    format!("integration:{connection_id}")
}

fn entry(reference: &str) -> Result<Entry, String> {
    Entry::new(KEYCHAIN_SERVICE, reference).map_err(refused)
}

#[cfg(target_os = "macos")]
fn refused(err: KeyringError) -> String {
    format!("The keychain refused: {err}")
}

#[cfg(not(target_os = "macos"))]
fn refused(err: KeyringError) -> String {
    format!("The system keyring refused: {err}")
}

pub fn store(reference: &str, secret: &str) -> Result<(), String> {
    entry(reference)?.set_password(secret).map_err(refused)
}

pub fn read(reference: &str) -> Result<Option<String>, String> {
    match entry(reference)?.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(err) => Err(refused(err)),
    }
}

pub fn clear(reference: &str) -> Result<(), String> {
    match entry(reference)?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(err) => Err(refused(err)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_reference_names_the_connection_it_belongs_to() {
        assert_eq!(reference_for("cn_1"), "integration:cn_1");
        assert_ne!(reference_for("cn_1"), reference_for("cn_2"));
    }

    #[test]
    fn a_reference_never_collides_with_the_account_token() {
        assert_ne!(reference_for("session-token"), "session-token");
    }
}
