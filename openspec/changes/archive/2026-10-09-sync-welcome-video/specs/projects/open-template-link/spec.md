## ADDED Requirements

### Requirement: The welcome link creates the current personalized thank-you video

The bundled `welcome-early-member` template SHALL contain the 570-frame, 30fps welcome video using a warm solid background, personalized kinetic typography and the early-member card. It SHALL NOT include the previous neural shader or confetti effect.

#### Scenario: A new welcome project
- **WHEN** an accepted link names `welcome-early-member`
- **THEN** the new project SHALL contain that video with the link's name, member number and dates
- **AND** its font dependency SHALL match the project's Remotion version

#### Scenario: A previous welcome project already exists
- **WHEN** the same link is opened using the updated application
- **THEN** a new project SHALL use the updated template
- **AND** existing project files SHALL remain unchanged
