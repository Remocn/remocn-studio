## MODIFIED Requirements

### Requirement: Only crashes are reported

Only an uncaught exception, an unhandled rejection, a panic in the core, or a render that throws SHALL be reported. A failure the studio expects and renders as a sentence — the sidecar being down, a folder that would not open, a renderer refusing an option — SHALL NOT be reported. An unhandled rejection that is only the echo of such a failure SHALL NOT be reported either: in the webview, the abort a media library raises from its own unawaited work after a conversion it has already failed for the studio.

#### Scenario: An expected failure

- **WHEN** an operation fails in a way the studio words for the person
- **THEN** the sentence is shown and nothing is sent

#### Scenario: An exception another handler took

- **WHEN** an uncaught exception is one the sidecar deliberately handles itself
- **THEN** the process is not exited out from under that handler by the reporter

#### Scenario: A proxy conversion fails mid-encode

- **WHEN** a background proxy conversion fails and frames still in flight inside the library reject with its abort
- **THEN** no report is sent for that abort
- **AND** the conversion's own failure is written to the console as the library requirement describes, and the asset keeps its original

#### Scenario: Any other unhandled rejection in the webview

- **WHEN** an unhandled rejection in the webview is not that abort
- **THEN** it is reported as before, when consent was given
