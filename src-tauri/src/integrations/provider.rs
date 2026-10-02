use std::{future::Future, pin::Pin};

use super::keychain;

pub type Answering<'a, T> = Pin<Box<dyn Future<Output = Result<T, String>> + Send + 'a>>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Descriptor {
    pub id: &'static str,
    pub name: &'static str,
    pub authorization: Vec<&'static str>,
    pub capabilities: Vec<&'static str>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Checked {
    pub account: Option<String>,
    pub capabilities: Vec<String>,
}

pub trait Adapter: Send + Sync {
    fn describe(&self) -> Descriptor;

    fn check<'a>(&'a self, secret: Option<&'a str>) -> Answering<'a, Checked>;

    fn withdraw<'a>(&'a self, _secret: &'a str) -> Answering<'a, bool> {
        Box::pin(async { Ok(false) })
    }
}

pub trait Secrets: Send + Sync {
    fn store(&self, reference: &str, secret: &str) -> Result<(), String>;
    fn read(&self, reference: &str) -> Result<Option<String>, String>;
    fn clear(&self, reference: &str) -> Result<(), String>;
}

pub struct Keychain;

impl Secrets for Keychain {
    fn store(&self, reference: &str, secret: &str) -> Result<(), String> {
        keychain::store(reference, secret)
    }

    fn read(&self, reference: &str) -> Result<Option<String>, String> {
        keychain::read(reference)
    }

    fn clear(&self, reference: &str) -> Result<(), String> {
        keychain::clear(reference)
    }
}

#[derive(Default)]
pub struct Registry {
    adapters: Vec<Box<dyn Adapter>>,
}

impl Registry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn of(adapters: Vec<Box<dyn Adapter>>) -> Self {
        Self { adapters }
    }

    pub fn find(&self, id: &str) -> Option<&dyn Adapter> {
        self.adapters
            .iter()
            .map(|adapter| adapter.as_ref())
            .find(|adapter| adapter.describe().id == id)
    }

    pub fn catalogue(&self) -> Vec<Descriptor> {
        self.adapters
            .iter()
            .map(|adapter| adapter.describe())
            .collect()
    }
}

pub fn shipped() -> Registry {
    Registry::of(vec![
        Box::new(super::elevenlabs::ElevenLabs),
        Box::new(super::figma::Figma),
    ])
}

#[cfg(test)]
pub mod fake {
    use std::sync::{Mutex, MutexGuard};

    use super::{Adapter, Answering, Checked, Descriptor, Secrets};

    pub struct Sounds {
        pub accepts: Mutex<String>,
        pub account: Mutex<String>,
        pub reachable: Mutex<bool>,
        pub withdraws: bool,
    }

    impl Sounds {
        pub fn accepting(secret: &str) -> Self {
            Self {
                accepts: Mutex::new(secret.to_string()),
                account: Mutex::new("mine@sounds".to_string()),
                reachable: Mutex::new(true),
                withdraws: true,
            }
        }
    }

    impl Adapter for Sounds {
        fn describe(&self) -> Descriptor {
            Descriptor {
                id: "sounds",
                name: "Sounds",
                authorization: vec!["api-key"],
                capabilities: vec!["audio"],
            }
        }

        fn check<'a>(&'a self, secret: Option<&'a str>) -> Answering<'a, Checked> {
            Box::pin(async move {
                if !*self.reachable.lock().expect("the fake is not poisoned") {
                    return Err("Sounds could not be reached.".to_string());
                }

                let expected = self.accepts.lock().expect("the fake is not poisoned");
                match secret {
                    Some(given) if given == expected.as_str() => Ok(Checked {
                        account: Some(
                            self.account
                                .lock()
                                .expect("the fake is not poisoned")
                                .clone(),
                        ),
                        capabilities: vec!["audio".to_string()],
                    }),
                    _ => Err("Sounds rejected the key.".to_string()),
                }
            })
        }

        fn withdraw<'a>(&'a self, _secret: &'a str) -> Answering<'a, bool> {
            let withdraws = self.withdraws;
            Box::pin(async move { Ok(withdraws) })
        }
    }

    #[derive(Default)]
    pub struct Vault {
        held: Mutex<Vec<(String, String)>>,
        pub refuses: Mutex<bool>,
    }

    impl Vault {
        fn held(&self) -> MutexGuard<'_, Vec<(String, String)>> {
            self.held.lock().expect("the fake is not poisoned")
        }

        pub fn holds(&self, reference: &str) -> bool {
            self.held().iter().any(|(key, _)| key == reference)
        }

        pub fn count(&self) -> usize {
            self.held().len()
        }
    }

    impl Secrets for Vault {
        fn store(&self, reference: &str, secret: &str) -> Result<(), String> {
            if *self.refuses.lock().expect("the fake is not poisoned") {
                return Err("The system keyring refused: it is locked.".to_string());
            }

            let mut held = self.held();
            held.retain(|(key, _)| key != reference);
            held.push((reference.to_string(), secret.to_string()));
            Ok(())
        }

        fn read(&self, reference: &str) -> Result<Option<String>, String> {
            Ok(self
                .held()
                .iter()
                .find(|(key, _)| key == reference)
                .map(|(_, secret)| secret.clone()))
        }

        fn clear(&self, reference: &str) -> Result<(), String> {
            self.held().retain(|(key, _)| key != reference);
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{fake::Sounds, *};

    #[test]
    fn a_registry_with_nothing_in_it_offers_nothing() {
        let registry = Registry::new();

        assert!(registry.catalogue().is_empty());
        assert!(registry.find("sounds").is_none());
    }

    #[test]
    fn the_shipped_registry_offers_only_what_has_an_adapter() {
        let offered: Vec<&str> = shipped()
            .catalogue()
            .into_iter()
            .map(|one| one.id)
            .collect();

        assert_eq!(offered, vec!["elevenlabs", "figma"]);
        assert!(shipped().find("youtube").is_none());
        assert!(shipped().find("paper").is_none());
    }

    #[test]
    fn a_registered_adapter_is_findable_and_describes_itself() {
        let registry = Registry::of(vec![Box::new(Sounds::accepting("sk-1"))]);
        let catalogue = registry.catalogue();

        assert_eq!(catalogue.len(), 1);
        assert_eq!(catalogue[0].id, "sounds");
        assert_eq!(catalogue[0].authorization, vec!["api-key"]);
        assert!(registry.find("sounds").is_some());
        assert!(registry.find("figma").is_none());
    }

    #[tokio::test]
    async fn an_adapter_that_offers_no_withdrawal_says_so() {
        struct Silent;

        impl Adapter for Silent {
            fn describe(&self) -> Descriptor {
                Descriptor {
                    id: "silent",
                    name: "Silent",
                    authorization: vec!["api-key"],
                    capabilities: vec!["import"],
                }
            }

            fn check<'a>(&'a self, _secret: Option<&'a str>) -> Answering<'a, Checked> {
                Box::pin(async {
                    Ok(Checked {
                        account: None,
                        capabilities: vec!["import".to_string()],
                    })
                })
            }
        }

        let told = Silent.withdraw("sk-1").await.expect("withdrawal answers");

        assert!(!told);
    }
}
