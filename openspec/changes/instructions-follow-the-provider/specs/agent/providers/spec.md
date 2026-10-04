## MODIFIED Requirements

### Requirement: The command-line tool is the person's own, resolved and never bundled

The studio SHALL locate each provider's command-line tool by its own environment override first, then the search path, then the usual install locations, SHALL never ship or update one, and SHALL check no version. A turn sent on a provider whose tool is not found SHALL fail the same way on all four providers: with that provider's own install sentence, and with the failure classed as a sign-in failure — something the person fixes outside the studio before sending again — never as an unknown error.

#### Scenario: An override is set

- **WHEN** the provider's environment override names a path
- **THEN** that path is used when it exists, and the provider counts as not installed when it does not — the override is never quietly overtaken by a copy found elsewhere

#### Scenario: A tool installed where a windowed app sees no path

- **WHEN** the tool is in one of the usual install directories but not on the path the app inherited
- **THEN** it is still found

#### Scenario: The tool is not on the machine

- **WHEN** no executable is found for a provider
- **THEN** its row reads that it is not installed and carries the command to install it, and a turn sent on that provider answers with the same sentence rather than a stack trace

#### Scenario: The same missing tool on any provider

- **WHEN** a turn is sent on any of the four providers and its tool is not found
- **THEN** the turn fails before anything is spawned, with the provider's install sentence and the same failure class whichever provider it is
- **AND** the chat's queue is held as for any turn that did not finish cleanly
