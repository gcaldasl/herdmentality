"""ConnectionManager: a reconnect / second tab must not unregister the player."""

import asyncio

from app.game.manager import ConnectionManager


class FakeWebSocket:
    def __init__(self):
        self.sent: list[dict] = []
        self.closed = False

    async def accept(self):
        pass

    async def send_json(self, message):
        if self.closed:
            raise RuntimeError("socket closed")
        self.sent.append(message)

    async def close(self):
        self.closed = True


def test_stale_socket_teardown_does_not_evict_the_live_one():
    async def scenario():
        mgr = ConnectionManager()
        first = FakeWebSocket()
        second = FakeWebSocket()

        await mgr.connect("ABCD", "p1", first)
        await mgr.connect("ABCD", "p1", second)  # supersedes `first`
        assert first.closed is True

        # `first`'s handler now unwinds and calls disconnect with its own socket.
        assert await mgr.disconnect("ABCD", "p1", first) is False

        # `second` is still registered and receives broadcasts.
        await mgr._broadcast("ABCD", {"type": "state"})
        assert second.sent == [{"type": "state"}]

    asyncio.run(scenario())


def test_disconnecting_the_live_socket_removes_it():
    async def scenario():
        mgr = ConnectionManager()
        ws = FakeWebSocket()
        await mgr.connect("ABCD", "p1", ws)
        assert await mgr.disconnect("ABCD", "p1", ws) is True
        assert await mgr.disconnect("ABCD", "p1", ws) is False

    asyncio.run(scenario())
