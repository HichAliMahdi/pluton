#!/bin/bash
# Pluton macOS Service Wrapper
# Ensures the system keychain is available before starting the Pluton daemon.
#
# When running as a LaunchDaemon (system-level), macOS does not provide a default
# keychain for the root user. This wrapper creates and unlocks a dedicated keychain
# so that @napi-rs/keyring can store and retrieve credentials.

set -e

# Ensure HOME points to root's actual home directory.
# When invoked via sudo, HOME may still reference the calling user's home,
# causing `security default-keychain` to fail with a permissions error.
export HOME=/var/root

KEYCHAIN_DIR="/var/root/Library/Keychains"
KEYCHAIN_PATH="${KEYCHAIN_DIR}/pluton.keychain-db"
KEYCHAIN_PASSWORD="pluton-service-keychain"

# Create keychain directory if needed
mkdir -p "${KEYCHAIN_DIR}"

# Create the Pluton keychain if it doesn't exist
if [ ! -f "${KEYCHAIN_PATH}" ]; then
    security create-keychain -p "${KEYCHAIN_PASSWORD}" "${KEYCHAIN_PATH}"
fi

# Unlock the keychain (required after every reboot)
security unlock-keychain -p "${KEYCHAIN_PASSWORD}" "${KEYCHAIN_PATH}"

# Disable auto-lock (timeout=0 means no auto-lock)
security set-keychain-settings "${KEYCHAIN_PATH}"

# Set as the default keychain and add to the search list
security list-keychains -d system -s "${KEYCHAIN_PATH}"
security default-keychain -s "${KEYCHAIN_PATH}"

# Execute the Pluton binary (replaces this process)
exec /opt/pluton/pluton
