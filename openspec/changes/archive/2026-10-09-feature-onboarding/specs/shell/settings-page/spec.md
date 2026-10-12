## REMOVED Requirements

### Requirement: Behavior offers suggestions and privacy
**Reason**: Replay tips is replaced by the feature overview.
**Migration**: Use Explore Studio in the same Behavior section.

## ADDED Requirements

### Requirement: Behavior offers library suggestions, feature overview and privacy
Behavior SHALL offer a Suggestions group with the library-offer switch and an always-available Explore Studio button, and a Privacy group holding crash-report consent.

#### Scenario: Turning library suggestions off
- **WHEN** the switch is turned off
- **THEN** the preference is written down and a turn that ends no longer offers its media

#### Scenario: Opening the overview
- **WHEN** Explore Studio is pressed
- **THEN** the feature overview opens above Settings at its remembered chapter without resetting dismissal

