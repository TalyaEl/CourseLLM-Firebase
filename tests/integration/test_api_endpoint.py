import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch

from app.main import app, get_db
from app.database import Base

# In-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override the get_db dependency to use the in-memory database
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

class TestAPIEndpoint(unittest.TestCase):
    def setUp(self):
        """Creates a new database session for each test function."""
        Base.metadata.create_all(bind=engine)
        self.db = TestingSessionLocal()
        self.client = TestClient(app)

    def tearDown(self):
        """Closes the database session after each test."""
        self.db.close()
        Base.metadata.drop_all(bind=engine)

    @patch('app.main.call_llm_for_analysis')
    def test_analyze_message_endpoint(self, mock_llm_call):
        """Tests the /analyze-message endpoint with a mocked LLM call."""
        # Mock the LLM call to return a specific analysis
        mock_llm_call.return_value = {"intent": "test_intent", "skills": ["python", "fastapi"]}

        # Define the request payload
        payload = {
            "threadId": "test_thread_123",
            "messageText": "Help me with FastAPI",
            "courseId": "test_course_456",
        }

        # Send a POST request to the endpoint
        response = self.client.post("/analyze-message", json=payload)

        # Assert that the request was successful
        self.assertEqual(response.status_code, 200)

        # Assert that the response structure matches the schema
        response_data = response.json()
        self.assertIn("uid", response_data)
        self.assertIn("thread_id", response_data)
        self.assertIn("message_id", response_data)
        self.assertIn("intent", response_data)
        self.assertIn("skills", response_data)

if __name__ == "__main__":
    unittest.main()
