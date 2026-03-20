import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

class RallyPointAPITester:
    def __init__(self, base_url="https://squad-nexus-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.session_id = None
        self.session_data = None

    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED {details}")
        else:
            self.failed_tests.append({"test": test_name, "details": details})
            print(f"❌ {test_name} - FAILED {details}")

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, params: Optional[Dict] = None) -> tuple[bool, Dict[str, Any], int]:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method.upper() == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params, timeout=10)
            elif method.upper() == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, params=params, timeout=10)
            else:
                return False, {"error": f"Unsupported method: {method}"}, 0

            try:
                response_data = response.json()
            except:
                response_data = {"text_response": response.text}
                
            return True, response_data, response.status_code
            
        except Exception as e:
            return False, {"error": str(e)}, 0

    def test_1_root_endpoint(self):
        """Test 1: GET /api/ — should return 200 with message"""
        success, data, status = self.make_request('GET', '')
        
        if not success:
            self.log_result("1. GET /api/", False, f"Request failed: {data.get('error', 'Unknown error')}")
            return False
            
        if status != 200:
            self.log_result("1. GET /api/", False, f"Expected 200, got {status}")
            return False
            
        if not isinstance(data, dict) or 'message' not in data:
            self.log_result("1. GET /api/", False, f"Expected dict with 'message' field, got: {data}")
            return False
            
        self.log_result("1. GET /api/", True, f"Message: '{data['message']}'")
        return True

    def test_2_stats_endpoint(self):
        """Test 2: GET /api/stats — should return active_sessions, total_players, online_viewers"""
        success, data, status = self.make_request('GET', 'stats')
        
        if not success:
            self.log_result("2. GET /api/stats", False, f"Request failed: {data.get('error', 'Unknown error')}")
            return False
            
        if status != 200:
            self.log_result("2. GET /api/stats", False, f"Expected 200, got {status}")
            return False
            
        required_fields = ['active_sessions', 'total_players', 'online_viewers']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            self.log_result("2. GET /api/stats", False, f"Missing fields: {missing_fields}")
            return False
            
        self.log_result("2. GET /api/stats", True, f"Stats: {data}")
        return True

    def test_3_create_session(self):
        """Test 3: POST /api/sessions — create session and verify lobby expiry fields"""
        session_data = {
            "host_name": "TestHost",
            "host_id": "test-host-123", 
            "title": "Timer Test Session",
            "region": "NA",
            "match_code": "TMRFIX",
            "platform": "Cross-play"
        }
        
        success, data, status = self.make_request('POST', 'sessions', data=session_data)
        
        if not success:
            self.log_result("3. POST /api/sessions", False, f"Request failed: {data.get('error', 'Unknown error')}")
            return False
            
        if status != 200:
            self.log_result("3. POST /api/sessions", False, f"Expected 200, got {status}: {data}")
            return False
            
        # Store session info for later tests
        self.session_id = data.get('id')
        self.session_data = data
        
        # Verify required fields
        required_fields = ['lobby_reset_at', 'lobby_expires_at', 'lobby_expired', 'server_now']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            self.log_result("3. POST /api/sessions", False, f"Missing lobby expiry fields: {missing_fields}")
            return False
            
        # Verify lobby_expired is false for new session
        if data.get('lobby_expired') != False:
            self.log_result("3. POST /api/sessions", False, f"Expected lobby_expired=false, got {data.get('lobby_expired')}")
            return False
            
        self.log_result("3. POST /api/sessions", True, f"Session created: {self.session_id}")
        print(f"   Lobby fields: lobby_reset_at={data.get('lobby_reset_at')[:19] if data.get('lobby_reset_at') else None}")
        print(f"                 lobby_expires_at={data.get('lobby_expires_at')[:19] if data.get('lobby_expires_at') else None}")
        print(f"                 lobby_expired={data.get('lobby_expired')}")
        return True

    def test_4_get_session_details(self):
        """Test 4: GET /api/sessions/{id} — verify lobby_expires_at is ~30 min after lobby_reset_at"""
        if not self.session_id:
            self.log_result("4. GET /api/sessions/{id}", False, "No session ID available")
            return False
            
        success, data, status = self.make_request('GET', f'sessions/{self.session_id}')
        
        if not success:
            self.log_result("4. GET /api/sessions/{id}", False, f"Request failed: {data.get('error', 'Unknown error')}")
            return False
            
        if status != 200:
            self.log_result("4. GET /api/sessions/{id}", False, f"Expected 200, got {status}")
            return False
            
        # Verify lobby expiry timing
        lobby_reset_at = data.get('lobby_reset_at')
        lobby_expires_at = data.get('lobby_expires_at')
        server_now = data.get('server_now')
        
        if not all([lobby_reset_at, lobby_expires_at, server_now]):
            missing = [f for f in ['lobby_reset_at', 'lobby_expires_at', 'server_now'] 
                      if not data.get(f)]
            self.log_result("4. GET /api/sessions/{id}", False, f"Missing time fields: {missing}")
            return False
            
        try:
            reset_time = datetime.fromisoformat(lobby_reset_at.replace('Z', '+00:00'))
            expires_time = datetime.fromisoformat(lobby_expires_at.replace('Z', '+00:00'))
            now_time = datetime.fromisoformat(server_now.replace('Z', '+00:00'))
            
            # Check if expires_at is ~30 minutes after reset_at
            expected_expires = reset_time + timedelta(minutes=30)
            time_diff = abs((expires_time - expected_expires).total_seconds())
            
            if time_diff > 60:  # Allow 1 minute tolerance
                self.log_result("4. GET /api/sessions/{id}", False, 
                               f"lobby_expires_at not ~30min after lobby_reset_at. Diff: {time_diff}s")
                return False
                
            # Check if server_now is reasonable (within 1 minute of actual now)
            actual_now = datetime.now(now_time.tzinfo)
            now_diff = abs((now_time - actual_now).total_seconds())
            
            if now_diff > 60:  # Allow 1 minute tolerance
                print(f"   Warning: server_now seems off by {now_diff}s")
                
        except Exception as e:
            self.log_result("4. GET /api/sessions/{id}", False, f"Error parsing times: {e}")
            return False
            
        self.log_result("4. GET /api/sessions/{id}", True, "Lobby timing verified")
        return True

    def test_5_join_session_interested(self):
        """Test 5: POST /api/sessions/{id}/join — join with state="interested" """
        if not self.session_id:
            self.log_result("5. Join session (interested)", False, "No session ID available")
            return False
            
        join_data = {
            "player_id": "player-456",
            "nickname": "Player2",
            "state": "interested"
        }
        
        success, data, status = self.make_request('POST', f'sessions/{self.session_id}/join', data=join_data)
        
        if not success:
            self.log_result("5. Join session (interested)", False, f"Request failed: {data.get('error', 'Unknown error')}")
            return False
            
        if status != 200:
            self.log_result("5. Join session (interested)", False, f"Expected 200, got {status}: {data}")
            return False
            
        # Verify player was added
        players = data.get('players', [])
        player_found = any(p.get('player_id') == 'player-456' and p.get('state') == 'interested' 
                          for p in players)
        
        if not player_found:
            self.log_result("5. Join session (interested)", False, "Player not found with correct state")
            return False
            
        self.log_result("5. Join session (interested)", True, f"Player joined with state 'interested'")
        return True

    def test_6_advance_to_joining(self):
        """Test 6: POST /api/sessions/{id}/join — advance player-456 to state="joining" """
        if not self.session_id:
            self.log_result("6. Advance to joining", False, "No session ID available")
            return False
            
        join_data = {
            "player_id": "player-456",
            "nickname": "Player2",
            "state": "joining"
        }
        
        success, data, status = self.make_request('POST', f'sessions/{self.session_id}/join', data=join_data)
        
        if not success:
            self.log_result("6. Advance to joining", False, f"Request failed: {data.get('error', 'Unknown error')}")
            return False
            
        if status != 200:
            self.log_result("6. Advance to joining", False, f"Expected 200, got {status}: {data}")
            return False
            
        # Verify player state updated
        players = data.get('players', [])
        player_found = any(p.get('player_id') == 'player-456' and p.get('state') == 'joining' 
                          for p in players)
        
        if not player_found:
            self.log_result("6. Advance to joining", False, "Player state not updated to 'joining'")
            return False
            
        self.log_result("6. Advance to joining", True, "Player advanced to 'joining' state")
        return True

    def test_7_advance_to_in_lobby(self):
        """Test 7: POST /api/sessions/{id}/join — advance player-456 to state="in_lobby" """
        if not self.session_id:
            self.log_result("7. Advance to in_lobby", False, "No session ID available")
            return False
            
        join_data = {
            "player_id": "player-456",
            "nickname": "Player2", 
            "state": "in_lobby"
        }
        
        success, data, status = self.make_request('POST', f'sessions/{self.session_id}/join', data=join_data)
        
        if not success:
            self.log_result("7. Advance to in_lobby", False, f"Request failed: {data.get('error', 'Unknown error')}")
            return False
            
        if status != 200:
            self.log_result("7. Advance to in_lobby", False, f"Expected 200, got {status}: {data}")
            return False
            
        # Verify player state updated
        players = data.get('players', [])
        player_found = any(p.get('player_id') == 'player-456' and p.get('state') == 'in_lobby' 
                          for p in players)
        
        if not player_found:
            self.log_result("7. Advance to in_lobby", False, "Player state not updated to 'in_lobby'")
            return False
            
        self.log_result("7. Advance to in_lobby", True, "Player advanced to 'in_lobby' state")
        return True

    def test_8_backward_transition_fails(self):
        """Test 8: POST /api/sessions/{id}/join — try backward transition (should fail with 400)"""
        if not self.session_id:
            self.log_result("8. Backward transition (should fail)", False, "No session ID available")
            return False
            
        join_data = {
            "player_id": "player-456",
            "nickname": "Player2",
            "state": "interested"
        }
        
        success, data, status = self.make_request('POST', f'sessions/{self.session_id}/join', data=join_data)
        
        if not success:
            self.log_result("8. Backward transition (should fail)", False, f"Request failed: {data.get('error', 'Unknown error')}")
            return False
            
        if status != 400:
            self.log_result("8. Backward transition (should fail)", False, f"Expected 400, got {status}")
            return False
            
        self.log_result("8. Backward transition (should fail)", True, "Backward transition correctly rejected")
        return True

    def test_9_update_match_code(self):
        """Test 9: PATCH /api/sessions/{id} — update match_code and verify lobby reset"""
        if not self.session_id:
            self.log_result("9. Update match code", False, "No session ID available")
            return False
            
        # First get current lobby_reset_at
        success, current_data, status = self.make_request('GET', f'sessions/{self.session_id}')
        if not success or status != 200:
            self.log_result("9. Update match code", False, "Could not get current session data")
            return False
            
        old_lobby_reset_at = current_data.get('lobby_reset_at')
        
        # Update match code
        update_data = {"match_code": "NEWCODE"}
        params = {"host_id": "test-host-123"}
        
        success, data, status = self.make_request('PATCH', f'sessions/{self.session_id}', 
                                                data=update_data, params=params)
        
        if not success:
            self.log_result("9. Update match code", False, f"Request failed: {data.get('error', 'Unknown error')}")
            return False
            
        if status != 200:
            self.log_result("9. Update match code", False, f"Expected 200, got {status}: {data}")
            return False
            
        # Verify match code updated
        if data.get('match_code') != 'NEWCODE':
            self.log_result("9. Update match code", False, f"Match code not updated. Got: {data.get('match_code')}")
            return False
            
        # Verify lobby_reset_at changed
        new_lobby_reset_at = data.get('lobby_reset_at')
        if new_lobby_reset_at == old_lobby_reset_at:
            self.log_result("9. Update match code", False, "lobby_reset_at did not change")
            return False
            
        # Verify lobby_expired_at is null
        if data.get('lobby_expired_at') is not None:
            self.log_result("9. Update match code", False, f"Expected lobby_expired_at=null, got {data.get('lobby_expired_at')}")
            return False
            
        # Verify lobby_expires_at updated
        if not data.get('lobby_expires_at'):
            self.log_result("9. Update match code", False, "lobby_expires_at not set")
            return False
            
        self.log_result("9. Update match code", True, "Match code updated, lobby reset verified")
        return True

    def test_10_reset_lobby(self):
        """Test 10: POST /api/sessions/{id}/reset-lobby — reset with new match code"""
        if not self.session_id:
            self.log_result("10. Reset lobby", False, "No session ID available")
            return False
            
        # Get current lobby_reset_at
        success, current_data, status = self.make_request('GET', f'sessions/{self.session_id}')
        if not success or status != 200:
            self.log_result("10. Reset lobby", False, "Could not get current session data")
            return False
            
        old_lobby_reset_at = current_data.get('lobby_reset_at')
        
        # Reset lobby
        reset_data = {"match_code": "RESET1"}
        params = {"host_id": "test-host-123"}
        
        success, data, status = self.make_request('POST', f'sessions/{self.session_id}/reset-lobby',
                                                data=reset_data, params=params)
        
        if not success:
            self.log_result("10. Reset lobby", False, f"Request failed: {data.get('error', 'Unknown error')}")
            return False
            
        if status != 200:
            self.log_result("10. Reset lobby", False, f"Expected 200, got {status}: {data}")
            return False
            
        # Verify lobby_expired_at is null
        if data.get('lobby_expired_at') is not None:
            self.log_result("10. Reset lobby", False, f"Expected lobby_expired_at=null, got {data.get('lobby_expired_at')}")
            return False
            
        # Verify lobby_reset_at refreshed
        new_lobby_reset_at = data.get('lobby_reset_at')
        if new_lobby_reset_at == old_lobby_reset_at:
            self.log_result("10. Reset lobby", False, "lobby_reset_at not refreshed")
            return False
            
        # Verify status is filling
        if data.get('status') != 'filling':
            self.log_result("10. Reset lobby", False, f"Expected status='filling', got {data.get('status')}")
            return False
            
        self.log_result("10. Reset lobby", True, "Lobby reset successfully")
        return True

    def test_11_session_status_transitions(self):
        """Test 11: PATCH /api/sessions/{id} — set status to starting, then ended"""
        if not self.session_id:
            self.log_result("11. Session status transitions", False, "No session ID available")
            return False
            
        # Transition to starting
        update_data = {"status": "starting"}
        params = {"host_id": "test-host-123"}
        
        success, data, status = self.make_request('PATCH', f'sessions/{self.session_id}',
                                                data=update_data, params=params)
        
        if not success:
            self.log_result("11. Session status transitions", False, f"Request failed: {data.get('error', 'Unknown error')}")
            return False
            
        if status != 200:
            self.log_result("11. Session status transitions", False, f"Expected 200 for starting, got {status}: {data}")
            return False
            
        if data.get('status') != 'starting':
            self.log_result("11. Session status transitions", False, f"Status not set to starting: {data.get('status')}")
            return False
            
        # Transition to ended
        update_data = {"status": "ended"}
        
        success, data, status = self.make_request('PATCH', f'sessions/{self.session_id}',
                                                data=update_data, params=params)
        
        if not success:
            self.log_result("11. Session status transitions", False, f"Request failed: {data.get('error', 'Unknown error')}")
            return False
            
        if status != 200:
            self.log_result("11. Session status transitions", False, f"Expected 200 for ended, got {status}: {data}")
            return False
            
        if data.get('status') != 'ended':
            self.log_result("11. Session status transitions", False, f"Status not set to ended: {data.get('status')}")
            return False
            
        self.log_result("11. Session status transitions", True, "Successfully transitioned starting → ended")
        return True

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Rally Point API Backend Testing")
        print("=" * 60)
        print(f"Testing API at: {self.base_url}")
        print()
        
        test_methods = [
            self.test_1_root_endpoint,
            self.test_2_stats_endpoint,
            self.test_3_create_session,
            self.test_4_get_session_details,
            self.test_5_join_session_interested,
            self.test_6_advance_to_joining,
            self.test_7_advance_to_in_lobby,
            self.test_8_backward_transition_fails,
            self.test_9_update_match_code,
            self.test_10_reset_lobby,
            self.test_11_session_status_transitions
        ]
        
        for test_method in test_methods:
            test_method()
            print()  # Add spacing between tests
        
        # Print final results
        print("=" * 60)
        print("📊 FINAL TEST RESULTS")
        print(f"Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for failure in self.failed_tests:
                print(f"   • {failure['test']}: {failure['details']}")
        
        if self.tests_passed == self.tests_run:
            print("\n🎉 ALL TESTS PASSED!")
            return True
        else:
            print(f"\n⚠️  {len(self.failed_tests)} TESTS FAILED")
            return False

def main():
    tester = RallyPointAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())