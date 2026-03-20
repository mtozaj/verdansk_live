import requests
import sys
import uuid
from datetime import datetime
import time

class RallyPointEdgeCaseTester:
    def __init__(self, base_url="https://squad-nexus-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.session_ids = []

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}" if not endpoint.startswith('http') else endpoint
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 {name}")
        print(f"   URL: {url}")
        if params:
            print(f"   Params: {params}")
        if data:
            print(f"   Data: {data}")
        
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
                print(f"✅ Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                print(f"❌ Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"   Response: {response.json()}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Error: {str(e)}")
            return False, {}

    def test_lobby_expiry_starting_status(self):
        """Test lobby expiry edge case when session is in 'starting' status"""
        print("\n" + "="*60)
        print("🔬 TESTING LOBBY EXPIRY IN 'STARTING' STATUS")
        print("="*60)
        
        # Step 1: Create session
        session_data = {
            "host_name": "EdgeHost",
            "host_id": "edge-host-1", 
            "title": "Starting Expiry Test",
            "region": "NA",
            "match_code": "EDGE1",
            "platform": "Cross-play"
        }
        
        success, response = self.run_test(
            "Step 1: Create session",
            "POST",
            "sessions",
            200,
            data=session_data
        )
        
        if not success or 'id' not in response:
            print("❌ Failed to create session - cannot continue test")
            return False
            
        session_id = response['id']
        self.session_ids.append(session_id)
        print(f"   Session ID: {session_id}")
        
        # Step 2: Verify initial state
        success, response = self.run_test(
            "Step 2: Verify initial state (filling)",
            "GET",
            f"sessions/{session_id}",
            200
        )
        
        if not success:
            return False
            
        # Check initial values
        initial_checks = []
        if response.get('lobby_expired') == False:
            initial_checks.append("✅ lobby_expired=false")
        else:
            initial_checks.append(f"❌ lobby_expired={response.get('lobby_expired')}")
            
        if response.get('status') == "filling":
            initial_checks.append("✅ status=filling")
        else:
            initial_checks.append(f"❌ status={response.get('status')}")
            
        if response.get('lobby_expires_at'):
            initial_checks.append("✅ lobby_expires_at is set")
        else:
            initial_checks.append("❌ lobby_expires_at is not set")
            
        for check in initial_checks:
            print(f"   {check}")
            
        # Step 3: Set status to 'starting'
        success, response = self.run_test(
            "Step 3: Set status to 'starting'",
            "PATCH",
            f"sessions/{session_id}",
            200,
            data={"status": "starting"},
            params={"host_id": "edge-host-1"}
        )
        
        if not success:
            return False
            
        # Check transition worked
        transition_checks = []
        if response.get('status') == "starting":
            transition_checks.append("✅ status=starting")
        else:
            transition_checks.append(f"❌ status={response.get('status')}")
            
        if response.get('lobby_expired') == False:
            transition_checks.append("✅ lobby_expired still false")
        else:
            transition_checks.append(f"❌ lobby_expired={response.get('lobby_expired')}")
            
        for check in transition_checks:
            print(f"   {check}")
        
        # Step 4: Verify session in 'starting' status still has expiry fields
        success, response = self.run_test(
            "Step 4: Verify 'starting' session expiry fields",
            "GET",
            f"sessions/{session_id}",
            200
        )
        
        if not success:
            return False
            
        # Final verification checks
        final_checks = []
        if response.get('status') == "starting":
            final_checks.append("✅ status=starting")
        else:
            final_checks.append(f"❌ status={response.get('status')}")
            
        if response.get('lobby_expires_at'):
            final_checks.append("✅ lobby_expires_at field present")
        else:
            final_checks.append("❌ lobby_expires_at field missing")
            
        if response.get('lobby_expired') == False:
            final_checks.append("✅ lobby_expired=false (not expired yet)")
        else:
            final_checks.append(f"❌ lobby_expired={response.get('lobby_expired')}")
            
        # Check if lobby_reset_at exists
        if response.get('lobby_reset_at'):
            final_checks.append("✅ lobby_reset_at field present")
        else:
            final_checks.append("❌ lobby_reset_at field missing")
            
        for check in final_checks:
            print(f"   {check}")
            
        print(f"\n📊 Starting Status Test Results:")
        all_passed = all("✅" in check for check in initial_checks + transition_checks + final_checks)
        
        if all_passed:
            print("✅ All checks passed - lobby expiry correctly handled in 'starting' status")
            return True
        else:
            print("❌ Some checks failed - issue with lobby expiry in 'starting' status")
            return False

    def test_reset_timer_feature(self):
        """Test the reset_timer=false feature"""
        print("\n" + "="*60)
        print("🔬 TESTING RESET_TIMER=FALSE FEATURE")
        print("="*60)
        
        # Step 5: Create another session
        session_data = {
            "host_name": "TimerHost",
            "host_id": "timer-host-1",
            "title": "Timer Test", 
            "region": "NA",
            "match_code": "TMR1",
            "platform": "Cross-play"
        }
        
        success, response = self.run_test(
            "Step 5: Create timer test session",
            "POST",
            "sessions",
            200,
            data=session_data
        )
        
        if not success or 'id' not in response:
            print("❌ Failed to create timer test session")
            return False
            
        session_id = response['id']
        self.session_ids.append(session_id)
        print(f"   Session ID: {session_id}")
        
        # Step 6: Note the initial lobby_reset_at value
        success, response = self.run_test(
            "Step 6: Get initial lobby_reset_at value",
            "GET",
            f"sessions/{session_id}",
            200
        )
        
        if not success:
            return False
            
        initial_lobby_reset_at = response.get('lobby_reset_at')
        if initial_lobby_reset_at:
            print(f"   ✅ Initial lobby_reset_at: {initial_lobby_reset_at}")
        else:
            print("   ❌ lobby_reset_at not found")
            return False
        
        # Wait a small amount to ensure timestamp would be different
        time.sleep(1)
        
        # Step 7: Update with reset_timer=false
        success, response = self.run_test(
            "Step 7: Update match_code with reset_timer=false",
            "PATCH",
            f"sessions/{session_id}",
            200,
            data={"match_code": "TMR2"},
            params={"host_id": "timer-host-1", "reset_timer": "false"}
        )
        
        if not success:
            return False
        
        # Step 8: Verify match_code changed but lobby_reset_at unchanged
        success, response = self.run_test(
            "Step 8: Verify reset_timer=false behavior",
            "GET", 
            f"sessions/{session_id}",
            200
        )
        
        if not success:
            return False
            
        new_lobby_reset_at = response.get('lobby_reset_at')
        new_match_code = response.get('match_code')
        
        reset_false_checks = []
        if new_match_code == "TMR2":
            reset_false_checks.append("✅ match_code updated to TMR2")
        else:
            reset_false_checks.append(f"❌ match_code is {new_match_code}, expected TMR2")
            
        if new_lobby_reset_at == initial_lobby_reset_at:
            reset_false_checks.append("✅ lobby_reset_at unchanged (same value)")
        else:
            reset_false_checks.append(f"❌ lobby_reset_at changed from {initial_lobby_reset_at} to {new_lobby_reset_at}")
        
        for check in reset_false_checks:
            print(f"   {check}")
        
        # Wait a moment before next test
        time.sleep(1)
        
        # Step 9: Update with reset_timer=true (default behavior)
        success, response = self.run_test(
            "Step 9: Update match_code with reset_timer=true",
            "PATCH",
            f"sessions/{session_id}",
            200,
            data={"match_code": "TMR3"},
            params={"host_id": "timer-host-1", "reset_timer": "true"}
        )
        
        if not success:
            return False
        
        # Step 10: Verify match_code changed and lobby_reset_at changed
        success, response = self.run_test(
            "Step 10: Verify reset_timer=true behavior",
            "GET",
            f"sessions/{session_id}",
            200
        )
        
        if not success:
            return False
            
        final_lobby_reset_at = response.get('lobby_reset_at')
        final_match_code = response.get('match_code')
        
        reset_true_checks = []
        if final_match_code == "TMR3":
            reset_true_checks.append("✅ match_code updated to TMR3")
        else:
            reset_true_checks.append(f"❌ match_code is {final_match_code}, expected TMR3")
            
        if final_lobby_reset_at != initial_lobby_reset_at:
            reset_true_checks.append("✅ lobby_reset_at changed (different value)")
        else:
            reset_true_checks.append(f"❌ lobby_reset_at unchanged: {final_lobby_reset_at}")
            
        for check in reset_true_checks:
            print(f"   {check}")
        
        print(f"\n📊 Reset Timer Test Results:")
        all_passed = all("✅" in check for check in reset_false_checks + reset_true_checks)
        
        if all_passed:
            print("✅ All checks passed - reset_timer feature working correctly")
            return True
        else:
            print("❌ Some checks failed - issue with reset_timer feature")
            return False

    def run_all_tests(self):
        """Run all edge case tests"""
        print("🚀 Rally Point API Edge Case Testing")
        print("=" * 60)
        
        test1_result = self.test_lobby_expiry_starting_status()
        test2_result = self.test_reset_timer_feature()
        
        # Print overall results
        print("\n" + "=" * 60)
        print(f"📊 OVERALL EDGE CASE TEST RESULTS:")
        print(f"   Tests run: {self.tests_run}")
        print(f"   Tests passed: {self.tests_passed}")
        print(f"   Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        print(f"   Sessions created: {len(self.session_ids)}")
        
        print(f"\n🔍 Test Case Results:")
        print(f"   Lobby expiry in 'starting' status: {'✅ PASS' if test1_result else '❌ FAIL'}")
        print(f"   Reset timer feature: {'✅ PASS' if test2_result else '❌ FAIL'}")
        
        overall_success = test1_result and test2_result
        print(f"\n🎯 Overall Result: {'✅ ALL TESTS PASSED' if overall_success else '❌ SOME TESTS FAILED'}")
        
        return overall_success

def main():
    tester = RallyPointEdgeCaseTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())