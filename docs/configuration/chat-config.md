# Chat Configuration

## Overview

The chat configuration enables the TAK adapter to transform Catalyst platform messages into TAK-compatible GeoChat messages. This configuration is essential for enabling communication between Catalyst and TAK systems.

## Configuration Structure

Chat configuration is defined under the `[consumer.chat.cots]` section in your TOML configuration file. Here's a breakdown of the key components:

### Basic Configuration

```toml
[consumer.chat.cots]
recipient = "detail.chat.id"          # Path to extract recipient information
message_id = "detail.chat.messageId"  # Unique identifier for the message
message_template = "{time}: {text} (to:{to})"  # Template for message formatting
```

### Message Variables

Message variables are defined under `[consumer.chat.cots.message_vars]` and map template placeholders to data paths:

```toml
[consumer.chat.cots.message_vars]
source = "detail.remarks.source"  # Who sent the message
to = "detail.remarks.to"         # Message recipient
time = "detail.remarks.time"     # Message timestamp
text = "detail.remarks.text"     # Actual message content
```

## Constraints and Requirements

1. **Required Fields**:

   - `recipient`: Path to extract chat room/recipient information
   - `message_id`: Path to extract unique message identifier
   - `message_template`: Template string with variable placeholders
   - `message_vars`: Mapping of template variables to data paths

2. **Message Template Variables**:

   - Must be enclosed in curly braces: `{variable_name}`
   - Must have corresponding entries in `message_vars`
   - Common variables: `{time}`, `{text}`, `{to}`, `{source}`

3. **Data Structure**:
   - Input data must match the paths specified in the configuration
   - Messages are deduplicated based on `message_id`
   - Missing required fields will cause message processing to be skipped

## Default Values

- Default latitude: -64.0107 (if `tak.catalyst_lat` not specified)
- Default longitude: -59.452 (if `tak.catalyst_lon` not specified)
- Default sender UID: Uses `consumer.parser.latestTelemetry.overwrite.callsign` or falls back to `tak.callsign`
- Message staleness: 7 days from creation

## Example Configuration

```toml
[consumer.chat.cots]
recipient = "detail.chat.id"
message_id = "detail.chat.messageId"
message_template = "{time}: {text} (to:{to})"

[consumer.chat.cots.message_vars]
source = "detail.remarks.source"
to = "detail.remarks.to"
time = "detail.remarks.time"
text = "detail.remarks.text"
```

## Message Flow

1. Incoming JSON data is processed according to the configuration
2. Message variables are extracted using the specified paths
3. Template is populated with extracted variables
4. A CoT (Cursor on Target) message is generated with:
   - Unique identifier combining sender, recipient, and message ID
   - Point information (lat/lon)
   - Chat group details
   - Formatted message content
5. Messages are deduplicated using local storage
6. Generated CoT messages are sent to the TAK server

## Troubleshooting

Common issues to watch for:

- Missing or undefined data paths in incoming messages
- Template variables without corresponding `message_vars` entries
- Incorrect path specifications in configuration
- Duplicate message IDs
