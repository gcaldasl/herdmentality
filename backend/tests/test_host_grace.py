"""A host who drops briefly keeps the role; it only moves if they stay away."""

from app.game import room_service


def _setup(session):
    code, host = room_service.create_room(session, "Ann")
    bob = room_service.join_room(session, code, "Bob")
    for pid in (host, bob):
        room_service.set_connected(session, code, pid, True)
    return code, host, bob


def test_deferred_disconnect_keeps_host(session):
    code, host, _ = _setup(session)
    room_service.set_connected(session, code, host, False, handoff=False)
    assert room_service.get_room(session, code).host_player_id == host


def test_host_reconnecting_within_grace_keeps_role(session):
    code, host, _ = _setup(session)
    room_service.set_connected(session, code, host, False, handoff=False)
    room_service.set_connected(session, code, host, True)
    assert room_service.migrate_host_if_absent(session, code, host) is False
    assert room_service.get_room(session, code).host_player_id == host


def test_host_still_absent_after_grace_passes_role(session):
    code, host, bob = _setup(session)
    room_service.set_connected(session, code, host, False, handoff=False)
    assert room_service.migrate_host_if_absent(session, code, host) is True
    room = room_service.get_room(session, code)
    assert room.host_player_id == bob
    assert session.get(room_service.Player, bob).is_host
    assert not session.get(room_service.Player, host).is_host


def test_immediate_migration_still_default(session):
    code, host, bob = _setup(session)
    room_service.set_connected(session, code, host, False)
    assert room_service.get_room(session, code).host_player_id == bob
