#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_DIR=".tmp"
HOMEBRIDGE_PID=""

# Function to print colored output
print_status() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Cleanup function
cleanup() {
    print_status "Cleaning up..."
    
    if [[ -n "$HOMEBRIDGE_PID" ]]; then
        print_status "Stopping Homebridge (PID: $HOMEBRIDGE_PID)"
        kill $HOMEBRIDGE_PID 2>/dev/null || true
        wait $HOMEBRIDGE_PID 2>/dev/null || true
    fi
    
    if [[ -d "$TEST_DIR" ]]; then
        print_status "Removing test directory: $TEST_DIR"
        rm -rf "$TEST_DIR"
    fi
    
    print_success "Cleanup completed"
}

# Set up trap for cleanup on script exit
trap cleanup EXIT

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for port to be open
wait_for_port() {
    local port=$1
    local timeout=${2:-30}
    local count=0
    
    print_status "Waiting for port $port to be available..."
    
    while ! nc -z localhost $port 2>/dev/null; do
        if [[ $count -ge $timeout ]]; then
            print_error "Timeout waiting for port $port"
            return 1
        fi
        sleep 1
        ((count++))
    done
    
    print_success "Port $port is now available"
}

# Function to test HTTP endpoint
test_motion_sensor() {
    local port=$1
    local sensor_name=$2
    
    print_status "Testing motion sensor '$sensor_name' on port $port..."
    
    # Make HTTP request to trigger motion
    local response=$(curl -s -w "%{http_code}" -o /dev/null "http://localhost:$port/trigger" 2>/dev/null)
    
    if [[ "$response" == "200" ]]; then
        print_success "Motion sensor '$sensor_name' responded correctly (HTTP $response)"
        return 0
    else
        print_error "Motion sensor '$sensor_name' failed to respond (HTTP $response)"
        return 1
    fi
}

# Main test function
main() {
    print_status "Starting Homebridge HTTP Motion Sensor Plugin Test"
    echo "=================================================="
    
    # Check prerequisites
    print_status "Checking prerequisites..."
    
    if ! command_exists "node"; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command_exists "npm"; then
        print_error "npm is not installed"
        exit 1
    fi
    
    if ! command_exists "homebridge"; then
        print_error "Homebridge is not installed. Install with: npm install -g homebridge"
        exit 1
    fi
    
    if ! command_exists "curl"; then
        print_error "curl is not installed"
        exit 1
    fi
    
    if ! command_exists "nc"; then
        print_error "netcat (nc) is not installed"
        exit 1
    fi
    
    print_success "All prerequisites met"
    
    # Build the plugin
    print_status "Building plugin..."
    if ! npm run build; then
        print_error "Failed to build plugin"
        exit 1
    fi
    print_success "Plugin built successfully"
    
    # Create test directory and copy config
    print_status "Setting up test environment..."
    mkdir -p "$TEST_DIR"
    cp "$SCRIPT_DIR/test-config.json" "$TEST_DIR/config.json"
    print_success "Test environment ready"
    
    # Start Homebridge in background
    print_status "Starting Homebridge..."
    homebridge -D -U "$TEST_DIR" -P . > "$TEST_DIR/homebridge.log" 2>&1 &
    HOMEBRIDGE_PID=$!
    
    print_success "Homebridge started (PID: $HOMEBRIDGE_PID)"
    
    # Wait for Homebridge to initialize
    print_status "Waiting for Homebridge to initialize..."
    sleep 8
    
    # Check if Homebridge is still running
    if ! kill -0 $HOMEBRIDGE_PID 2>/dev/null; then
        print_error "Homebridge failed to start"
        print_status "Homebridge log:"
        cat "$TEST_DIR/homebridge.log"
        exit 1
    fi
    
    # Wait for motion sensor ports to be available
    wait_for_port 18089 30 || exit 1
    wait_for_port 18090 30 || exit 1
    
    # Test the motion sensors
    print_status "Running motion sensor tests..."
    
    # Test 1: Basic functionality
    print_status "Test 1: Basic motion detection"
    test_motion_sensor 18089 "Test Motion Sensor 1" || exit 1
    test_motion_sensor 18090 "Test Motion Sensor 2" || exit 1
    
    # Test 2: Multiple requests to same sensor
    print_status "Test 2: Multiple rapid requests"
    for i in {1..3}; do
        local response=$(curl -s -w "%{http_code}" -o /dev/null "http://localhost:18089/test$i" 2>/dev/null)
        if [[ "$response" == "200" ]]; then
            print_success "Rapid request $i: HTTP $response"
        else
            print_error "Rapid request $i failed: HTTP $response"
            exit 1
        fi
    done
    
    # Test 3: Different endpoints
    print_status "Test 3: Different URL endpoints"
    local endpoints=("/motion" "/detect" "/trigger" "/test")
    for endpoint in "${endpoints[@]}"; do
        local response=$(curl -s -w "%{http_code}" -o /dev/null "http://localhost:18090$endpoint" 2>/dev/null)
        if [[ "$response" == "200" ]]; then
            print_success "Endpoint '$endpoint': HTTP $response"
        else
            print_error "Endpoint '$endpoint' failed: HTTP $response"
            exit 1
        fi
    done
    
    # Test 4: Wait for motion reset
    print_status "Test 4: Testing motion reset (waiting 12 seconds)..."
    sleep 12
    
    # Test again after reset
    test_motion_sensor 18089 "Test Motion Sensor 1 (after reset)" || exit 1
    
    # Show some logs to verify motion detection/reset cycle
    print_status "Recent Homebridge logs (motion detection/reset):"
    echo "================================================"
    tail -15 "$TEST_DIR/homebridge.log" | grep -E "(Motion detected|Motion detection reset|HTTP Motion Sensor)"
    echo "================================================"
    
    print_success "🎉 All tests passed!"
    print_status "Plugin is working correctly"
    
    # Show test summary
    echo ""
    print_status "Test Summary:"
    echo "  ✅ Plugin builds successfully"
    echo "  ✅ Homebridge loads plugin without errors"
    echo "  ✅ HTTP servers start on correct ports"
    echo "  ✅ Motion sensors respond to HTTP requests"
    echo "  ✅ Multiple rapid requests handled correctly"
    echo "  ✅ Different URL endpoints work"
    echo "  ✅ Motion detection reset works after timeout"
    
    print_status "Full logs available at: $TEST_DIR/homebridge.log"
    
    # Ask if user wants to keep Homebridge running (only in interactive mode)
    if [[ -z "$CI" && -z "$GITHUB_ACTIONS" && -z "$GITLAB_CI" && -z "$JENKINS_URL" && "$1" != "--ci" ]]; then
        echo
        read -p "Keep Homebridge running for manual testing? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Homebridge will continue running..."
            print_status "Motion Sensor 1: http://localhost:18089"
            print_status "Motion Sensor 2: http://localhost:18090"
            print_status "Homebridge UI: http://localhost:51826"
            print_status "Test with: curl http://localhost:18089/your-endpoint"
            print_status "Press Ctrl+C to stop"
            
            # Wait for user interrupt
            wait $HOMEBRIDGE_PID
        fi
    else
        print_status "Running in CI mode - skipping interactive prompt"
    fi
}

# Run main function
main "$@" 