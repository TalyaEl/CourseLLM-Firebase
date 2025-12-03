import unittest
from unittest.mock import patch, MagicMock

from app.analysis_mapper import map_llm_response_to_message_analysis

class TestAnalysisLogic(unittest.TestCase):

    def test_map_llm_response_to_message_analysis_success(self):
        """Tests that the analysis mapping works as expected with valid data."""
        llm_analysis = {
            "intent": "test_intent",
            "skills": ["python", "fastapi"]
        }
        metadata = {
            "uid": "test_uid",
            "thread_id": "test_thread_id",
            "message_id": "test_message_id"
        }
        expected_output = {
            "intent": "test_intent",
            "skills": ["python", "fastapi"],
            "uid": "test_uid",
            "thread_id": "test_thread_id",
            "message_id": "test_message_id"
        }
        self.assertEqual(map_llm_response_to_message_analysis(llm_analysis, metadata), expected_output)

    def test_map_llm_response_to_message_analysis_empty_skills(self):
        """Tests that the analysis mapping works with an empty skills list."""
        llm_analysis = {
            "intent": "test_intent",
            "skills": []
        }
        metadata = {
            "uid": "test_uid",
            "thread_id": "test_thread_id",
            "message_id": "test_message_id"
        }
        expected_output = {
            "intent": "test_intent",
            "skills": [],
            "uid": "test_uid",
            "thread_id": "test_thread_id",
            "message_id": "test_message_id"
        }
        self.assertEqual(map_llm_response_to_message_analysis(llm_analysis, metadata), expected_output)

    def test_map_llm_response_to_message_analysis_missing_keys(self):
        """Tests that the analysis mapping handles missing keys gracefully."""
        llm_analysis = {
            "intent": "test_intent"
            # Missing 'skills'
        }
        metadata = {
            "uid": "test_uid",
            "thread_id": "test_thread_id",
            "message_id": "test_message_id"
        }

        result = map_llm_response_to_message_analysis(llm_analysis, metadata)
        self.assertNotIn("skills", result)

if __name__ == '__main__':
    unittest.main()
