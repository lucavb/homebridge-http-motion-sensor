import requests  # Add requests for HTTP client

if __name__ == "__main__":
    host = "localhost"
    port = 10300
    endpoint = "/motion"
    url = f"http://{host}:{port}{endpoint}"
    try:
        response = requests.get(url)
        print(f"GET {url} status: {response.status_code}, response: {response.text}")
    except Exception as e:
        print(f"Error making GET request: {e}")
    # Exit after the request
    exit(0)
