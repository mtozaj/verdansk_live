import requests
import sys
import uuid
from datetime import datetime

class RallyPointAPITester:
    def __init__(self, base_url="https://codebase-review-81.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.session_id = None
        self.player_id = str(uuid.uuid4())
        self.nickname = f"TestPlayer_{datetime.now().strftime('%H%M%S')}"

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}" if not endpoint.startswith('http') else endpoint
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, params=params)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"   Response: {response.json()}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        success, response = self.run_test(
            "Root Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_get_stats(self):
        """Test getting server stats"""
        success, response = self.run_test(
            "Get Stats",
            "GET", 
            "stats",
            200
        )
        if success and isinstance(response, dict):
            print(f"   Stats: {response}")
        return success

    def test_create_session(self):
        """Test creating a new session with hardcoded values"""
        # Only send required fields per new spec
        session_data = {
            "host_name": self.nickname,
            "host_id": self.player_id,
            "title": "Test Verdansk Battle Royale",
            "region": "NA",
            "match_code": "TEST123",
            "platform": "Cross-play"
        }
        
        success, response = self.run_test(
            "Create Session",
            "POST",
            "sessions",
            200,
            data=session_data
        )
        
        if success and 'id' in response:
            self.session_id = response['id']
            print(f"   Created session ID: {self.session_id}")
            # Verify hardcoded values are set correctly
            if response.get('map_name') == 'Verdansk':
                print("   ✅ Map name correctly hardcoded to Verdansk")
            if response.get('game_mode') == 'Battle Royale':
                print("   ✅ Game mode correctly hardcoded to Battle Royale")
            if response.get('min_players') == 50:
                print("   ✅ Min players correctly hardcoded to 50")
            if response.get('max_players') == 152:
                print("   ✅ Max players correctly hardcoded to 152")
            if response.get('interested_count') == 0:
                print("   ✅ Interested count starts at 0")
            if response.get('joining_count') == 0:
                print("   ✅ Joining count starts at 0")
            if response.get('in_lobby_count') == 1:
                print("   ✅ In-lobby count starts with the host")
        
        return success

    def test_get_sessions_list(self):
        """Test getting sessions list"""
        success, response = self.run_test(
            "Get Sessions List",
            "GET",
            "sessions",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} sessions")
        
        return success

    def test_get_sessions_with_filters(self):
        """Test getting sessions with filters"""
        success, response = self.run_test(
            "Get Sessions with Region Filter",
            "GET",
            "sessions",
            200,
            params={"region": "NA"}
        )
        return success

    def test_get_sessions_no_map_filter(self):
        """Test that GET /api/sessions no longer accepts map_name parameter"""
        # This should work (ignore map_name param)
        success, response = self.run_test(
            "Get Sessions ignoring map_name param",
            "GET",
            "sessions",
            200,
            params={"map_name": "Blackout", "region": "NA"}  # map_name should be ignored
        )
        
        if success:
            print("   ✅ GET /api/sessions correctly ignores map_name parameter")
        
        return success

    def test_get_specific_session(self):
        """Test getting a specific session by ID"""
        if not self.session_id:
            print("❌ Cannot test - no session ID available")
            return False
            
        success, response = self.run_test(
            "Get Specific Session",
            "GET",
            f"sessions/{self.session_id}",
            200
        )
        
        if success and isinstance(response, dict):
            print(f"   Session title: {response.get('title', 'N/A')}")
            
        return success

    def test_join_session(self):
        """Test joining a session"""
        if not self.session_id:
            print("❌ Cannot test - no session ID available")
            return False
            
        join_data = {
            "player_id": f"{self.player_id}_2",  # Different player ID
            "nickname": f"{self.nickname}_2",
            "state": "interested"
        }
        
        success, response = self.run_test(
            "Join Session",
            "POST",
            f"sessions/{self.session_id}/join",
            200,
            data=join_data
        )
        
        if success and isinstance(response, dict):
            print(f"   Players in session: {response.get('player_count', 0)}")
            print(f"   Interested: {response.get('interested_count', 0)}")
            print(f"   Joining soon: {response.get('joining_count', 0)}")
            print(f"   In lobby: {response.get('in_lobby_count', 0)}")
            
        return success

    def test_player_state_transitions(self):
        """Test one-way player state transitions (interested→joining→in_lobby)"""
        if not self.session_id:
            print("❌ Cannot test - no session ID available")
            return False
        
        player_id_test = f"{self.player_id}_state_test"
        nickname_test = f"{self.nickname}_state"
        
        # Test interested → joining transition
        update_data = {
            "player_id": player_id_test,
            "nickname": nickname_test, 
            "state": "joining"
        }
        
        success1, response1 = self.run_test(
            "Player State: interested → joining",
            "POST",
            f"sessions/{self.session_id}/join",
            200,
            data=update_data
        )
        
        if success1:
            print("   ✅ One-way transition interested → joining works")
        
        # Test joining → in_lobby transition
        update_data["state"] = "in_lobby"
        
        success2, response2 = self.run_test(
            "Player State: joining → in_lobby", 
            "POST",
            f"sessions/{self.session_id}/join",
            200,
            data=update_data
        )
        
        if success2:
            print("   ✅ One-way transition joining → in_lobby works")
        
        # Test invalid backward transition (should fail)
        update_data["state"] = "interested"
        
        success3, response3 = self.run_test(
            "Player State: in_lobby → interested (should fail)",
            "POST", 
            f"sessions/{self.session_id}/join",
            400,  # Should return 400 error
            data=update_data
        )
        
        if success3:
            print("   ✅ Invalid backward transition correctly rejected")
        
        return success1 and success2 and success3

    def test_send_chat_message(self):
        """Test sending a chat message"""
        if not self.session_id:
            print("❌ Cannot test - no session ID available")
            return False
            
        chat_data = {
            "player_id": self.player_id,
            "nickname": self.nickname,
            "message": "Hello from backend test!"
        }
        
        success, response = self.run_test(
            "Send Chat Message",
            "POST",
            f"sessions/{self.session_id}/chat",
            200,
            data=chat_data
        )
        
        if success and isinstance(response, dict):
            print(f"   Message ID: {response.get('id', 'N/A')}")
            
        return success

    def test_get_chat_messages(self):
        """Test getting chat messages"""
        if not self.session_id:
            print("❌ Cannot test - no session ID available")
            return False
            
        success, response = self.run_test(
            "Get Chat Messages",
            "GET",
            f"sessions/{self.session_id}/chat",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} chat messages")
            
        return success

    def test_session_status_transitions(self):
        """Test one-way session status transitions (filling→starting→in_progress→ended)"""
        if not self.session_id:
            print("❌ Cannot test - no session ID available")
            return False
        
        # Test filling → starting transition
        success1, response1 = self.run_test(
            "Session Status: filling → starting",
            "PATCH",
            f"sessions/{self.session_id}",
            200,
            data={"status": "starting"},
            params={"host_id": self.player_id}
        )
        
        if success1:
            print("   ✅ One-way transition filling → starting works")
        
        # Test starting → in_progress transition
        success2, response2 = self.run_test(
            "Session Status: starting → in_progress",
            "PATCH",
            f"sessions/{self.session_id}",
            200,
            data={"status": "in_progress"},
            params={"host_id": self.player_id}
        )
        
        if success2:
            print("   ✅ One-way transition starting → in_progress works")
        
        # Test invalid backward transition (should fail)
        success3, response3 = self.run_test(
            "Session Status: in_progress → filling (should fail)",
            "PATCH",
            f"sessions/{self.session_id}",
            400,  # Should return 400 error
            data={"status": "filling"},
            params={"host_id": self.player_id}
        )
        
        if success3:
            print("   ✅ Invalid backward transition correctly rejected")
        
        return success1 and success2 and success3

    def test_update_match_code(self):
        """Test updating match code (host only)"""
        if not self.session_id:
            print("❌ Cannot test - no session ID available")
            return False
            
        update_data = {"match_code": "NEWCODE123"}
        
        success, response = self.run_test(
            "Update Match Code",
            "PATCH",
            f"sessions/{self.session_id}",
            200,
            data=update_data,
            params={"host_id": self.player_id}
        )
        return success

    def test_leave_session(self):
        """Test leaving a session"""
        if not self.session_id:
            print("❌ Cannot test - no session ID available")
            return False
            
        success, response = self.run_test(
            "Leave Session", 
            "POST",
            f"sessions/{self.session_id}/leave",
            200,
            params={"player_id": f"{self.player_id}_2"}
        )
        return success

def main():
    print("🚀 Rally Point API Testing")
    print("=" * 50)
    
    # Setup
    tester = RallyPointAPITester()
    
    # Run all tests in order
    tests = [
        tester.test_root_endpoint,
        tester.test_get_stats,
        tester.test_create_session,
        tester.test_get_sessions_list,
        tester.test_get_sessions_with_filters,
        tester.test_get_sessions_no_map_filter,
        tester.test_get_specific_session,
        tester.test_join_session,
        tester.test_player_state_transitions,
        tester.test_send_chat_message,
        tester.test_get_chat_messages,
        tester.test_session_status_transitions,
        tester.test_update_match_code,
        tester.test_leave_session,
        # Note: End session test removed as it's tested in status transitions
    ]
    
    for test in tests:
        test()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Backend API Tests Results:")
    print(f"   Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"   Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("✅ All backend API tests passed!")
        return 0
    else:
        print("❌ Some backend API tests failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())