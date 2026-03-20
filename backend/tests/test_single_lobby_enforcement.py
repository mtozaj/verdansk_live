"""
Tests for single-lobby enforcement feature.

The feature enforces that a user can only be in 'in_lobby' state in one session at a time.
When a user tries to commit to joining (transition to 'joining' state) while already 
'in_lobby' in another session:
1. Returns 409 with conflicting session info
2. Can use leave_conflicting query param to leave the other session and proceed

Key scenarios tested:
1. Trying to join as 'joining' when in_lobby elsewhere returns 409
2. Using leave_conflicting param successfully removes from old session and joins new one
3. Joining as 'interested' does NOT trigger conflict check
4. Player who is 'joining' (not in_lobby) elsewhere does NOT trigger 409
5. Player who is in_lobby in an ENDED session does NOT trigger 409
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


class TestSingleLobbyEnforcement:
    """Tests for the single-lobby rule enforcement on POST /api/sessions/{sid}/join"""
    
    @pytest.fixture
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture
    def create_two_sessions(self, api_client):
        """Create two test sessions for conflict testing"""
        sessions = []
        for i in range(2):
            host_id = f"host_{uuid.uuid4().hex[:8]}"
            session_data = {
                "host_name": f"TestHost{i+1}_{datetime.now().strftime('%H%M%S')}",
                "host_id": host_id,
                "title": f"SingleLobby Test Session {i+1}",
                "region": "NA",
                "match_code": f"SLOB{i+1}{uuid.uuid4().hex[:3].upper()}",
                "platform": "Cross-play"
            }
            response = api_client.post(f"{API_URL}/sessions", json=session_data)
            assert response.status_code == 200, f"Failed to create session {i+1}"
            data = response.json()
            sessions.append({"session_id": data["id"], "host_id": host_id, "session": data, "title": data["title"]})
        
        yield sessions
        
        # Cleanup: end both sessions
        for s in sessions:
            try:
                api_client.patch(
                    f"{API_URL}/sessions/{s['session_id']}?host_id={s['host_id']}",
                    json={"status": "ended"}
                )
            except:
                pass
    
    def test_conflict_409_when_in_lobby_elsewhere(self, api_client, create_two_sessions):
        """
        Test: Player who is 'in_lobby' in Session A gets 409 when trying to join 
        Session B as 'joining'
        """
        session_a = create_two_sessions[0]
        session_b = create_two_sessions[1]
        player_id = f"conflict_player_{uuid.uuid4().hex[:8]}"
        nickname = "ConflictTestPlayer"
        
        # Step 1: Join Session A and advance to in_lobby
        # First join as joining
        join_a_joining = api_client.post(f"{API_URL}/sessions/{session_a['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "joining"
        })
        assert join_a_joining.status_code == 200, "Failed to join Session A as joining"
        
        # Then advance to in_lobby
        join_a_in_lobby = api_client.post(f"{API_URL}/sessions/{session_a['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "in_lobby"
        })
        assert join_a_in_lobby.status_code == 200, "Failed to advance to in_lobby in Session A"
        
        # Verify player is in_lobby in Session A
        session_a_data = join_a_in_lobby.json()
        player_in_a = next((p for p in session_a_data["players"] if p["player_id"] == player_id), None)
        assert player_in_a is not None
        assert player_in_a["state"] == "in_lobby"
        
        # Step 2: Try to join Session B as 'joining' - should get 409
        join_b_response = api_client.post(f"{API_URL}/sessions/{session_b['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "joining"
        })
        
        assert join_b_response.status_code == 409, \
            f"Expected 409, got {join_b_response.status_code}: {join_b_response.text}"
        
        conflict_data = join_b_response.json()
        assert conflict_data.get("detail") == "already_in_lobby", \
            f"Expected detail='already_in_lobby', got: {conflict_data}"
        assert conflict_data.get("conflicting_session_id") == session_a["session_id"], \
            "Conflicting session ID should match Session A"
        assert conflict_data.get("conflicting_session_title") == session_a["title"], \
            "Conflicting session title should match Session A's title"
    
    def test_leave_conflicting_param_resolves_conflict(self, api_client, create_two_sessions):
        """
        Test: Using leave_conflicting query param removes player from conflicting 
        session and proceeds with joining the new session
        """
        session_a = create_two_sessions[0]
        session_b = create_two_sessions[1]
        player_id = f"resolve_player_{uuid.uuid4().hex[:8]}"
        nickname = "ResolveConflictPlayer"
        
        # Step 1: Join Session A and advance to in_lobby
        api_client.post(f"{API_URL}/sessions/{session_a['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "joining"
        })
        api_client.post(f"{API_URL}/sessions/{session_a['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "in_lobby"
        })
        
        # Step 2: Join Session B with leave_conflicting param
        join_b_response = api_client.post(
            f"{API_URL}/sessions/{session_b['session_id']}/join?leave_conflicting={session_a['session_id']}", 
            json={
                "player_id": player_id,
                "nickname": nickname,
                "state": "joining"
            }
        )
        
        assert join_b_response.status_code == 200, \
            f"Expected 200 with leave_conflicting, got {join_b_response.status_code}: {join_b_response.text}"
        
        # Step 3: Verify player is now in Session B as 'joining'
        session_b_data = join_b_response.json()
        player_in_b = next((p for p in session_b_data["players"] if p["player_id"] == player_id), None)
        assert player_in_b is not None, "Player should be in Session B"
        assert player_in_b["state"] == "joining", "Player should be in 'joining' state in Session B"
        
        # Step 4: Verify player is removed from Session A
        get_a_response = api_client.get(f"{API_URL}/sessions/{session_a['session_id']}")
        assert get_a_response.status_code == 200
        session_a_data = get_a_response.json()
        assert not any(p["player_id"] == player_id for p in session_a_data["players"]), \
            "Player should be removed from Session A"
    
    def test_interested_state_does_not_trigger_conflict(self, api_client, create_two_sessions):
        """
        Test: Joining as 'interested' does NOT trigger the 409 conflict check,
        even if player is in_lobby elsewhere
        """
        session_a = create_two_sessions[0]
        session_b = create_two_sessions[1]
        player_id = f"interested_player_{uuid.uuid4().hex[:8]}"
        nickname = "InterestedPlayer"
        
        # Step 1: Join Session A and advance to in_lobby
        api_client.post(f"{API_URL}/sessions/{session_a['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "joining"
        })
        api_client.post(f"{API_URL}/sessions/{session_a['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "in_lobby"
        })
        
        # Step 2: Join Session B as 'interested' - should succeed without 409
        join_b_response = api_client.post(f"{API_URL}/sessions/{session_b['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "interested"
        })
        
        assert join_b_response.status_code == 200, \
            f"Joining as interested should succeed, got {join_b_response.status_code}: {join_b_response.text}"
        
        # Verify player is in both sessions (interested in B, in_lobby in A)
        session_b_data = join_b_response.json()
        player_in_b = next((p for p in session_b_data["players"] if p["player_id"] == player_id), None)
        assert player_in_b is not None
        assert player_in_b["state"] == "interested"
        
        get_a_response = api_client.get(f"{API_URL}/sessions/{session_a['session_id']}")
        session_a_data = get_a_response.json()
        player_in_a = next((p for p in session_a_data["players"] if p["player_id"] == player_id), None)
        assert player_in_a is not None
        assert player_in_a["state"] == "in_lobby"
    
    def test_joining_state_elsewhere_does_not_trigger_conflict(self, api_client, create_two_sessions):
        """
        Test: Player who is 'joining' (not in_lobby) in Session A should NOT 
        trigger 409 when joining Session B as 'joining'
        """
        session_a = create_two_sessions[0]
        session_b = create_two_sessions[1]
        player_id = f"joining_player_{uuid.uuid4().hex[:8]}"
        nickname = "JoiningPlayer"
        
        # Step 1: Join Session A as 'joining' only (don't advance to in_lobby)
        join_a_response = api_client.post(f"{API_URL}/sessions/{session_a['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "joining"
        })
        assert join_a_response.status_code == 200
        
        # Step 2: Join Session B as 'joining' - should succeed (no conflict)
        join_b_response = api_client.post(f"{API_URL}/sessions/{session_b['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "joining"
        })
        
        assert join_b_response.status_code == 200, \
            f"Should succeed since player is only 'joining' in A, got {join_b_response.status_code}"
        
        # Verify player is in both sessions as 'joining'
        session_b_data = join_b_response.json()
        player_in_b = next((p for p in session_b_data["players"] if p["player_id"] == player_id), None)
        assert player_in_b is not None
        assert player_in_b["state"] == "joining"
    
    def test_in_lobby_in_ended_session_does_not_trigger_conflict(self, api_client, create_two_sessions):
        """
        Test: Player who is 'in_lobby' in an ENDED session should NOT 
        trigger 409 when joining another session as 'joining'
        """
        session_a = create_two_sessions[0]
        session_b = create_two_sessions[1]
        player_id = f"ended_session_player_{uuid.uuid4().hex[:8]}"
        nickname = "EndedSessionPlayer"
        
        # Step 1: Join Session A and advance to in_lobby
        api_client.post(f"{API_URL}/sessions/{session_a['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "joining"
        })
        api_client.post(f"{API_URL}/sessions/{session_a['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "in_lobby"
        })
        
        # Step 2: End Session A
        end_response = api_client.patch(
            f"{API_URL}/sessions/{session_a['session_id']}?host_id={session_a['host_id']}",
            json={"status": "ended"}
        )
        assert end_response.status_code == 200
        
        # Step 3: Join Session B as 'joining' - should succeed (Session A is ended)
        join_b_response = api_client.post(f"{API_URL}/sessions/{session_b['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "joining"
        })
        
        assert join_b_response.status_code == 200, \
            f"Should succeed since Session A is ended, got {join_b_response.status_code}: {join_b_response.text}"
    
    def test_interested_to_joining_transition_triggers_conflict(self, api_client, create_two_sessions):
        """
        Test: Player who is 'interested' in Session B and 'in_lobby' in Session A,
        when trying to advance to 'joining' in Session B, should get 409
        """
        session_a = create_two_sessions[0]
        session_b = create_two_sessions[1]
        player_id = f"transition_player_{uuid.uuid4().hex[:8]}"
        nickname = "TransitionPlayer"
        
        # Step 1: Join Session A and advance to in_lobby
        api_client.post(f"{API_URL}/sessions/{session_a['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "joining"
        })
        api_client.post(f"{API_URL}/sessions/{session_a['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "in_lobby"
        })
        
        # Step 2: Join Session B as 'interested' (this should succeed)
        join_b_interested = api_client.post(f"{API_URL}/sessions/{session_b['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "interested"
        })
        assert join_b_interested.status_code == 200
        
        # Step 3: Try to transition to 'joining' in Session B - should get 409
        transition_response = api_client.post(f"{API_URL}/sessions/{session_b['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "joining"
        })
        
        assert transition_response.status_code == 409, \
            f"Expected 409 when transitioning from interested to joining, got {transition_response.status_code}"
        
        conflict_data = transition_response.json()
        assert conflict_data.get("detail") == "already_in_lobby"
        assert conflict_data.get("conflicting_session_id") == session_a["session_id"]
    
    def test_normal_join_flow_when_not_in_lobby_elsewhere(self, api_client, create_two_sessions):
        """
        Test: Normal join flow (interested → joining → in_lobby) works when 
        player is NOT in_lobby in any other session
        """
        session = create_two_sessions[0]
        player_id = f"normal_player_{uuid.uuid4().hex[:8]}"
        nickname = "NormalFlowPlayer"
        
        # Step 1: Join as interested
        interested_response = api_client.post(f"{API_URL}/sessions/{session['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "interested"
        })
        assert interested_response.status_code == 200
        
        # Step 2: Advance to joining
        joining_response = api_client.post(f"{API_URL}/sessions/{session['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "joining"
        })
        assert joining_response.status_code == 200
        
        # Step 3: Advance to in_lobby
        in_lobby_response = api_client.post(f"{API_URL}/sessions/{session['session_id']}/join", json={
            "player_id": player_id,
            "nickname": nickname,
            "state": "in_lobby"
        })
        assert in_lobby_response.status_code == 200
        
        session_data = in_lobby_response.json()
        player = next((p for p in session_data["players"] if p["player_id"] == player_id), None)
        assert player is not None
        assert player["state"] == "in_lobby"


class TestPreviousLeaveIfInterestedStillWorks:
    """Verify previous fix (leave-if-interested) still works after single-lobby changes"""
    
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
            "title": "Leave-If-Interested Regression Test",
            "region": "NA",
            "match_code": f"LIF{uuid.uuid4().hex[:4].upper()}",
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
    
    def test_leave_if_interested_still_removes_interested_player(self, api_client, create_test_session):
        """Regression test: leave-if-interested still removes interested players"""
        session_id = create_test_session["session_id"]
        player_id = f"player_{uuid.uuid4().hex[:8]}"
        
        # Join as interested
        api_client.post(f"{API_URL}/sessions/{session_id}/join", json={
            "player_id": player_id,
            "nickname": "RegressionTest",
            "state": "interested"
        })
        
        # Call leave-if-interested
        leave_response = api_client.post(
            f"{API_URL}/sessions/{session_id}/leave-if-interested?player_id={player_id}"
        )
        assert leave_response.status_code == 200
        assert leave_response.json().get("ok") == True
        
        # Verify player is removed
        get_response = api_client.get(f"{API_URL}/sessions/{session_id}")
        session = get_response.json()
        assert not any(p["player_id"] == player_id for p in session["players"])
    
    def test_leave_if_interested_does_not_remove_joining_player(self, api_client, create_test_session):
        """Regression test: leave-if-interested does NOT remove joining players"""
        session_id = create_test_session["session_id"]
        player_id = f"player_{uuid.uuid4().hex[:8]}"
        
        # Join as joining
        api_client.post(f"{API_URL}/sessions/{session_id}/join", json={
            "player_id": player_id,
            "nickname": "JoiningPlayer",
            "state": "joining"
        })
        
        # Call leave-if-interested
        leave_response = api_client.post(
            f"{API_URL}/sessions/{session_id}/leave-if-interested?player_id={player_id}"
        )
        assert leave_response.status_code == 200
        
        # Verify player is still in session
        get_response = api_client.get(f"{API_URL}/sessions/{session_id}")
        session = get_response.json()
        player = next((p for p in session["players"] if p["player_id"] == player_id), None)
        assert player is not None
        assert player["state"] == "joining"
