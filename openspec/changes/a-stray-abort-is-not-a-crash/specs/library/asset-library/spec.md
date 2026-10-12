## MODIFIED Requirements

### Requirement: Footage too tall to seek previews from a proxy
A video asset taller than 1080 pixels SHALL have a 1080-line proxy made for it in the background, one asset at a time, and the decision SHALL be recorded on its manifest so it is never measured twice. A proxy SHALL live beside the asset's still, inside the asset's own folder, so deleting the asset takes it. A webview that cannot encode, and a file already at or under the target, SHALL both record the decision that no proxy is wanted. The preview serves the proxy; the export and a snapshot never do — see `preview/live-preview`.

#### Scenario: A 4K clip is saved
- **WHEN** a video taller than 1080 lines is in the library and the webview can encode
- **THEN** a proxy is made and filed against the asset
- **AND** the asset is usable from the moment it lands, streaming the original until the proxy exists

#### Scenario: The webview has no encoder
- **WHEN** the encoder is unavailable
- **THEN** the decision is recorded against the asset and no proxy is attempted again
- **AND** the original keeps playing

#### Scenario: The conversion fails
- **WHEN** reading, converting or filing the proxy fails
- **THEN** nothing is shown to the person and the asset keeps its original
- **AND** the step that gave up and the reason are written to the console
- **AND** where the reason has a cause of its own — the encoder's or the decoder's own words behind the library's message — the cause is written too

#### Scenario: An asset with a proxy is deleted
- **WHEN** the asset's folder is removed
- **THEN** its proxy goes with it, no copy of it having lived anywhere else
