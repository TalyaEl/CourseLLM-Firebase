import requests
import json

# The base URL for the running FastAPI application
BASE_URL = "http://localhost:8000"

# The endpoint to test
ANALYZE_ENDPOINT = f"{BASE_URL}/analyze-message"

# A list of test payloads to send to the endpoint
TEST_PAYLOADS = [
    {
        "threadId": "thread-1",
        "messageText": "Help me debug this code",
        "courseId": "course-1",
    },
    {
        "threadId": "thread-2",
        "messageText": "What is a variable?",
        "courseId": "course-2",
    },
    {
        "threadId": "thread-3",
        "messageText": "I need help with a complex data structure in Python.",
        "courseId": "course-3",
    },
]

def run_verification_test():
    """
    Sends a series of test payloads to the /analyze-message endpoint and prints the results.
    """
    print("--- Starting Feature Verification --- C-V-S-Test-Harness ---")
    
    for payload in TEST_PAYLOADS:
        try:
            print(f"\n>>> Sending Input:\n{json.dumps(payload, indent=2)}")
            
            response = requests.post(ANALYZE_ENDPOINT, json=payload)
            response.raise_for_status()  # Raise an exception for bad status codes (4xx or 5xx)
            
            response_data = response.json()
            
            print(f"<<< Received Output:\n{json.dumps(response_data, indent=2)}")

        except requests.exceptions.RequestException as e:
            print(f"\n--- ERROR: Could not connect to the server. ---")
            print(f"Please make sure the FastAPI server is running at {BASE_URL}.")
            print(f"Error details: {e}")
            break  # Exit the loop if the server is not available

    print("\n--- Verification Complete ---")

if __name__ == "__main__":
    run_verification_test()
