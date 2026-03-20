"""
Tests for the /leave-if-interested endpoint and related bug fix scenarios.

The bug fix addresses a race condition where users got stuck as 'interested' 
after: entering session → committing to join → clicking 'Exit Lobby' → 
clicking 'Back to Lobby'.

Key scenarios tested:
1. leave-if-interested removes player when state is 'interested'
2. leave-if-interested does NOT remove player when state is 'joining' or 'in_lobby'
3. leave-if-interested does NOT remove the host
4. leave-if-interested returns ok:true for non-existent sessions
5. Existing endpoints still work: /join, /leave, /exit-lobby
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://squad-nexus-1.preview.emergentagent.com"

API_URL = f"{BASE_URL}/api"


class TestLeaveIfInterestedEndpoint:
    """Tests for POST /api/sessions/{sid}/leave-if-interested"""
    
    @pytest.fixture
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture
    def create_test_session(self, api_client):
        """Create a test session and return session data"""
        host_id = f"host_{uuid.uuid4().hex[:8]}"
        session_data = {
            "host_name": f"TestHost_{datetime.now().strftime('%H%M%S')}",
            "host_id": host_id,
            "title": "Leave-If-Interested Test",
            "region": "NA",
            "match_code": f"TEST{uuid.uuid4().hex[:4].upper()}",
            "platform": "Cross-play"
        }
        response = api_client.post(f"{API_URL}/sessions", json=session_data)
        assert response.status_code == 200
        data = response.json()
        yield {"session_id": data["id"], "host_id": host_id, "session": data}
        # Cleanup: end the session
        try:
            api_client.patch(
                f"{API_URL}/sessions/{data['id']}?host_id={host_id}",
                json={"status": "ended"}
            )
        except:
            pass
    
    def test_leave_if_interested_removes_interested_player(self, api_client, create_test_session):
        """Test: leave-if-interested removes player when state is 'interested'"""
        session_id = create_test_session["session_id"]
        player_id = f"player_{uuid.uuid4().hex[:8]}"
        
        # Join as interested
        join_response = api_client.post(f"{API_URL}/sessions/{session_id}/join", json={
            "player_id": player_id,
            "nickname": "TestPlayer",
            "state": "interested"
        })
        assert join_response.status_code == 200
        
        # Verify player is in session
        session = join_response.json()
        assert any(p["player_id"] == player_id and p["state"] == "interested" 
                  for p in session["players"])
        
        # Call leave-if-interested
        leave_response = api_client.post(
            f"{API_URL}/sessions/{session_id}/leave-if-interested?player_id={player_id}"
        )
        assert leave_response.status_code == 200
        assert leave_response.json().get("ok") == True
        
        # Verify player is removed
        get_response = api_client.get(f"{API_URL}/sessions/{session_id}")
        assert get_response.status_code == 200
        session = get_response.json()
        assert not any(p["player_id"] == player_id for p in session["players"]), \
            "Player should be removed when state was 'interested'"
    
    def test_leave_if_interested_does_not_remove_joining_player(self, api_client, create_test_session):
        """Test: leave-if-interested does NOT remove player when state is 'joining'"""
        session_id = create_test_session["session_id"]
        player_id = f"player_{uuid.uuid4().hex[:8]}"
        
        # Join as joining (direct join with joining state)
        join_response = api_client.post(f"{API_URL}/sessions/{session_id}/join", json={
            "player_id": player_id,
            "nickname": "TestPlayer",
            "state": "joining"
        })
        assert join_response.status_code == 200
        
        # Call leave-if-interested
        leave_response = api_client.post(
            f"{API_URL}/sessions/{session_id}/leave-if-interested?player_id={player_id}"
        )
        assert leave_response.status_code == 200
        assert leave_response.json().get("ok") == True
        
        # Verify player is still in session with 'joining' state
        get_response = api_client.get(f"{API_URL}/sessions/{session_id}")
        assert get_response.status_code == 200
        session = get_response.json()
        assert any(p["player_id"] == player_id and p["state"] == "joining" 
                  for p in session["players"]), \
            "Player with 'joining' state should NOT be removed"
    
    def test_leave_if_interested_does_not_remove_in_lobby_player(self, api_client, create_test_session):
        """Test: leave-if-interested does NOT remove player when state is 'in_lobby'"""
        session_id = create_test_session["session_id"]
        player_id = f"player_{uuid.uuid4().hex[:8]}"
        
        # Join and progress to in_lobby
        # First join as joining
        api_client.post(f"{API_URL}/sessions/{session_id}/join", json={
            "player_id": player_id,
            "nickname": "TestPlayer",
            "state": "joining"
        })
        # Then advance to in_lobby
        join_response = api_client.post(f"{API_URL}/sessions/{session_id}/join", json={
            "player_id": player_id,
            "nickname": "TestPlayer",
            "state": "in_lobby"
        })
        assert join_response.status_code == 200
        
        # Call leave-if-interested
        leave_response = api_client.post(
            f"{API_URL}/sessions/{session_id}/leave-if-interested?player_id={player_id}"
        )
        assert leave_response.status_code == 200
        assert leave_response.json().get("ok") == True
        
        # Verify player is still in session with 'in_lobby' state
        get_response = api_client.get(f"{API_URL}/sessions/{session_id}")
        assert get_response.status_code == 200
        session = get_response.json()
        assert any(p["player_id"] == player_id and p["state"] == "in_lobby" 
                  for p in session["players"]), \
            "Player with 'in_lobby' state should NOT be removed"
    
    def test_leave_if_interested_does_not_remove_host(self, api_client, create_test_session):
        """Test: leave-if-interested does NOT remove the host (even though host is in_lobby)"""
        session_id = create_test_session["session_id"]
        host_id = create_test_session["host_id"]
        
        # Try to leave-if-interested with host's player_id
        leave_response = api_client.post(
            f"{API_URL}/sessions/{session_id}/leave-if-interested?player_id={host_id}"
        )
        assert leave_response.status_code == 200
        assert leave_response.json().get("ok") == True
        
        # Verify host is still in session
        get_response = api_client.get(f"{API_URL}/sessions/{session_id}")
        assert get_response.status_code == 200
        session = get_response.json()
        assert any(p["player_id"] == host_id for p in session["players"]), \
            "Host should NOT be removed by leave-if-interested"
        assert session["host_id"] == host_id
    
    def test_leave_if_interested_returns_ok_for_nonexistent_session(self, api_client):
        """Test: leave-if-interested returns ok:true for non-existent sessions"""
        fake_session_id = str(uuid.uuid4())
        player_id = "random_player"
        
        leave_response = api_client.post(
            f"{API_URL}/sessions/{fake_session_id}/leave-if-interested?player_id={player_id}"
        )
        assert leave_response.status_code == 200
        assert leave_response.json().get("ok") == True, \
            "Should return ok:true for non-existent session"


class TestExistingEndpointsStillWork:
    """Verify existing endpoints still work correctly after the fix"""
    
    @pytest.fixture
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture
    def create_test_session(self, api_client):
        host_id = f"host_{uuid.uuid4().hex[:8]}"
        session_data = {
            "host_name": f"TestHost_{datetime.now().strftime('%H%M%S')}",
            "host_id": host_id,
            "title": "Existing Endpoints Test",
            "region": "NA",
            "match_code": f"EXIST{uuid.uuid4().hex[:4].upper()}",
            "platform": "Cross-play"
        }
        response = api_client.post(f"{API_URL}/sessions", json=session_data)
        assert response.status_code == 200
        data = response.json()
        yield {"session_id": data["id"], "host_id": host_id, "session": data}
        try:
            api_client.patch(
                f"{API_URL}/sessions/{data['id']}?host_id={host_id}",
                json={"status": "ended"}
            )
        except:
            pass
    
    def test_join_endpoint_still_works(self, api_client, create_test_session):
        """Test: POST /sessions/{sid}/join still works"""
        session_id = create_test_session["session_id"]
        player_id = f"player_{uuid.uuid4().hex[:8]}"
        
        response = api_client.post(f"{API_URL}/sessions/{session_id}/join", json={
            "player_id": player_id,
            "nickname": "JoinTest",
            "state": "interested"
        })
        assert response.status_code == 200
        session = response.json()
        assert any(p["player_id"] == player_id for p in session["players"])
    
    def test_leave_endpoint_still_works(self, api_client, create_test_session):
        """Test: POST /sessions/{sid}/leave still works"""
        session_id = create_test_session["session_id"]
        player_id = f"player_{uuid.uuid4().hex[:8]}"
        
        # Join first
        api_client.post(f"{API_URL}/sessions/{session_id}/join", json={
            "player_id": player_id,
            "nickname": "LeaveTest",
            "state": "joining"
        })
        
        # Then leave
        response = api_client.post(
            f"{API_URL}/sessions/{session_id}/leave?player_id={player_id}"
        )
        assert response.status_code == 200
        session = response.json()
        assert not any(p["player_id"] == player_id for p in session["players"])
    
    def test_exit_lobby_endpoint_still_works(self, api_client, create_test_session):
        """Test: POST /sessions/{sid}/exit-lobby still works (joining/in_lobby -> interested)"""
        session_id = create_test_session["session_id"]
        player_id = f"player_{uuid.uuid4().hex[:8]}"
        
        # Join as joining first
        api_client.post(f"{API_URL}/sessions/{session_id}/join", json={
            "player_id": player_id,
            "nickname": "ExitLobbyTest",
            "state": "joining"
        })
        
        # Advance to in_lobby
        api_client.post(f"{API_URL}/sessions/{session_id}/join", json={
            "player_id": player_id,
            "nickname": "ExitLobbyTest",
            "state": "in_lobby"
        })
        
        # Exit lobby (should go back to interested)
        response = api_client.post(f"{API_URL}/sessions/{session_id}/exit-lobby", json={
            "player_id": player_id,
            "nickname": "ExitLobbyTest"
        })
        assert response.status_code == 200
        session = response.json()
        player = next((p for p in session["players"] if p["player_id"] == player_id), None)
        assert player is not None
        assert player["state"] == "interested", \
            "After exit-lobby, player should be in 'interested' state"


class TestBugFixScenario:
    """
    Test the exact bug fix scenario:
    User enters session → commits to joining → clicks Exit Lobby → clicks Back to Lobby
    → should be fully removed from session
    """
    
    @pytest.fixture
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture
    def create_test_session(self, api_client):
        host_id = f"host_{uuid.uuid4().hex[:8]}"
        session_data = {
            "host_name": f"BugFixHost_{datetime.now().strftime('%H%M%S')}",
            "host_id": host_id,
            "title": "Bug Fix Scenario Test",
            "region": "NA",
            "match_code": f"BUG{uuid.uuid4().hex[:4].upper()}",
            "platform": "Cross-play"
        }
        response = api_client.post(f"{API_URL}/sessions", json=session_data)
        assert response.status_code == 200
        data = response.json()
        yield {"session_id": data["id"], "host_id": host_id, "session": data}
        try:
            api_client.patch(
                f"{API_URL}/sessions/{data['id']}?host_id={host_id}",
                json={"status": "ended"}
            )
        except:
            pass
    
    def test_bug_scenario_exit_lobby_then_back_to_lobby(self, api_client, create_test_session):
        """
        Bug scenario: interested → joining → exit-lobby (now interested) → 
        leave (should be removed)
        
        The frontend flow is:
        1. User enters session (auto-joins as interested)
        2. User commits to joining (state: joining)
        3. User clicks "Exit Lobby" (state: interested, pendingExitRef=true)
        4. User clicks "Back to Lobby" → frontend calls /leave since pendingExitRef=true
        5. User should be fully removed
        """
        session_id = create_test_session["session_id"]
        player_id = f"player_{uuid.uuid4().hex[:8]}"
        
        # Step 1: Auto-join as interested (viewing session page)
        api_client.post(f"{API_URL}/sessions/{session_id}/join", json={
            "player_id": player_id,
            "nickname": "BugTestPlayer",
            "state": "interested"
        })
        
        # Step 2: Commit to joining
        api_client.post(f"{API_URL}/sessions/{session_id}/join", json={
            "player_id": player_id,
            "nickname": "BugTestPlayer",
            "state": "joining"
        })
        
        # Step 3: Exit lobby (back to interested)
        exit_response = api_client.post(f"{API_URL}/sessions/{session_id}/exit-lobby", json={
            "player_id": player_id,
            "nickname": "BugTestPlayer"
        })
        assert exit_response.status_code == 200
        session = exit_response.json()
        player = next((p for p in session["players"] if p["player_id"] == player_id), None)
        assert player is not None
        assert player["state"] == "interested"
        
        # Step 4: Back to lobby - frontend calls /leave since pendingExitRef was set
        leave_response = api_client.post(
            f"{API_URL}/sessions/{session_id}/leave?player_id={player_id}"
        )
        assert leave_response.status_code == 200
        
        # Step 5: Verify player is removed
        get_response = api_client.get(f"{API_URL}/sessions/{session_id}")
        session = get_response.json()
        assert not any(p["player_id"] == player_id for p in session["players"]), \
            "Player should be fully removed after exit-lobby + back-to-lobby"
    
    def test_interested_user_navigates_away_without_exit_lobby(self, api_client, create_test_session):
        """
        Scenario: User enters session (interested) → navigates away without committing
        → should be removed via leave-if-interested
        """
        session_id = create_test_session["session_id"]
        player_id = f"player_{uuid.uuid4().hex[:8]}"
        
        # Step 1: Auto-join as interested
        api_client.post(f"{API_URL}/sessions/{session_id}/join", json={
            "player_id": player_id,
            "nickname": "InterestOnlyPlayer",
            "state": "interested"
        })
        
        # Step 2: Navigate away - frontend calls leave-if-interested 
        # (since pendingExitRef=false)
        leave_response = api_client.post(
            f"{API_URL}/sessions/{session_id}/leave-if-interested?player_id={player_id}"
        )
        assert leave_response.status_code == 200
        
        # Step 3: Verify player is removed
        get_response = api_client.get(f"{API_URL}/sessions/{session_id}")
        session = get_response.json()
        assert not any(p["player_id"] == player_id for p in session["players"]), \
            "Interested-only player should be removed via leave-if-interested"
    
    def test_joining_user_navigates_away_without_exit_lobby(self, api_client, create_test_session):
        """
        Scenario: User commits to joining → navigates away WITHOUT clicking Exit Lobby
        → should STAY in session (leave-if-interested doesn't remove joining players)
        """
        session_id = create_test_session["session_id"]
        player_id = f"player_{uuid.uuid4().hex[:8]}"
        
        # Step 1: Join and commit to joining
        api_client.post(f"{API_URL}/sessions/{session_id}/join", json={
            "player_id": player_id,
            "nickname": "CommittedPlayer",
            "state": "joining"
        })
        
        # Step 2: Navigate away - frontend calls leave-if-interested 
        # (since pendingExitRef=false)
        leave_response = api_client.post(
            f"{API_URL}/sessions/{session_id}/leave-if-interested?player_id={player_id}"
        )
        assert leave_response.status_code == 200
        
        # Step 3: Verify player is STILL in session with 'joining' state
        get_response = api_client.get(f"{API_URL}/sessions/{session_id}")
        session = get_response.json()
        player = next((p for p in session["players"] if p["player_id"] == player_id), None)
        assert player is not None, "Joining player should STAY in session"
        assert player["state"] == "joining", "Player should still be in 'joining' state"
