(function () {
  "use strict";
  const URL = "https://lltldlpfcxrmceifkwsm.supabase.co";
  const KEY = "sb_publishable_H6AJNrLeF5ok4wVcNSwIRQ_SMdI-s7d";
  const $ = (id) => document.getElementById(id);
  let client = null, session = null, room = null, channel = null, remotePlayers = new Map(), lastStateAt = 0;
  function authMessage(message) { $("onlineAuthStatus").textContent = message; }
  function roomMessage(message) { $("roomStatus").textContent = message; }
  function refreshAuth() {
    $("onlineAuth").hidden = !!session;
    $("onlineLobby").hidden = !session;
    if (session) { $("onlineUserLabel").textContent = "Signed in as " + (session.user.email || "GKEET player"); if (!$("lobbyPlayerName").value) $("lobbyPlayerName").value = session.user.user_metadata?.display_name || "Player"; }
  }
  function renderPlayers(players) {
    const box = $("onlinePlayers");
    box.replaceChildren();
    (players || []).forEach((player) => {
      const item = document.createElement("div");
      item.className = "onlinePlayer";
      item.textContent = (player.player_name || "Player") + (player.user_id === session.user.id ? " (YOU)" : "");
      box.append(item);
    });
    if (!players || !players.length) {
      const item = document.createElement("div");
      item.className = "onlinePlayer";
      item.textContent = "Waiting for players…";
      box.append(item);
    }
  }
  async function loadMembers() {
    if (!room) return;
    const result = await client.from("gkeet_room_members").select("user_id,player_name").eq("room_id", room.id).order("joined_at");
    if (result.error) { roomMessage(result.error.message); return; }
    renderPlayers(result.data);
  }
  async function enterRoom(roomId, knownCode) {
    const result = await client.from("gkeet_rooms").select("id,code,status,max_players,owner_id,map_id").eq("id", roomId).single();
    if (result.error) { roomMessage(result.error.message); return; }
    room = result.data;
    $("roomDetails").hidden = false;
    $("roomCodeDisplay").textContent = knownCode || room.code;
    $("startOnlineMatch").hidden = room.owner_id !== session.user.id;
    roomMessage("Connecting to live room…");
    await loadMembers();
    if (channel) await client.removeChannel(channel);
    channel = client.channel("gkeet:room:" + room.id, { config: { private: true, presence: { key: session.user.id } } });
    channel.on("presence", { event: "sync" }, () => {
      const peers = Object.values(channel.presenceState()).flat().map((peer) => ({
        user_id: peer.user_id, player_name: peer.player_name
      }));
      const presentIds = new Set(peers.map((peer) => peer.user_id));
      for (const userId of remotePlayers.keys()) if (!presentIds.has(userId)) remotePlayers.delete(userId);
      if (peers.length) renderPlayers(peers);
    });
    channel.on("broadcast", { event: "room_refresh" }, loadMembers);
    channel.on("broadcast", { event: "player_state" }, ({ payload }) => { if (payload?.user_id && payload.user_id !== session.user.id) remotePlayers.set(payload.user_id, payload); });
    channel.on("broadcast", { event: "player_shot" }, ({ payload }) => { if (payload?.user_id !== session.user.id) window.gkeetReceiveRemoteShot?.(payload); });
    channel.on("broadcast", { event: "match_start" }, ({ payload }) => { if (payload?.map_id) window.gkeetStartOnlineMatch?.(payload.map_id); roomMessage("MATCH STARTED • Fight!"); });
    channel.on("broadcast", { event: "match_result" }, ({ payload }) => { roomMessage((payload?.win ? "Player cleared the zone" : "Player was defeated") + (Number.isFinite(payload?.score) ? " • Score " + payload.score : "")); });
    channel.on("broadcast", { event: "room_closed" }, async () => { roomMessage("Room owner left. This room is closed."); await leaveRoom(); });
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: session.user.id, player_name: $("lobbyPlayerName").value.trim() || session.user.user_metadata?.display_name || "Player" });
        roomMessage("LIVE LOBBY CONNECTED • Share the code with friends.");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        roomMessage("Realtime connection failed. Check room access and Realtime settings.");
      }
    });
  }
  async function createRoom() {
    if (!session) return;
    const name = $("lobbyPlayerName").value.trim() || $("onlineName").value.trim() || "Player";
    const created = await client.from("gkeet_rooms").insert({ owner_id: session.user.id, max_players: 6 }).select("id,code").single();
    if (created.error) { roomMessage("Create room failed: " + created.error.message); return; }
    const joined = await client.from("gkeet_room_members").insert({
      room_id: created.data.id, user_id: session.user.id, player_name: name
    });
    if (joined.error) { roomMessage("Room created but joining failed: " + joined.error.message); return; }
    await enterRoom(created.data.id, created.data.code);
  }
  async function joinRoom() {
    if (!session) return;
    const code = $("roomCode").value.trim().toUpperCase();
    const name = $("lobbyPlayerName").value.trim() || $("onlineName").value.trim() || "Player";
    if (code.length !== 6) { roomMessage("Enter the 6-character room code."); return; }
    const result = await client.rpc("gkeet_join_room_by_code", { p_code: code, p_player_name: name });
    if (result.error) { roomMessage("Join failed: " + result.error.message); return; }
    await enterRoom(result.data, code);
    if (channel) await channel.send({ type: "broadcast", event: "room_refresh", payload: { at: Date.now() } });
  }
  async function quickMatch() {
    if (!session) { authMessage("Sign in to find an online match."); return; }
    const name = $("lobbyPlayerName").value.trim() || $("onlineName").value.trim() || "Player";
    roomMessage("Searching for an open room…");
    const result = await client.rpc("gkeet_quick_match", { p_player_name: name });
    if (result.error) { roomMessage("Quick Match failed: " + result.error.message); return; }
    const match = result.data;
    if (!match?.room_id || !match?.room_code) {
      roomMessage("Quick Match could not create or find a room. Please try again.");
      return;
    }
    await enterRoom(match.room_id, match.room_code);
    if (channel) await channel.send({ type: "broadcast", event: "room_refresh", payload: { at: Date.now() } });
    roomMessage(match.created
      ? "ROOM CREATED • Waiting for another player to join."
      : "MATCH FOUND • Waiting for the room owner to start.");
  }
  async function startOnlineMatch() {
    if (!room || !session || room.owner_id !== session.user.id) return;
    const members = await client.from("gkeet_room_members").select("user_id").eq("room_id", room.id);
    if (members.error) { roomMessage(members.error.message); return; }
    if ((members.data || []).length < 2) { roomMessage("Invite at least one friend before starting."); return; }
    const updated = await client.from("gkeet_rooms").update({ status: "playing", map_id: "zone_01" }).eq("id", room.id);
    if (updated.error) { roomMessage("Could not start match: " + updated.error.message); return; }
    await channel.send({ type: "broadcast", event: "match_start", payload: { map_id: 1 } });
    window.gkeetStartOnlineMatch?.(1);
    roomMessage("MATCH STARTED • Fight!");
  }
  async function leaveRoom() {
    if (room && session && room.owner_id === session.user.id) {
      if (channel) await channel.send({ type: "broadcast", event: "room_closed", payload: { at: Date.now() } });
      await client.from("gkeet_rooms").update({ status: "closed" }).eq("id", room.id).eq("owner_id", session.user.id);
    }
    if (channel) { await client.removeChannel(channel); channel = null; }
    remotePlayers.clear();
    if (room && session) await client.from("gkeet_room_members").delete().eq("room_id", room.id).eq("user_id", session.user.id);
    room = null;
    $("roomDetails").hidden = true;
    roomMessage("You left the room.");
  }
  $("onlineBack").onclick = () => {
    ["home", "maps", "onlinePanel", "game"].forEach((id) => $(id).classList.remove("on"));
    $("home").classList.add("on");
  };
  $("online").onclick = () => {
    ["home", "maps", "onlinePanel", "game"].forEach((id) => $(id).classList.remove("on"));
    $("onlinePanel").classList.add("on");
    refreshAuth();
  };
  if (!window.supabase || !window.supabase.createClient) {
    authMessage("Online service could not load. Check your internet connection.");
    return;
  }
  client = window.supabase.createClient(URL, KEY);
  client.auth.getSession().then(({ data }) => { session = data.session; refreshAuth(); });
  client.auth.onAuthStateChange((_event, nextSession) => { session = nextSession; refreshAuth(); });
  $("onlineSignIn").onclick = async () => {
    const result = await client.auth.signInWithPassword({ email: $("onlineEmail").value.trim(), password: $("onlinePassword").value });
    authMessage(result.error ? result.error.message : "Signed in successfully.");
  };
  $("onlineSignUp").onclick = async () => {
    const name = $("onlineName").value.trim();
    if (!name) { authMessage("Enter a player name first."); return; }
    const result = await client.auth.signUp({
      email: $("onlineEmail").value.trim(), password: $("onlinePassword").value,
      options: { data: { display_name: name } }
    });
    authMessage(result.error ? result.error.message :
      (result.data.session ? "Account created. You are signed in." : "Account created. Check your email to confirm, then sign in."));
  };
  $("createRoom").onclick = createRoom;
  $("startOnlineMatch").onclick = startOnlineMatch;
  $("quickRoom").onclick = quickMatch;
  $("joinRoom").onclick = joinRoom;
  $("leaveRoom").onclick = leaveRoom;
  $("copyRoomCode").onclick = async () => {
    if (!room) return;
    try { await navigator.clipboard.writeText(room.code); roomMessage("Room code copied."); }
    catch (_) { roomMessage("Room code: " + room.code); }
  };
  $("onlineSignOut").onclick = async () => { await leaveRoom(); await client.auth.signOut(); authMessage("Signed out."); };
  window.gkeetOnline = {
    get active() { return !!(room && channel); },
    getRemotePlayers() { const now = Date.now(); return Array.from(remotePlayers.values()).filter((player) => !Number.isFinite(player.sent_at) || now - player.sent_at < 3000); },
    resetRemotePlayers() { remotePlayers.clear(); },
    async sendState(state) { if (!channel || !room || !session) return; const now = performance.now(); if (now - lastStateAt < 70) return; lastStateAt = now; await channel.send({ type: "broadcast", event: "player_state", payload: { ...state, user_id: session.user.id, player_name: $("lobbyPlayerName").value.trim() || "Player", sent_at: Date.now() } }); },
    async sendShot(shot) { if (!channel || !room || !session) return; await channel.send({ type: "broadcast", event: "player_shot", payload: { ...shot, user_id: session.user.id } }); },
    async sendMatchResult(result) { if (!channel || !room || !session) return; await channel.send({ type: "broadcast", event: "match_result", payload: { ...result, user_id: session.user.id } }); }
  };
  $("onlineBack").onclick = () => {
    ["home", "maps", "onlinePanel", "game"].forEach((id) => $(id).classList.remove("on"));
    $("home").classList.add("on");
  };
  $("online").onclick = () => {
    ["home", "maps", "onlinePanel", "game"].forEach((id) => $(id).classList.remove("on"));
    $("onlinePanel").classList.add("on");
    refreshAuth();
  };
})();