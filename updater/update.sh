#!/bin/bash
# Devora Updater for macOS/Linux
# Usage: ./update.sh

set -e

GITHUB_REPO="rucnyz/devora"
GITHUB_API="https://api.github.com/repos/$GITHUB_REPO/releases/latest"

# Get script directory (where devora is located)
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION_FILE="$APP_DIR/VERSION"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  Devora Updater${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
}

get_current_version() {
    if [ -f "$VERSION_FILE" ]; then
        cat "$VERSION_FILE" | tr -d '[:space:]'
    else
        echo "0.0.0"
    fi
}

# Compare versions: returns 0 if equal, 1 if first > second, 2 if first < second
compare_versions() {
    local v1="${1#v}"
    local v2="${2#v}"

    IFS='.' read -ra V1 <<< "$v1"
    IFS='.' read -ra V2 <<< "$v2"

    local max=$((${#V1[@]} > ${#V2[@]} ? ${#V1[@]} : ${#V2[@]}))

    for ((i=0; i<max; i++)); do
        local n1=${V1[$i]:-0}
        local n2=${V2[$i]:-0}
        if ((n1 < n2)); then
            echo "2"
            return
        elif ((n1 > n2)); then
            echo "1"
            return
        fi
    done
    echo "0"
}

get_platform_asset() {
    local os=$(uname -s)
    local arch=$(uname -m)

    if [ "$os" = "Darwin" ]; then
        if [ "$arch" = "arm64" ]; then
            echo "devora-macos-arm64.zip"
        else
            echo "devora-macos-x64.zip"
        fi
    else
        echo "devora-linux-x64.zip"
    fi
}

download_with_progress() {
    local url="$1"
    local dest="$2"

    echo -e "${YELLOW}Downloading...${NC}"

    if command -v curl &> /dev/null; then
        curl -L -# -H "User-Agent: Devora-Updater" -o "$dest" "$url"
    elif command -v wget &> /dev/null; then
        wget --header="User-Agent: Devora-Updater" -q --show-progress -O "$dest" "$url"
    else
        echo -e "${RED}Error: curl or wget is required${NC}"
        exit 1
    fi

    echo -e "${GREEN}Download complete!${NC}"
}

install_update() {
    local extracted_dir="$1"

    echo -e "${YELLOW}Installing update...${NC}"

    # Find source directory (might be in a subdirectory)
    local source_dir="$extracted_dir"
    local entries=($(ls "$extracted_dir"))

    if [ ${#entries[@]} -eq 1 ] && [ -d "$extracted_dir/${entries[0]}" ]; then
        source_dir="$extracted_dir/${entries[0]}"
    fi

    # Paths
    local new_exe="$source_dir/devora"
    local new_dist="$source_dir/dist"
    local new_version="$source_dir/VERSION"

    local current_exe="$APP_DIR/devora"
    local current_dist="$APP_DIR/dist"
    local backup_exe="$APP_DIR/devora.old"

    # Backup current executable
    if [ -f "$current_exe" ]; then
        [ -f "$backup_exe" ] && rm -f "$backup_exe"
        mv "$current_exe" "$backup_exe"
        echo "  Backed up devora"
    fi

    # Copy new executable
    if [ -f "$new_exe" ]; then
        cp "$new_exe" "$current_exe"
        chmod +x "$current_exe"
        echo -e "  ${GREEN}Updated devora${NC}"
    fi

    # Copy new dist folder
    if [ -d "$new_dist" ]; then
        [ -d "$current_dist" ] && rm -rf "$current_dist"
        cp -r "$new_dist" "$current_dist"
        echo -e "  ${GREEN}Updated dist/${NC}"
    fi

    # Copy VERSION file
    if [ -f "$new_version" ]; then
        cp "$new_version" "$VERSION_FILE"
        echo -e "  ${GREEN}Updated VERSION${NC}"
    fi

    # Clean up backup
    [ -f "$backup_exe" ] && rm -f "$backup_exe"

    echo -e "${GREEN}Installation complete!${NC}"
}

# Main
print_header

current_version=$(get_current_version)
echo "Current version: $current_version"
echo -e "${YELLOW}Checking for updates...${NC}"
echo ""

# Get latest release
release_json=$(curl -s -H "Accept: application/vnd.github.v3+json" -H "User-Agent: Devora-Updater" "$GITHUB_API")

if [ -z "$release_json" ] || echo "$release_json" | grep -q '"message"'; then
    echo -e "${RED}Could not check for updates. Please try again later.${NC}"
    exit 1
fi

latest_version=$(echo "$release_json" | grep -o '"tag_name":\s*"[^"]*"' | head -1 | sed 's/"tag_name":\s*"v\{0,1\}\([^"]*\)"/\1/')

echo "Latest version:  $latest_version"

comparison=$(compare_versions "$current_version" "$latest_version")
if [ "$comparison" != "2" ]; then
    echo ""
    echo -e "${GREEN}You are already on the latest version!${NC}"
    exit 0
fi

echo ""
echo -e "${CYAN}New version available: $current_version -> $latest_version${NC}"

# Find platform asset
asset_name=$(get_platform_asset)
download_url=$(echo "$release_json" | grep -o "\"browser_download_url\":\s*\"[^\"]*$asset_name\"" | sed 's/"browser_download_url":\s*"\([^"]*\)"/\1/')

if [ -z "$download_url" ]; then
    echo -e "${RED}No download available for your platform ($asset_name)${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Downloading $asset_name...${NC}"

# Create temp directory
temp_dir=$(mktemp -d)
zip_path="$temp_dir/$asset_name"
extract_dir="$temp_dir/extracted"

cleanup() {
    [ -d "$temp_dir" ] && rm -rf "$temp_dir"
}
trap cleanup EXIT

# Download
download_with_progress "$download_url" "$zip_path"

# Extract
echo -e "${YELLOW}Extracting...${NC}"
mkdir -p "$extract_dir"
unzip -q "$zip_path" -d "$extract_dir"
echo -e "${GREEN}Extraction complete!${NC}"

# Install
install_update "$extract_dir"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Update successful!${NC}"
echo -e "${GREEN}  Please restart Devora to use the new version.${NC}"
echo -e "${GREEN}========================================${NC}"
